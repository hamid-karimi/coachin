package usda

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
)

// fdc fakes FoodData Central with the documented response shapes.
func fdc(t *testing.T) *httptest.Server {
	t.Helper()
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Query().Get("api_key") != "key" {
			http.Error(w, "forbidden", http.StatusForbidden)
			return
		}
		switch r.URL.Path {
		case "/foods/search":
			if r.URL.Query().Get("dataType") != "Foundation,SR Legacy" || r.URL.Query().Get("query") != "banana" {
				t.Errorf("query = %v", r.URL.Query())
			}
			_, _ = w.Write([]byte(`{"foods":[
				{"fdcId":173944,"description":"Bananas, raw","foodNutrients":[
					{"nutrientNumber":"208","value":89.4},{"nutrientNumber":"203","value":1.09},
					{"nutrientNumber":"205","value":22.84},{"nutrientNumber":"204","value":0.33},
					{"nutrientNumber":"269","value":12.23},{"nutrientNumber":"291","value":2.6},
					{"nutrientNumber":"307","value":1}]},
				{"fdcId":1,"description":"Water","foodNutrients":[{"nutrientNumber":"208","value":0}]}]}`))
		case "/food/173944":
			if r.URL.Query().Get("format") != "abridged" {
				t.Errorf("format = %q", r.URL.Query().Get("format"))
			}
			_, _ = w.Write([]byte(`{"fdcId":173944,"description":"Bananas, raw","foodNutrients":[
				{"number":"208","amount":89},{"number":203,"amount":1.09},{"number":"307","amount":1.4}]}`))
		case "/food/2":
			_, _ = w.Write([]byte(`{"fdcId":2,"description":"Oats","foodNutrients":[
				{"nutrient":{"number":"208"},"amount":379},{"nutrient":{"number":"203"},"amount":13.15}]}`))
		default:
			http.NotFound(w, r)
		}
	}))
}

func TestSearch(t *testing.T) {
	srv := fdc(t)
	defer srv.Close()
	foods, err := New("key", srv.URL).Search(context.Background(), "banana")
	if err != nil {
		t.Fatal(err)
	}
	if len(foods) != 1 {
		t.Fatalf("foods = %+v (zero-kcal entries must drop)", foods)
	}
	b := foods[0]
	if b.FdcID != 173944 || b.Name != "Bananas, raw" || b.Kcal != 89 || b.ProteinG != 1.1 || b.CarbsG != 22.8 ||
		b.FatG != 0.3 || b.SugarG != 12.2 || b.FiberG != 2.6 || b.SodiumMg != 1 {
		t.Errorf("banana = %+v", b)
	}
}

func TestFood(t *testing.T) {
	srv := fdc(t)
	defer srv.Close()
	c := New("key", srv.URL)
	abridged, err := c.Food(context.Background(), 173944)
	if err != nil || abridged.Kcal != 89 || abridged.ProteinG != 1.1 || abridged.SodiumMg != 1 || abridged.FdcID != 173944 {
		t.Fatalf("abridged = %+v, %v", abridged, err)
	}
	full, err := c.Food(context.Background(), 2)
	if err != nil || full.Kcal != 379 || full.ProteinG != 13.2 {
		t.Fatalf("full = %+v, %v", full, err)
	}
	if _, err := c.Food(context.Background(), 3); !errors.Is(err, ErrNotFound) {
		t.Errorf("missing food: %v", err)
	}
	if _, err := New("wrong", srv.URL).Search(context.Background(), "banana"); err == nil {
		t.Error("a rejected key must fail")
	}
	if New("", "").Enabled() {
		t.Error("no key must disable the client")
	}
}
