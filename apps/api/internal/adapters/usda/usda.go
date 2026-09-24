// Package usda reads foods from USDA FoodData Central (free key, 1000 req/h):
// only on the athlete's explicit "Search USDA database", never per keystroke.
package usda

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/hamid-karimi/coachin/apps/api/internal/domain/jsnum"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/nutrition"
)

// DefaultBaseURL is the FoodData Central API root.
const DefaultBaseURL = "https://api.nal.usda.gov/fdc/v1"

// Food is a USDA food with its nutrients per 100 g.
type Food = nutrition.USDAFood

// ErrNotFound means USDA has no food with that id.
var ErrNotFound = errors.New("usda food not found")

// Client talks to FoodData Central.
type Client struct {
	apiKey  string
	baseURL string
	http    *http.Client
}

// New builds a client; an empty key disables it (Enabled reports false).
func New(apiKey, baseURL string) *Client {
	if baseURL == "" {
		baseURL = DefaultBaseURL
	}
	return &Client{apiKey: apiKey, baseURL: strings.TrimRight(baseURL, "/"), http: &http.Client{Timeout: 15 * time.Second}}
}

// Enabled reports whether a key is configured.
func (c *Client) Enabled() bool { return c.apiKey != "" }

// Search returns up to 6 Foundation / SR Legacy matches with calories.
func (c *Client) Search(ctx context.Context, query string) ([]Food, error) {
	params := url.Values{"query": {query}, "pageSize": {"6"}, "dataType": {"Foundation,SR Legacy"}}
	var payload struct {
		Foods []rawFood `json:"foods"`
	}
	if err := c.get(ctx, "/foods/search", params, &payload); err != nil {
		return nil, err
	}
	foods := []Food{}
	for _, raw := range payload.Foods {
		if food := raw.food(); food.Name != "" && food.Kcal > 0 {
			foods = append(foods, food)
		}
	}
	return foods, nil
}

// Food reads one food by id.
func (c *Client) Food(ctx context.Context, fdcID int64) (Food, error) {
	var raw rawFood
	if err := c.get(ctx, "/food/"+strconv.FormatInt(fdcID, 10), url.Values{"format": {"abridged"}}, &raw); err != nil {
		return Food{}, err
	}
	food := raw.food()
	if food.Name == "" {
		return Food{}, ErrNotFound
	}
	food.FdcID = fdcID
	return food, nil
}

func (c *Client) get(ctx context.Context, path string, params url.Values, out any) error {
	params.Set("api_key", c.apiKey)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+path+"?"+params.Encode(), nil)
	if err != nil {
		return err
	}
	res, err := c.http.Do(req)
	if err != nil {
		return fmt.Errorf("usda request: %w", err)
	}
	defer func() { _ = res.Body.Close() }()
	if res.StatusCode == http.StatusNotFound {
		return ErrNotFound
	}
	if res.StatusCode != http.StatusOK {
		return fmt.Errorf("usda: status %d", res.StatusCode)
	}
	if err := json.NewDecoder(res.Body).Decode(out); err != nil {
		return fmt.Errorf("usda: decode: %w", err)
	}
	return nil
}

// rawFood covers the search and the abridged/full detail shapes.
type rawFood struct {
	FdcID         int64         `json:"fdcId"`
	Description   string        `json:"description"`
	FoodNutrients []rawNutrient `json:"foodNutrients"`
}

// rawNutrient: search results carry nutrientNumber/value, abridged details
// number/amount, full details nutrient.number/amount.
type rawNutrient struct {
	NutrientNumber json.RawMessage `json:"nutrientNumber"`
	Number         json.RawMessage `json:"number"`
	Nutrient       *struct {
		Number json.RawMessage `json:"number"`
	} `json:"nutrient"`
	Value  *float64 `json:"value"`
	Amount *float64 `json:"amount"`
}

func (n rawNutrient) number() string {
	for _, raw := range []json.RawMessage{n.NutrientNumber, n.Number} {
		if s := numberText(raw); s != "" {
			return s
		}
	}
	if n.Nutrient != nil {
		return numberText(n.Nutrient.Number)
	}
	return ""
}

// numberText reads "208" or 208.
func numberText(raw json.RawMessage) string {
	var s string
	if json.Unmarshal(raw, &s) == nil {
		return s
	}
	var f float64
	if json.Unmarshal(raw, &f) == nil {
		return strconv.FormatFloat(f, 'f', -1, 64)
	}
	return ""
}

func (n rawNutrient) amount() float64 {
	if n.Value != nil {
		return *n.Value
	}
	if n.Amount != nil {
		return *n.Amount
	}
	return 0
}

// USDA nutrient numbers.
const (
	energyKcal = "208"
	protein    = "203"
	carbs      = "205"
	fat        = "204"
	sugars     = "269"
	fiber      = "291"
	sodium     = "307"
)

// food maps the nutrients with the legacy rounding: kcal and sodium whole,
// the rest to 0.1; a missing nutrient is 0.
func (r rawFood) food() Food {
	values := map[string]float64{}
	for _, n := range r.FoodNutrients {
		if num := n.number(); num != "" {
			if _, seen := values[num]; !seen {
				values[num] = n.amount()
			}
		}
	}
	tenth := func(num string) float64 { return jsnum.Round(values[num]*10) / 10 }
	return Food{
		FdcID: r.FdcID,
		Name:  jsnum.Slice(r.Description, 200),
		Per100g: nutrition.Per100g{
			Kcal: jsnum.Round(values[energyKcal]), ProteinG: tenth(protein), CarbsG: tenth(carbs), FatG: tenth(fat),
			SugarG: tenth(sugars), FiberG: tenth(fiber), SodiumMg: jsnum.Round(values[sodium]),
		},
	}
}
