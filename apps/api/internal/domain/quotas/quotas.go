// Package quotas is weekly "sport × N sessions" target progress
// (FORMULAS.md §11).
package quotas

// Target is one weekly quota.
type Target struct {
	SportTypeID     int64 `json:"sport_type_id"`
	SessionsPerWeek int   `json:"sessions_per_week"`
}

// Log is the part of a workout log the quota count needs.
type Log struct {
	SportTypeID *int64 `json:"sport_type_id"`
	Date        string `json:"date"`   // YYYY-MM-DD
	Status      string `json:"status"` // completed | skipped | missed
}

// Progress is one quota's standing for the week.
type Progress struct {
	SportTypeID int64 `json:"sport_type_id"`
	Target      int   `json:"target"`
	// Done counts distinct days with a completed log of the sport; it may
	// exceed Target (capping the display is the UI's job).
	Done int `json:"done"`
}

// ProgressOf scores each quota against the logs of one week. The caller
// passes only that week's logs; no date filtering happens here.
func ProgressOf(targets []Target, logs []Log) []Progress {
	daysBySport := map[int64]map[string]bool{}
	for _, log := range logs {
		if log.Status != "completed" || log.SportTypeID == nil {
			continue
		}
		days := daysBySport[*log.SportTypeID]
		if days == nil {
			days = map[string]bool{}
			daysBySport[*log.SportTypeID] = days
		}
		days[log.Date] = true
	}

	progress := make([]Progress, len(targets))
	for i, target := range targets {
		progress[i] = Progress{
			SportTypeID: target.SportTypeID,
			Target:      target.SessionsPerWeek,
			Done:        len(daysBySport[target.SportTypeID]),
		}
	}
	return progress
}
