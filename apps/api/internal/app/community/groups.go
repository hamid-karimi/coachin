package community

import (
	"cmp"
	"context"
	"fmt"
	"slices"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/google/uuid"

	"github.com/hamid-karimi/coachin/apps/api/internal/app/apperr"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/dates"
)

// RecentGroupDays is how many settled days a group shows.
const RecentGroupDays = 7

// GroupRow is a group's stored state.
type GroupRow struct {
	ID          uuid.UUID
	Name        string
	InviteCode  string
	StreakCount int
	BestStreak  int
}

// GroupMemberRow is a member's public profile.
type GroupMemberRow struct {
	GroupID   uuid.UUID
	UserID    uuid.UUID
	FullName  *string
	AvatarURL *string
}

// GroupDay is a settled day: did everyone train?
type GroupDay struct {
	GroupID    uuid.UUID
	Date       string
	AllTrained bool
}

// GroupJoin is a join outcome.
type GroupJoin struct {
	AlreadyMember bool
	Failure       string
}

// GroupStore reads and writes training groups as the signed-in user (only
// members see a group).
type GroupStore interface {
	MyGroupIDs(ctx context.Context, userID uuid.UUID) ([]uuid.UUID, error)
	// EvaluateGroupDays settles un-evaluated past days (idempotent SQL).
	EvaluateGroupDays(ctx context.Context, userID, groupID uuid.UUID) error
	Groups(ctx context.Context, userID uuid.UUID, ids []uuid.UUID) ([]GroupRow, error)
	GroupMembers(ctx context.Context, userID uuid.UUID, ids []uuid.UUID) ([]GroupMemberRow, error)
	GroupDays(ctx context.Context, userID uuid.UUID, ids []uuid.UUID, from string) ([]GroupDay, error)
	TrainedToday(ctx context.Context, userID, groupID uuid.UUID) ([]uuid.UUID, error)
	WeeklyBoard(ctx context.Context, userID uuid.UUID, ids []uuid.UUID, limit int) ([]Row, error)
	CreateGroup(ctx context.Context, userID uuid.UUID, name string) (code, failure string, err error)
	JoinGroup(ctx context.Context, userID uuid.UUID, code string) (GroupJoin, error)
	LeaveGroup(ctx context.Context, userID, groupID uuid.UUID) (failure string, err error)
	LoggedAnythingOn(ctx context.Context, userID uuid.UUID, date string) (bool, error)
	// TopStreakGroup is the user's group with the longest live streak (nil when none).
	TopStreakGroup(ctx context.Context, userID uuid.UUID) (*GroupRow, error)
}

// GroupsService is the Groups tab and Today's group nudge.
type GroupsService struct {
	store GroupStore
	now   func() time.Time
}

// NewGroupsService builds the service; now defaults to time.Now.
func NewGroupsService(store GroupStore, now func() time.Time) *GroupsService {
	if now == nil {
		now = time.Now
	}
	return &GroupsService{store: store, now: now}
}

// GroupMember is a member with this week's XP and today's state.
type GroupMember struct {
	GroupMemberRow
	WeeklyXP     int64
	TrainedToday bool
}

// Group is a group with its members (weekly XP first) and recent days (oldest first).
type Group struct {
	GroupRow
	Members    []GroupMember
	RecentDays []GroupDay
}

