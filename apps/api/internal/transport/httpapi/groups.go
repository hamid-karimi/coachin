package httpapi

import (
	"context"
	"net/http"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"

	"github.com/hamid-karimi/coachin/apps/api/internal/app/community"
)

// GroupsService is group streaks (flag-gated).
type GroupsService interface {
	Groups(ctx context.Context, userID uuid.UUID) ([]community.Group, error)
	CreateGroup(ctx context.Context, userID uuid.UUID, name string) (string, error)
	JoinGroup(ctx context.Context, userID uuid.UUID, code string) (community.GroupJoined, error)
	LeaveGroup(ctx context.Context, userID, groupID uuid.UUID) (string, error)
	Nudge(ctx context.Context, userID uuid.UUID) (*community.GroupNudge, error)
}

// GroupMemberBody is a member (no email).
type GroupMemberBody struct {
	UserID       uuid.UUID `json:"userId"`
	Name         string    `json:"name" doc:"Full name, else \"Member\""`
	AvatarURL    *string   `json:"avatarUrl"`
	WeeklyXP     int64     `json:"weeklyXp"`
	TrainedToday bool      `json:"trainedToday"`
	IsYou        bool      `json:"isYou"`
}

// GroupDayBody is a settled day.
type GroupDayBody struct {
	Date       string `json:"date" format:"date"`
	AllTrained bool   `json:"allTrained"`
}

// GroupBody is a training group.
type GroupBody struct {
	ID          uuid.UUID         `json:"id"`
	Name        string            `json:"name"`
	InviteCode  string            `json:"inviteCode"`
	StreakCount int               `json:"streakCount"`
	BestStreak  int               `json:"bestStreak"`
	Members     []GroupMemberBody `json:"members" doc:"Most XP this week first"`
	RecentDays  []GroupDayBody    `json:"recentDays" doc:"Up to the last 7 settled days, oldest first"`
}

// GroupsBody is the user's groups.
type GroupsBody struct {
	Groups []GroupBody `json:"groups"`
}

type groupsOutput struct {
	Body GroupsBody
}

type createGroupInput struct {
	Body struct {
		Name string `json:"name" maxLength:"200"`
	}
}

type joinGroupInput struct {
	Body struct {
		Code string `json:"code" maxLength:"64"`
	}
}

// GroupNudgeBody is Today's group card (absent group: nothing to show).
type GroupNudgeBody struct {
	GroupName   *string `json:"groupName,omitempty"`
	StreakCount int     `json:"streakCount"`
}

type groupNudgeOutput struct {
	Body GroupNudgeBody
}

func groupBody(userID uuid.UUID, g community.Group) GroupBody {
	body := GroupBody{
		ID: g.ID, Name: g.Name, InviteCode: g.InviteCode, StreakCount: g.StreakCount, BestStreak: g.BestStreak,
		Members: make([]GroupMemberBody, len(g.Members)), RecentDays: make([]GroupDayBody, len(g.RecentDays)),
	}
	for i, m := range g.Members {
		body.Members[i] = GroupMemberBody{UserID: m.UserID, Name: deref(m.FullName), AvatarURL: m.AvatarURL, WeeklyXP: m.WeeklyXP, TrainedToday: m.TrainedToday, IsYou: m.UserID == userID}
		if body.Members[i].Name == "" {
			body.Members[i].Name = "Member"
		}
	}
	for i, d := range g.RecentDays {
		body.RecentDays[i] = GroupDayBody{Date: d.Date, AllTrained: d.AllTrained}
	}
	return body
}

func registerGroups(api huma.API, deps Deps) {
	svc, logger := deps.Groups, deps.logger()
	gated := huma.Middlewares{communityOnly(api, deps.CommunityEnabled), requireUser(api)}
	tags := []string{"community"}

	huma.Register(api, huma.Operation{
		OperationID: "listGroups", Method: http.MethodGet, Path: "/community/groups",
		Summary:     "Your training groups (past days settled first)",
		Description: "Settles each group's un-evaluated past days (streak + bonus XP, FORMULAS §2) before reading.",
		Tags:        tags, Middlewares: gated, Errors: []int{401, 404},
	}, func(ctx context.Context, _ *struct{}) (*groupsOutput, error) {
		userID, _ := userFrom(ctx)
		groups, err := svc.Groups(ctx, userID)
		if err != nil {
			return nil, toProblem(ctx, logger, err)
		}
		body := GroupsBody{Groups: make([]GroupBody, len(groups))}
		for i, g := range groups {
			body.Groups[i] = groupBody(userID, g)
		}
		return &groupsOutput{Body: body}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "createGroup", Method: http.MethodPost, Path: "/community/groups",
		Summary: "Start a training group", Tags: tags, DefaultStatus: http.StatusCreated, Middlewares: gated, Errors: []int{400, 401, 404},
	}, func(ctx context.Context, in *createGroupInput) (*resultOutput, error) {
		userID, _ := userFrom(ctx)
		msg, err := svc.CreateGroup(ctx, userID, in.Body.Name)
		if err != nil {
			return nil, toProblem(ctx, logger, err)
		}
		return &resultOutput{Body: ResultBody{Status: "success", Message: msg}}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "joinGroup", Method: http.MethodPost, Path: "/community/groups/join",
		Summary: "Join a group by invite code (10 members max)", Tags: tags,
		Middlewares: huma.Middlewares{communityOnly(api, deps.CommunityEnabled), requireUser(api), rateLimited(api, newLimiter(10*time.Second, 5))},
		Errors:      []int{400, 401, 404, 429},
	}, func(ctx context.Context, in *joinGroupInput) (*resultOutput, error) {
		userID, _ := userFrom(ctx)
		joined, err := svc.JoinGroup(ctx, userID, in.Body.Code)
		if err != nil {
			return nil, toProblem(ctx, logger, err)
		}
		return &resultOutput{Body: ResultBody{Status: joined.Status, Message: joined.Message}}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "leaveGroup", Method: http.MethodDelete, Path: "/community/groups/{id}/membership",
		Summary: "Leave a group (the last one out removes it)", Tags: tags, Middlewares: gated, Errors: []int{401, 404},
	}, func(ctx context.Context, in *idPathInput) (*resultOutput, error) {
		userID, _ := userFrom(ctx)
		msg, err := svc.LeaveGroup(ctx, userID, in.ID)
		if err != nil {
			return nil, toProblem(ctx, logger, err)
		}
		return &resultOutput{Body: ResultBody{Status: "info", Message: msg}}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "getGroupNudge", Method: http.MethodGet, Path: "/community/group-nudge",
		Summary: "Your longest live group streak, while you haven't logged today",
		Tags:    tags, Middlewares: gated, Errors: []int{401, 404},
	}, func(ctx context.Context, _ *struct{}) (*groupNudgeOutput, error) {
		userID, _ := userFrom(ctx)
		nudge, err := svc.Nudge(ctx, userID)
		if err != nil {
			return nil, toProblem(ctx, logger, err)
		}
		body := GroupNudgeBody{}
		if nudge != nil {
			body = GroupNudgeBody{GroupName: &nudge.GroupName, StreakCount: nudge.StreakCount}
		}
		return &groupNudgeOutput{Body: body}, nil
	})
}
