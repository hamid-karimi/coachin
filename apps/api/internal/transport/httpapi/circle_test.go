package httpapi

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"testing"

	"github.com/google/uuid"

	"github.com/hamid-karimi/coachin/apps/api/internal/app/apperr"
	"github.com/hamid-karimi/coachin/apps/api/internal/app/community"
)

type fakeCircle struct {
	term string
	page int
}

func (f *fakeCircle) Circle(context.Context, uuid.UUID) (community.CircleView, error) {
	name := "Grace"
	return community.CircleView{
		Following: []community.Row{{ID: uuid.New(), FullName: &name, Level: 4}},
		Coaches:   []community.Coach{{Row: community.Row{ID: uuid.New()}}},
	}, nil
}
func (f *fakeCircle) People(_ context.Context, _ uuid.UUID, term string, page int) (community.PeoplePage, error) {
	f.term, f.page = term, page
	return community.PeoplePage{People: []community.Person{{Row: community.Row{ID: uuid.New()}, Following: true}}, Page: page, HasNext: true}, nil
}
func (f *fakeCircle) Follow(_ context.Context, userID, id uuid.UUID) (string, error) {
	if id == userID {
		return "", apperr.New(apperr.Invalid, "You cannot follow yourself.")
	}
	return "User followed.", nil
}
func (f *fakeCircle) Unfollow(context.Context, uuid.UUID, uuid.UUID) (string, error) {
	return "User unfollowed.", nil
}

func TestCircleRoutes(t *testing.T) {
	cookie := map[string]string{"Cookie": "coachin_session=live-token"}
	user := uuid.New()
	fake := &fakeCircle{}
	off, _ := New(Deps{Auth: &fakeAuth{user: user, liveToken: "live-token"}, Circle: fake})
	if rec := send(t, off, http.MethodGet, BasePath+"/community/people?q=a", "", cookie); rec.Code != http.StatusNotFound {
		t.Fatalf("flag off: %d", rec.Code)
	}
	on, _ := New(Deps{Auth: &fakeAuth{user: user, liveToken: "live-token"}, Circle: fake, CommunityEnabled: true})
	rec := send(t, on, http.MethodGet, BasePath+"/community/circle", "", cookie)
	var circle CircleBody
	_ = json.Unmarshal(rec.Body.Bytes(), &circle)
	if rec.Code != http.StatusOK || !circle.Following[0].Following || circle.Coaches[0].Sport != "General coaching" || circle.Coaches[0].Name != "Athlete" {
		t.Fatalf("circle: %d %s", rec.Code, rec.Body)
	}
	rec = send(t, on, http.MethodGet, BasePath+"/community/people?q=grace&page=2", "", cookie)
	if rec.Code != http.StatusOK || fake.term != "grace" || fake.page != 2 || strings.Contains(rec.Body.String(), "email") {
		t.Fatalf("people: %d %s", rec.Code, rec.Body)
	}
	if rec := send(t, on, http.MethodPost, BasePath+"/community/follows", `{"userId":"`+user.String()+`"}`, cookie); rec.Code != http.StatusBadRequest {
		t.Fatalf("follow self: %d", rec.Code)
	}
	if rec := send(t, on, http.MethodDelete, BasePath+"/community/follows/"+uuid.NewString(), "", cookie); rec.Code != http.StatusOK {
		t.Fatalf("unfollow: %d", rec.Code)
	}
}
