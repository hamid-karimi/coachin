// Package tiers maps lifetime XP to league tiers (FORMULAS.md §3).
package tiers

import "strings"

// Tier is a league tier, lowest to highest: bronze, silver, gold, platinum.
type Tier string

// The four tiers, lowest to highest.
const (
	Bronze   Tier = "bronze"
	Silver   Tier = "silver"
	Gold     Tier = "gold"
	Platinum Tier = "platinum"
)

// MinXP is each tier's cumulative lifetime-XP threshold; a tier is never lost.
var MinXP = map[Tier]int64{
	Bronze:   0,
	Silver:   5_000,
	Gold:     20_000,
	Platinum: 50_000,
}

// highestFirst is the order FromXP checks thresholds in.
var highestFirst = []Tier{Platinum, Gold, Silver, Bronze}

// FromXP returns the tier reached with this lifetime XP.
func FromXP(xp int64) Tier {
	for _, tier := range highestFirst {
		if xp >= MinXP[tier] {
			return tier
		}
	}
	return Bronze
}

// FromLeague normalizes a stored profiles.league_tier value; unknown or
// missing values are bronze.
func FromLeague(league *string) Tier {
	if league == nil {
		return Bronze
	}
	tier := Tier(strings.ToLower(strings.TrimSpace(*league)))
	if _, known := MinXP[tier]; known {
		return tier
	}
	return Bronze
}
