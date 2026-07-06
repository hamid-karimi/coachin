# Coachin — Formulas & Calculations

Single source of truth for every formula, constant, and decision rule in the app.

**How this file works:** edit the math here, then ask an AI (or yourself) to update the
code to match. Each section lists its **source of truth** file(s) — the code that must
stay in sync. When you change a number here, change it there. When you change it there,
change it here. They must never disagree.

> Values in **bold** are tunable knobs — safe to change. Formulas are the shape of the
> calculation — changing them is a behavior change, not just a tune.

---

## 1. XP & Levels

**Source of truth:** `lib/xp.ts`, and every `award_*` RPC in `supabase/migrations/`.

### Level from total XP

```
level = floor(totalXp / 1000) + 1
```

- **1000 XP per level**, flat (linear, not escalating). Level 1 is 0–999 XP.
- Progress within a level: `currentXp = totalXp mod 1000`, `nextLevelXp = 1000`.

### XP awards (each written to `xp_transactions`, then added to `profiles.xp`)

| Action | XP | Reason key | Idempotent by | Source |
|---|---|---|---|---|
| Routine workout log | `round(60 × sport.xp_multiplier)` | `workout_log:<sportId>` | — (one per submit) | `app/dashboard/actions.ts` |
| Plan item — run | **60** | `plan_item:<id>` | per item (undo compensates) | `complete_plan_item` |
| Plan item — strength | **60** | `plan_item:<id>` | per item | `complete_plan_item` |
| Plan item — stretch | **30** | `plan_item:<id>` | per item | `complete_plan_item` |
| Plan item — mobility | **30** | `plan_item:<id>` | per item | `complete_plan_item` |
| Plan item — recovery | **20** | `plan_item:<id>` | per item | `complete_plan_item` |
| Session log (how'd it go) | **10** | `session_log:<id>` | per log | `award_session_log_xp` |
| Meal log | **5** | `meal_log:<id>` | per log, **max 3/day** | `award_meal_xp` |
| Calorie-goal day | **30** | `calorie_goal:<date>` | per day | `award_day_adherence` |
| Goal achieved | **200** | `goal_achieved:<id>` | per goal | `achieve_goal` |
| Weekly check-in | **20** | `weekly_checkin:<planId>:<week>` | per week | weekly-checkins RPC |
| Group streak day | `LEAST(10 + streak × 2, 50)` | `group_streak:<gid>:<day>` | per group-day | `evaluate_group_streak` |

- **Base workout XP = 60** (a "60-minute session" unit); routine workouts scale it by the
  sport's `xp_multiplier`, plan items use fixed per-type values above.
- **Meal daily cap = 3** awarded meals per date; extras log but earn 0 (`capped: true`).
- Plan-item **undo** writes a compensating `-XP` txn (`plan_item_undo:<id>`) so
  done→undo→done nets zero. See `complete_plan_item`.

---

## 2. Streaks

### Personal streak
Stored on `profiles.current_streak` / `best_streak`. (Daily evaluation not yet a formula
here — logged for completeness; update this section when the scheduled job lands.)

### Group streak
**Source of truth:** `evaluate_group_streak` in `supabase/migrations/20260705140000_training_groups.sql`.

- A day counts as a **full day** only when **every** member logged a completed workout.
- Full day → `streak_count += 1`, `best_streak = max(best_streak, streak_count)`, and each
  member earns the group bonus.
- **Group bonus XP** per member on a full day:
  ```
  bonus = LEAST(10 + streak_count × 2, 50)
  ```
  Base **10**, **+2 per streak day**, capped at **50**.
- A missed day **freezes** the streak (records `all_trained = false`, streak unchanged, no
  XP) — it does **not** reset to 0.

---

## 3. Leagues / Tiers

**Source of truth:** `lib/tiers.ts` (display mapping), `profiles.league_tier` (stored value).

- Tiers, low→high: `bronze → silver → gold → platinum`.
- `tierFromLeague()` normalizes the stored string; unknown/missing → **`bronze`**.
- Tier *assignment* is a stored column, not yet a computed formula. When tier promotion
  rules are implemented, document the thresholds here.

---

## 4. Running math

**Source of truth:** `lib/running.ts`.

### Riegel race-time prediction
```
t2 = t1 × (d2 / d1) ^ 1.06
```
- **Exponent 1.06** — standard endurance fatigue factor. Predicts time at distance `d2`
  from a known time `t1` at distance `d1`. Degrades beyond ~50k (ultra = rough estimate).
- Goal suggestion uses the **longest available PB** (longer efforts predict better),
  searching `pb_full → pb_half → pb_10k → pb_5k`. Exact-distance match returns the PB
  as-is (no Riegel scaling).

### Reference race distances (km)
| Key | km |
|---|---|
| 5k | 5 |
| 10k | 10 |
| half | **21.0975** |
| full (marathon) | **42.195** |
| ultra / other | user-supplied |

### Time parsing / formatting
- `"mm:ss"` → `m×60 + s`; `"h:mm:ss"` → `h×3600 + m×60 + s`. Any negative/NaN part → null.
- Format: drop the hour field when 0; seconds always 2 digits.

---

## 5. Race-plan intake gates

**Source of truth:** `generatePlanAction` in `app/training/actions.ts`.

- Race distance must be **1–500 km**.
- Race date must be **≥ 4 weeks** away (`weeksUntil = floor(days / 7)`), else rejected.
- Plan length: `weeksTotal = min(weeksUntil, 24)` → **4–24 weeks**.
- Training days: integer **2–7** per week.
- **First-time-at-distance** = longest PB distance `< targetKm − 0.01` (no PB at or beyond
  the race distance).

---

## 6. Goal progress

**Source of truth:** `lib/goals.ts` (`goalProgress`).

- **Direction:** `down` when a usable `start` exists and `target < start` (e.g. weight
  loss); otherwise `up`.
- **Achieved:** `down` → `current ≤ target`; `up` → `current ≥ target`.
- **Percent (with a usable start):**
  ```
  total   = |target − start|
  covered = down ? (start − current) : (current − start)
  pct     = clamp(round(covered / total × 100), 0, 100)
  ```
- **Percent (no usable start** — start missing or equal to target):
  ```
  up   → round(current / target × 100)
  down → achieved ? 100 : round(target / current × 100)
  ```
  clamped to 0–100.

---

## 7. Weekly scorecard & check-in decision

**Source of truth:** `lib/scorecard.ts`.

### Scorecard
- **Trainable items** = all items except `meal_note`.
- **Adherence %:** `planned == 0 ? 100 : round1(completed / planned × 100)`.
- **Planned km:** sum of `run` items' `details.distance_km`.
- **Actual km:** sum of logged `actual.distance_km`; a completed run with **no** logged
  distance falls back to its planned distance.
- **Flags:** session logs whose `ai_feedback.flag` is `red` or `caution` (text = note →
  ai message → "Flagged session").

### Check-in decision (rules, first match wins)
1. Any **red flag** → **deload**.
2. Adherence **< 50%** and previous week also **< 50%** → **deload**.
3. Adherence **< 50%** (single week) → **repeat**.
4. Otherwise → **advance** (caution flags noted but don't change the decision).

- **Adherence threshold = 50%.** `round1(x) = round(x × 10) / 10`.

### Hypertrophy stall detection
- Needs **≥ 3 weeks** of strength logs. An exercise present in each of the **last 3 weeks**
  is *stalled* when `last.weight ≤ first.weight AND last.reps ≤ first.reps` (no progression
  in either weight or reps across the window).

---

## 8. Nutrition

**Source of truth:** `supabase/migrations/20260705120000_nutrition.sql`.

- **Meal log XP = 5**, capped at **3 awarded meals/day** (§1).
- **Calorie-goal bonus = 30 XP/day**, awarded when a *past* day's intake is **within ±10%**
  of the active `calorie_intake` goal **and ≥ 2 meals** were logged. Never evaluated for
  "today" (still in progress). Idempotent per date.

---

## 9. Plan weeks & calendar dates

**Source of truth:** `lib/dates.ts` (unit-tested in `lib/dates.test.ts`).

- **Week 1** = the Monday-anchored week containing the plan's `created_at`. Weeks are
  Monday-first; `day_of_week` still carries the real id (`0=Sun … 6=Sat`).
- `planWeekForDate(createdAt, date)` = `round((mondayOf(date) − mondayOf(createdAt)) / 7weeks) + 1`
  (1-based; `< 1` or `> weeks_total` means out of range).
- **Current week:** `planWeekOf = clamp(weeksSince(createdAt) + 1, 1, weeksTotal)`.
- **Check-in review week:** `lastElapsedPlanWeek = clamp(weeksSince(createdAt), 0, weeksTotal)`.
- `weeksSince` / `daysUntil` use whole (floored) weeks / ceil'd days.

---

_When behavior here changes, update the referenced source files and re-run
`pnpm test` — the date and scorecard math is unit-tested._