// Groups settles each group's past days, then reads them.
func (s *GroupsService) Groups(ctx context.Context, userID uuid.UUID) ([]Group, error) {
	ids, err := s.store.MyGroupIDs(ctx, userID)
	if err != nil || len(ids) == 0 {
		return []Group{}, err
	}
	for _, id := range ids {
		if err := s.store.EvaluateGroupDays(ctx, userID, id); err != nil {
			return nil, fmt.Errorf("evaluate group days: %w", err)
		}
	}
	rows, err := s.store.Groups(ctx, userID, ids)
	if err != nil {
		return nil, fmt.Errorf("groups: %w", err)
	}
	members, err := s.store.GroupMembers(ctx, userID, ids)
	if err != nil {
		return nil, fmt.Errorf("group members: %w", err)
	}
	days, err := s.store.GroupDays(ctx, userID, ids, dates.ToYMD(s.now().AddDate(0, 0, -RecentGroupDays)))
	if err != nil {
		return nil, fmt.Errorf("group days: %w", err)
	}
	memberIDs := []uuid.UUID{}
	for _, m := range members {
		if !slices.Contains(memberIDs, m.UserID) {
			memberIDs = append(memberIDs, m.UserID)
		}
	}
	weekly, err := s.store.WeeklyBoard(ctx, userID, memberIDs, len(memberIDs))
	if err != nil {
		return nil, fmt.Errorf("weekly xp: %w", err)
	}
	xpOf := map[uuid.UUID]int64{}
	for _, r := range weekly {
		xpOf[r.ID] = r.XP
	}
	out := make([]Group, len(rows))
	for i, g := range rows {
		trained, err := s.store.TrainedToday(ctx, userID, g.ID)
		if err != nil {
			return nil, fmt.Errorf("trained today: %w", err)
		}
		out[i] = Group{GroupRow: g, Members: []GroupMember{}, RecentDays: []GroupDay{}}
		for _, m := range members {
			if m.GroupID == g.ID {
				out[i].Members = append(out[i].Members, GroupMember{GroupMemberRow: m, WeeklyXP: xpOf[m.UserID], TrainedToday: slices.Contains(trained, m.UserID)})
			}
		}
		slices.SortStableFunc(out[i].Members, func(a, b GroupMember) int { return cmp.Compare(b.WeeklyXP, a.WeeklyXP) })
		for _, d := range days {
			if d.GroupID == g.ID {
				out[i].RecentDays = append(out[i].RecentDays, d)
			}
		}
	}
	return out, nil
}

const (
	minGroupName = 3
	maxGroupName = 60
)

// CreateGroup starts a group (2–10 members once friends join).
func (s *GroupsService) CreateGroup(ctx context.Context, userID uuid.UUID, name string) (string, error) {
	name = strings.TrimSpace(name)
	if n := utf8.RuneCountInString(name); n < minGroupName || n > maxGroupName {
		return "", apperr.New(apperr.Invalid, "Group names are 3–60 characters")
	}
	code, failure, err := s.store.CreateGroup(ctx, userID, name)
	if err != nil {
		return "", fmt.Errorf("create group: %w", err)
	}
	if failure != "" {
		return "", apperr.New(apperr.Invalid, failure)
	}
	return fmt.Sprintf("Group created — share code %s with your friends.", code), nil
}

// GroupJoined is a group join outcome ("info" when already a member).
type GroupJoined struct {
	Status, Message string
}

// JoinGroup joins by invite code (10 members max).
func (s *GroupsService) JoinGroup(ctx context.Context, userID uuid.UUID, rawCode string) (GroupJoined, error) {
	code := strings.TrimSpace(rawCode)
	if code == "" {
		return GroupJoined{}, apperr.New(apperr.Invalid, "Enter an invite code")
	}
	joined, err := s.store.JoinGroup(ctx, userID, code)
	if err != nil {
		return GroupJoined{}, fmt.Errorf("join group: %w", err)
	}
	if joined.Failure != "" {
		return GroupJoined{}, apperr.New(apperr.Invalid, joined.Failure)
	}
	if joined.AlreadyMember {
		return GroupJoined{Status: "info", Message: "You are already in this group."}, nil
	}
	return GroupJoined{Status: "success", Message: "Joined the group."}, nil
}

// LeaveGroup leaves; the last one out removes the group.
func (s *GroupsService) LeaveGroup(ctx context.Context, userID, groupID uuid.UUID) (string, error) {
	failure, err := s.store.LeaveGroup(ctx, userID, groupID)
	if err != nil {
		return "", fmt.Errorf("leave group: %w", err)
	}
	if failure != "" {
		return "", apperr.New(apperr.NotFound, failure)
	}
	return "You left the group.", nil
}

// GroupNudge is Today's "your group's streak needs you" card.
type GroupNudge struct {
	GroupName   string
	StreakCount int
}

// Nudge names the group with the longest live streak — only while the user
// hasn't logged anything today.
func (s *GroupsService) Nudge(ctx context.Context, userID uuid.UUID) (*GroupNudge, error) {
	logged, err := s.store.LoggedAnythingOn(ctx, userID, dates.ToYMD(s.now()))
	if err != nil || logged {
		return nil, err
	}
	g, err := s.store.TopStreakGroup(ctx, userID)
	if err != nil || g == nil {
		return nil, err
	}
	return &GroupNudge{GroupName: g.Name, StreakCount: g.StreakCount}, nil
}
