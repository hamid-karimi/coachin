package httpapi

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"

	"github.com/google/uuid"

	"github.com/hamid-karimi/coachin/apps/api/internal/app/community"
)

type fakeGroups struct{ nudge *community.GroupNudge }

func (f *fakeGroups) Groups(_ context.Context, userID uuid.UUID) ([]community.Group, error) {
	return []community.Group{{
		GroupRow:   community.GroupRow{ID: uuid.New(), Name: "Dawn Patrol", InviteCode: "GRP1", StreakCount: 3},
		Members:    []community.GroupMember{{GroupMemberRow: community.GroupMemberRow{UserID: userID}, WeeklyXP: 12, TrainedToday: true}},
		RecentDays: []community.GroupDay{{Date: "2026-09-24", AllTrained: true}},
	}}, nil
}
func (f *fakeGroups) CreateGroup(context.Context, uuid.UUID, string) (string, error) {
	return "Group created — share code GRP1 with your friends.", nil
}
func (f *fakeGroups) JoinGroup(context.Context, uuid.UUID, string) (community.GroupJoined, error) {
	return community.GroupJoined{Status: "info", Message: "You are already in this group."}, nil
}
func (f *fakeGroups) LeaveGroup(context.Context, uuid.UUID, uuid.UUID) (string, error) {
	return "You left the group.", nil
}
func (f *fakeGroups) Nudge(context.Context, uuid.UUID) (*community.GroupNudge, error) {
	return f.nudge, nil
}

func TestGroupRoutes(t *testing.T) {
	cookie := map[string]string{"Cookie": "coachin_session=live-token"}
	fake := &fakeGroups{}
	off, _ := New(Deps{Auth: &fakeAuth{user: uuid.New(), liveToken: "live-token"}, Groups: fake})
	if rec := send(t, off, http.MethodGet, BasePath+"/community/group-nudge", "", cookie); rec.Code != http.StatusNotFound {
		t.Fatalf("flag off: %d", rec.Code)
	}
	on, _ := New(Deps{Auth: &fakeAuth{user: uuid.New(), liveToken: "live-token"}, Groups: fake, CommunityEnabled: true})
	rec := send(t, on, http.MethodGet, BasePath+"/community/groups", "", cookie)
	var groups GroupsBody
	_ = json.Unmarshal(rec.Body.Bytes(), &groups)
	if rec.Code != http.StatusOK || !groups.Groups[0].Members[0].IsYou || groups.Groups[0].Members[0].Name != "Member" || !groups.Groups[0].RecentDays[0].AllTrained {
		t.Fatalf("groups: %d %s", rec.Code, rec.Body)
	}
	rec = send(t, on, http.MethodGet, BasePath+"/community/group-nudge", "", cookie)
	var empty GroupNudgeBody
	if err := json.Unmarshal(rec.Body.Bytes(), &empty); rec.Code != http.StatusOK || err != nil || empty.GroupName != nil {
		t.Fatalf("empty nudge: %d %s", rec.Code, rec.Body)
	}
	fake.nudge = &community.GroupNudge{GroupName: "Dawn Patrol", StreakCount: 3}
	rec = send(t, on, http.MethodGet, BasePath+"/community/group-nudge", "", cookie)
	var nudge GroupNudgeBody
	_ = json.Unmarshal(rec.Body.Bytes(), &nudge)
	if nudge.GroupName == nil || *nudge.GroupName != "Dawn Patrol" || nudge.StreakCount != 3 {
		t.Fatalf("nudge: %s", rec.Body)
	}
	if rec := send(t, on, http.MethodPost, BasePath+"/community/groups/join", `{"code":"GRP1"}`, cookie); rec.Code != http.StatusOK {
		t.Fatalf("join: %d", rec.Code)
	}
}
