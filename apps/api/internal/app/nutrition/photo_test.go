package nutrition

import (
	"context"
	"encoding/json"
	"strings"
	"testing"

	"github.com/google/uuid"

	"github.com/hamid-karimi/coachin/apps/api/internal/domain/aigen"
)

// replyAI answers every request with text; empty means unavailable.
type replyAI struct {
	text     string
	requests []aigen.Request
}

func (r *replyAI) GenerateJSON(_ context.Context, req aigen.Request) (aigen.Result, bool) {
	r.requests = append(r.requests, req)
	return aigen.Result{Text: r.text}, r.text != ""
}

// jpeg is enough of a JPEG for content sniffing.
var jpeg = append([]byte{0xFF, 0xD8, 0xFF, 0xE0, 0, 0x10, 'J', 'F', 'I', 'F', 0}, make([]byte, 64)...)

func TestEstimatePhoto(t *testing.T) {
	country := "  Iran "
	ai := &replyAI{text: `{"items":[{"name":"Rice","est_quantity_g":180,"est_kcal":230}]}`}
	svc := NewService(&fakeStore{country: &country}, fakeUSDA{}, ai, now)
	photos := []Photo{{Size: int64(len(jpeg)), Data: jpeg}, {Size: int64(len(jpeg)), Data: jpeg}, {Size: 1, Data: jpeg}, {Size: 1, Data: jpeg}}

	items, err := svc.EstimatePhoto(context.Background(), uuid.New(), photos, "  "+strings.Repeat("x", 200))
	if err != nil || len(items) != 1 || items[0].EstKcal != 230 {
		t.Fatalf("items = %+v, %v", items, err)
	}
	req := ai.requests[0]
	if len(req.Images) != 3 || req.Images[0].MIMEType != "image/jpeg" {
		t.Errorf("images = %d (%s)", len(req.Images), req.Images[0].MIMEType)
	}
	if !strings.Contains(req.Prompt, `The user says: "`+strings.Repeat("x", 140)+`".`) || !strings.Contains(req.Prompt, "The user is in Iran —") {
		t.Errorf("prompt = %s", req.Prompt)
	}

	cases := map[string]struct {
		photos []Photo
		reply  string
	}{
		"Choose a meal photo": {nil, ""},
		"Each photo must be under 2MB (they should be pre-compressed)": {[]Photo{{Size: MaxPhotoBytes + 1}}, ""},
		"Photos must be JPEG, PNG, WebP, or GIF images":                {[]Photo{{Size: 5, Data: []byte("hello")}}, ""},
		"AI estimation is temporarily unavailable — try again later":   {[]Photo{{Size: 1, Data: jpeg}}, ""},
		"Couldn't recognize food in that photo — try another angle":    {[]Photo{{Size: 1, Data: jpeg}}, `{"items":[]}`},
	}
	for want, c := range cases {
		svc := NewService(&fakeStore{}, fakeUSDA{}, &replyAI{text: c.reply}, now)
		if _, err := svc.EstimatePhoto(context.Background(), uuid.New(), c.photos, ""); message(err) != want {
			t.Errorf("%s: %v", want, err)
		}
	}
}

func TestConfirmPhotoMeal(t *testing.T) {
	store := &fakeStore{awards: Awards{MealXP: 10}}
	svc := NewService(store, fakeUSDA{}, nil, now)
	items := []ReviewedItem{
		{EstimateItem: aigen.EstimateItem{Name: "Rice", EstQuantityG: 180, EstKcal: 229.6, ProteinG: 4, CarbsG: -1}},
		{EstimateItem: aigen.EstimateItem{Name: "Oats", EstQuantityG: 0, EstKcal: 150}, FromSearch: true},
		{EstimateItem: aigen.EstimateItem{Name: "Too much", EstKcal: 5001}},
		{EstimateItem: aigen.EstimateItem{Name: "Nothing", EstKcal: 0}},
	}
	msg, err := svc.ConfirmPhotoMeal(context.Background(), uuid.New(), "lunch", items)
	if err != nil || msg != "2 items logged · +10 XP." {
		t.Fatalf("msg = %q, %v", msg, err)
	}
	rice, oats := store.logged[0], store.logged[1]
	var snapshot aigen.EstimateItem
	_ = json.Unmarshal(rice.PhotoEstimate, &snapshot)
	if rice.EntryMethod != "photo" || rice.Kcal != 230 || rice.CarbsG != 0 || *rice.QuantityG != 180 || snapshot.Name != "Rice" {
		t.Errorf("rice = %+v", rice)
	}
	if oats.EntryMethod != "search" || oats.PhotoEstimate != nil || oats.QuantityG != nil {
		t.Errorf("oats = %+v", oats)
	}
	if _, err := svc.ConfirmPhotoMeal(context.Background(), uuid.New(), "lunch", items[2:]); message(err) != "Nothing to save" {
		t.Errorf("nothing valid: %v", err)
	}
	if _, err := svc.ConfirmPhotoMeal(context.Background(), uuid.New(), "tea", items); message(err) != "Pick a meal type" {
		t.Errorf("meal type: %v", err)
	}
}
