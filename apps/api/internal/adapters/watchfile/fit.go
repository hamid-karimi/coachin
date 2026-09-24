package watchfile

import (
	"bytes"
	"time"

	"github.com/muktihari/fit/decoder"
	"github.com/muktihari/fit/profile/basetype"
	"github.com/muktihari/fit/profile/mesgdef"
	"github.com/muktihari/fit/profile/typedef"

	"github.com/hamid-karimi/coachin/apps/api/internal/domain/activity"
)

// ParseFIT reads the first session message of a checksum-valid FIT file.
func ParseFIT(data []byte, now time.Time) (activity.Summary, bool) {
	fit, err := decoder.New(bytes.NewReader(data)).Decode()
	if err != nil {
		return activity.Summary{}, false
	}
	for i := range fit.Messages {
		if fit.Messages[i].Num != typedef.MesgNumSession {
			continue
		}
		s := mesgdef.NewSession(&fit.Messages[i])
		var start *time.Time
		if !s.StartTime.IsZero() {
			start = &s.StartTime
		}
		var hr *float64
		if s.AvgHeartRate != basetype.Uint8Invalid {
			v := float64(s.AvgHeartRate)
			hr = &v
		}
		return activity.FromTotals(start, scaled(s.TotalDistance, 100), timerSeconds(s), hr, "fit", now)
	}
	return activity.Summary{}, false
}

// timerSeconds is the timer time (pauses excluded), else the elapsed time.
func timerSeconds(s *mesgdef.Session) float64 {
	if s.TotalTimerTime != basetype.Uint32Invalid {
		return scaled(s.TotalTimerTime, 1000)
	}
	return scaled(s.TotalElapsedTime, 1000)
}

// scaled applies a FIT field's scale; a missing field reads as 0.
func scaled(raw uint32, scale float64) float64 {
	if raw == basetype.Uint32Invalid {
		return 0
	}
	return float64(raw) / scale
}
