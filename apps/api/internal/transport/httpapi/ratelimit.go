package httpapi

import (
	"net"
	"net/http"
	"sync"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"golang.org/x/time/rate"
)

// limiter is a per-key token bucket held in memory (one API process).
type limiter struct {
	mu       sync.Mutex
	every    rate.Limit
	burst    int
	visitors map[string]*visitor
	lastScan time.Time
}

type visitor struct {
	limiter  *rate.Limiter
	lastSeen time.Time
}

// newLimiter allows burst requests at once, refilling one per interval.
func newLimiter(interval time.Duration, burst int) *limiter {
	return &limiter{every: rate.Every(interval), burst: burst, visitors: map[string]*visitor{}}
}

const idleVisitor = 15 * time.Minute

func (l *limiter) allow(key string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	now := time.Now()
	if now.Sub(l.lastScan) > time.Minute {
		for k, v := range l.visitors {
			if now.Sub(v.lastSeen) > idleVisitor {
				delete(l.visitors, k)
			}
		}
		l.lastScan = now
	}
	v, ok := l.visitors[key]
	if !ok {
		v = &visitor{limiter: rate.NewLimiter(l.every, l.burst)}
		l.visitors[key] = v
	}
	v.lastSeen = now
	return v.limiter.Allow()
}

// rateLimited throttles an operation per client IP.
func rateLimited(api huma.API, l *limiter) func(huma.Context, func(huma.Context)) {
	return func(ctx huma.Context, next func(huma.Context)) {
		ip, _, err := net.SplitHostPort(ctx.RemoteAddr())
		if err != nil {
			ip = ctx.RemoteAddr()
		}
		if !l.allow(ip) {
			ctx.SetHeader("Retry-After", "60")
			_ = huma.WriteErr(api, ctx, http.StatusTooManyRequests, "Too many attempts. Please wait a minute and try again.")
			return
		}
		next(ctx)
	}
}
