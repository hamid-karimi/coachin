// Package streak is the personal streak + hearts state machine
// (FORMULAS.md §2). A day is settled once, after it ends.
package streak

// MaxHearts is how many missed required days a streak survives.
const MaxHearts = 3

// State is what profiles stores: current_streak, best_streak, hearts.
type State struct {
	Streak int `json:"streak"`
	Best   int `json:"best"`
	Hearts int `json:"hearts"`
}

// Day is one settled day across every routine and active plan.
type Day struct {
	// Trained: any completed log that date, of any discipline.
	Trained bool `json:"trained"`
	// RequiredDay: a routine or any active plan scheduled a non-meal item.
	RequiredDay bool `json:"requiredDay"`
}

// Next applies one settled day:
//   - trained → streak+1, best updated, regain a heart (capped)
//   - rest day (not required, not trained) → unchanged
//   - missed a required day with hearts → spend one, streak frozen
//   - missed a required day at 0 hearts → streak 0, hearts refill
func Next(state State, day Day) State {
	hearts := min(max(state.Hearts, 0), MaxHearts)

	if day.Trained {
		streak := state.Streak + 1
		return State{Streak: streak, Best: max(state.Best, streak), Hearts: min(hearts+1, MaxHearts)}
	}
	if !day.RequiredDay {
		return State{Streak: state.Streak, Best: state.Best, Hearts: hearts}
	}
	if hearts > 0 {
		return State{Streak: state.Streak, Best: state.Best, Hearts: hearts - 1}
	}
	return State{Streak: 0, Best: state.Best, Hearts: MaxHearts}
}
