package nutrition

// Meal XP (FORMULAS §2, §10): +5 per logged meal, at most 3 awarded meals per
// date; +30 once for a past day eaten within ±10% of the calorie goal.
const (
	MealLogXP       = 5
	MealAwardsDaily = 3
	CalorieGoalXP   = 30
	minMealsForGoal = 2
)

// MealAward is a new meal's XP given how many of its date's meals already hold
// an award; capped reports that the daily cap held it back.
func MealAward(awardedOnDate int) (xp int, capped bool) {
	if awardedOnDate >= MealAwardsDaily {
		return 0, true
	}
	return MealLogXP, false
}

// CalorieDayXP is a finished day's bonus: 2+ meals totalling within ±10% of the
// active calorie-intake goal (nil: no goal). Compared as total×10 against
// target×9 and target×11 so the edges are exact (legacy compared numerics).
func CalorieDayXP(target *float64, totalKcal float64, meals int) int {
	if target == nil || meals < minMealsForGoal {
		return 0
	}
	if totalKcal*10 < *target*9 || totalKcal*10 > *target*11 {
		return 0
	}
	return CalorieGoalXP
}
