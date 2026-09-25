package store

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/hamid-karimi/coachin/apps/api/internal/app/today"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/nutrition"
	"github.com/hamid-karimi/coachin/apps/api/internal/store/queries"
)

// activeMenu is the active meal plan and its meals (day, then plan order).
type activeMenu struct {
	plan  queries.GetActiveMealPlanRow
	items []queries.ListMealPlanItemsRow
}

// loadActiveMenu returns nil without an active meal plan.
func loadActiveMenu(ctx context.Context, q *queries.Queries, userID uuid.UUID) (*activeMenu, error) {
	plan, err := q.GetActiveMealPlan(ctx, userID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	items, err := q.ListMealPlanItems(ctx, queries.ListMealPlanItemsParams{PlanID: plan.ID, UserID: userID})
	if err != nil {
		return nil, err
	}
	return &activeMenu{plan: plan, items: items}, nil
}

// MealPlanDay is the active meal plan's menu for a weekday.
func (s *TodayStore) MealPlanDay(ctx context.Context, userID uuid.UUID, weekday int) (*today.MealPlanDay, error) {
	var day *today.MealPlanDay
	err := s.asUser(ctx, userID, func(q *queries.Queries) error {
		menu, err := loadActiveMenu(ctx, q, userID)
		if err != nil || menu == nil {
			return err
		}
		day = &today.MealPlanDay{KcalTarget: menu.plan.KcalTarget, Meals: []today.MenuMeal{}}
		for _, item := range menu.items {
			if int(item.DayOfWeek) == weekday {
				day.Meals = append(day.Meals, today.MenuMeal{ID: item.ID, MealType: item.MealType, Title: item.Title, Kcal: item.Kcal})
			}
		}
		return nil
	})
	return day, err
}

// MealPlanWeek is the active meal plan's menu by weekday.
func (s *CalendarStore) MealPlanWeek(ctx context.Context, userID uuid.UUID) (map[int][]nutrition.MealSlot, bool, error) {
	var menu map[int][]nutrition.MealSlot
	err := s.asUser(ctx, userID, func(q *queries.Queries) error {
		active, err := loadActiveMenu(ctx, q, userID)
		if err != nil || active == nil {
			return err
		}
		menu = map[int][]nutrition.MealSlot{}
		for _, item := range active.items {
			day := int(item.DayOfWeek)
			menu[day] = append(menu[day], nutrition.MealSlot{MealType: item.MealType, Kcal: item.Kcal})
		}
		return nil
	})
	return menu, menu != nil, err
}

// MealSlots are the user's logged meals dated from..to, by date.
func (s *CalendarStore) MealSlots(ctx context.Context, userID uuid.UUID, from, to string) (map[string][]nutrition.MealSlot, error) {
	var rows []queries.ListMealSlotsBetweenRow
	err := s.asUser(ctx, userID, func(q *queries.Queries) (err error) {
		rows, err = q.ListMealSlotsBetween(ctx, queries.ListMealSlotsBetweenParams{UserID: userID, FromDate: from, ToDate: to})
		return err
	})
	byDate := map[string][]nutrition.MealSlot{}
	for _, r := range rows {
		byDate[r.Date] = append(byDate[r.Date], nutrition.MealSlot{MealType: r.MealType, Kcal: r.Kcal})
	}
	return byDate, err
}
