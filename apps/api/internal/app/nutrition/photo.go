package nutrition

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/google/uuid"

	"github.com/hamid-karimi/coachin/apps/api/internal/app/apperr"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/aigen"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/jsnum"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/nutrition"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/profile"
)

// AI generates JSON, with images for vision prompts.
type AI interface {
	GenerateJSON(ctx context.Context, req aigen.Request) (aigen.Result, bool)
}

// Photo limits (the browser compresses before upload).
const (
	MaxPhotos     = 3
	MaxPhotoBytes = 2 << 20
	maxHintLength = 140
	maxBatchItems = 10
)

// Photo is one uploaded meal photo; Data is nil when it is over MaxPhotoBytes.
type Photo struct {
	Size int64
	Data []byte
}

// photoTypes are the image formats both AI providers read.
var photoTypes = map[string]bool{"image/jpeg": true, "image/png": true, "image/webp": true, "image/gif": true}

// EstimatePhoto asks the AI what's in 1–3 photos of one meal. Nothing is
// saved: the athlete reviews the items and confirms them.
func (s *Service) EstimatePhoto(ctx context.Context, userID uuid.UUID, photos []Photo, hint string) ([]aigen.EstimateItem, error) {
	if len(photos) == 0 {
		return nil, apperr.New(apperr.Invalid, "Choose a meal photo")
	}
	images := make([]aigen.Image, 0, MaxPhotos)
	for _, photo := range photos[:min(len(photos), MaxPhotos)] {
		if photo.Size > MaxPhotoBytes || photo.Data == nil {
			return nil, apperr.New(apperr.Invalid, "Each photo must be under 2MB (they should be pre-compressed)")
		}
		mime := http.DetectContentType(photo.Data)
		if !photoTypes[mime] {
			return nil, apperr.New(apperr.Invalid, "Photos must be JPEG, PNG, WebP, or GIF images")
		}
		images = append(images, aigen.Image{MIMEType: mime, Data: photo.Data})
	}
	var hintText, country *string
	if h := jsnum.Slice(strings.TrimSpace(hint), maxHintLength); h != "" {
		hintText = &h
	}
	stored, err := s.store.Country(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("load country: %w", err)
	}
	if c, ok := profile.ResolveCountry(stored, nil); ok {
		country = &c
	}

	result, ok := s.ai.GenerateJSON(ctx, aigen.MealPhotoRequest(images, hintText, country))
	if !ok {
		return nil, apperr.New(apperr.Unavailable, aigen.ErrEstimateUnavailable.Error())
	}
	items, err := aigen.ParseMealEstimate(result.Text)
	if err != nil {
		return nil, apperr.New(apperr.Unavailable, err.Error())
	}
	if len(items) == 0 {
		return nil, apperr.New(apperr.Invalid, "Couldn't recognize food in that photo — try another angle")
	}
	return items, nil
}

// ReviewedItem is a photo-review row as confirmed: an AI estimate (possibly
// edited) or a food the athlete added from search.
type ReviewedItem struct {
	aigen.EstimateItem
	FromSearch bool
}

// ConfirmPhotoMeal logs the reviewed items (each earns meal XP, 3 a day).
// Invalid rows are skipped; at most 10 are read.
func (s *Service) ConfirmPhotoMeal(ctx context.Context, userID uuid.UUID, mealType string, items []ReviewedItem) (string, error) {
	if !nutrition.MealTypes[mealType] {
		return "", apperr.New(apperr.Invalid, "Pick a meal type")
	}
	meals := []NewMeal{}
	for _, item := range items[:min(len(items), maxBatchItems)] {
		if !jsnum.IsFinite(item.EstKcal) || item.EstKcal <= 0 || item.EstKcal > nutrition.MaxMealKcal {
			continue
		}
		meals = append(meals, reviewedMeal(mealType, item))
	}
	if len(meals) == 0 {
		return "", apperr.New(apperr.Invalid, "Nothing to save")
	}
	awards, err := s.log(ctx, userID, meals)
	if err != nil {
		return "", err
	}
	noun := "items"
	if len(meals) == 1 {
		noun = "item"
	}
	return AwardMessage(fmt.Sprintf("%d %s logged", len(meals), noun), awards), nil
}

// reviewedMeal keeps the legacy mapping: amounts as reviewed (negatives → 0),
// kcal rounded; a photo item keeps its estimate snapshot.
func reviewedMeal(mealType string, item ReviewedItem) NewMeal {
	meal := NewMeal{
		MealType: mealType, Name: jsnum.Slice(item.Name, 200), EntryMethod: "photo",
		Nutrients: nutrition.Nutrients{
			Kcal: jsnum.Round(item.EstKcal), ProteinG: nutrition.NonNegative(item.ProteinG),
			CarbsG: nutrition.NonNegative(item.CarbsG), FatG: nutrition.NonNegative(item.FatG),
			SugarG: nutrition.NonNegative(item.SugarG), FiberG: nutrition.NonNegative(item.FiberG),
			SodiumMg: nutrition.NonNegative(item.SodiumMg),
		},
	}
	if q := item.EstQuantityG; jsnum.IsFinite(q) && q > 0 {
		meal.QuantityG = &q
	}
	if item.FromSearch {
		meal.EntryMethod = "search"
	} else {
		meal.PhotoEstimate, _ = json.Marshal(item.EstimateItem)
	}
	return meal
}
