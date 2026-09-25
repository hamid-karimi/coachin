package httpapi

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"

	"github.com/google/uuid"

	"github.com/hamid-karimi/coachin/apps/api/internal/app/community"
)

type fakeCommunity struct{ board community.Board }

func (f *fakeCommunity) Leaderboard(_ context.Context, userID uuid.UUID, board community.Board) (community.Leaderboard, error) {
	f.board = board
	name := "Ada"
	return community.Leaderboard{Board: board, Weekly: true, Rows: []community.Row{{ID: userID, FullName: &name, XP: 60}, {ID: uuid.New(), XP: 10}}}, nil
}
func (f *fakeCommunity) Clubs(context.Context, uuid.UUID) ([]community.Membership, error) {
	return []community.Membership{{ClubID: uuid.New(), Name: "Night Runners", InviteCode: "CLUB-ABC234", Role: "owner", IsPrimary: true}}, nil
}
func (f *fakeCommunity) CreateClub(context.Context, uuid.UUID, string, string) (string, error) {
	return "Club created. Invite code: CLUB-ABC234", nil
}
func (f *fakeCommunity) JoinClub(context.Context, uuid.UUID, string) (string, error) {
	return "You joined the club successfully.", nil
}
func (f *fakeCommunity) SetPrimaryClub(context.Context, uuid.UUID, uuid.UUID) (string, error) {
	return "Your primary club was updated.", nil
}
func (f *fakeCommunity) LeaveClub(context.Context, uuid.UUID, uuid.UUID) (string, error) {
	return "You left the club.", nil
}

func TestCommunityRoutes(t *testing.T) {
	cookie := map[string]string{"Cookie": "coachin_session=live-token"}
	fake := &fakeCommunity{}
	off, _ := New(Deps{Auth: &fakeAuth{user: uuid.New(), liveToken: "live-token"}, Community: fake})
	for _, path := range []string{"/community/leaderboard", "/community/clubs"} {
		if rec := send(t, off, http.MethodGet, BasePath+path, "", cookie); rec.Code != http.StatusNotFound {
			t.Fatalf("flag off %s: %d", path, rec.Code)
		}
	}
	if rec := send(t, off, http.MethodPost, BasePath+"/community/clubs/join", `{"code":"CLUB-X"}`, cookie); rec.Code != http.StatusNotFound {
		t.Fatalf("flag off join: %d", rec.Code)
	}

	on, _ := New(Deps{Auth: &fakeAuth{user: uuid.New(), liveToken: "live-token"}, Community: fake, CommunityEnabled: true})
	rec := send(t, on, http.MethodGet, BasePath+"/community/leaderboard?board=circle", "", cookie)
	var board LeaderboardBody
	_ = json.Unmarshal(rec.Body.Bytes(), &board)
	if rec.Code != http.StatusOK || fake.board != community.Circle || !board.Rows[0].IsYou || board.Rows[1].Name != "Athlete" ||
		board.Rows[1].Rank != 2 || board.Rows[1].Tier != "bronze" {
		t.Fatalf("board: %d %s", rec.Code, rec.Body)
	}
	if rec := send(t, on, http.MethodGet, BasePath+"/community/leaderboard?board=moon", "", cookie); rec.Code != http.StatusUnprocessableEntity {
		t.Fatalf("bad board: %d", rec.Code)
	}
	if rec := send(t, on, http.MethodGet, BasePath+"/community/clubs", "", cookie); rec.Code != http.StatusOK {
		t.Fatalf("clubs: %d", rec.Code)
	}
	if rec := send(t, on, http.MethodPost, BasePath+"/community/clubs", `{"name":"Night Runners"}`, cookie); rec.Code != http.StatusCreated {
		t.Fatalf("create: %d %s", rec.Code, rec.Body)
	}
	if rec := send(t, on, http.MethodDelete, BasePath+"/community/clubs/"+uuid.NewString()+"/membership", "", cookie); rec.Code != http.StatusOK {
		t.Fatalf("leave: %d", rec.Code)
	}
	if rec := send(t, on, http.MethodGet, BasePath+"/community/clubs", "", nil); rec.Code != http.StatusUnauthorized {
		t.Fatalf("signed out: %d", rec.Code)
	}
}
