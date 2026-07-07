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
- **Plan-item XP is per item** (idempotent by `plan_item:<id>`), so with **multiple active
  plans** each item's award stands on its own and the totals simply **sum across plans** —
  no double-counting, nothing special per discipline.
- **Meal daily cap = 3** awarded meals per date; extras log but earn 0 (`capped: true`).
- Plan-item **undo** writes a compensating `-XP` txn (`plan_item_undo:<id>`) so
  done→undo→done nets zero. See `complete_plan_item`.

---

## 2. Streaks

### Personal streak + hearts
**Source of truth:** `lib/streak.ts` (`nextStreakState`, unit-tested in `lib/streak.test.ts`),
mirrored by `evaluate_user_streak` (latest:
`supabase/migrations/20260706150000_streak_multi_plan.sql`, superseding the original in
`20260706110000_streak_and_league.sql`).

Stored on `profiles.current_streak` / `best_streak` / `hearts` (0–**3**), settled lazily up
to **yesterday** on dashboard/profile load (`streak_evaluated_date` tracks progress; first
run settles only yesterday, so history before the mechanic isn't punished). Today's
completion extends the streak at the next day's settle.

The streak is **day-based and global**, not per-plan. With **multiple active plans** (at most
one per discipline — e.g. a running plan and a hypertrophy plan) the two inputs below fold
every plan into a single per-day verdict:

- **Required day** = a routine scheduled that weekday **or** **any** active plan schedules a
  non-`meal_note` item on that date (each plan's plan-week is derived from its own
  `created_at`). It only takes one plan to make the day required.
- **Trained** = **any** completed log exists that date (routine or plan, any discipline).

So partial completion across disciplines still counts the day: **nailing your runs but
skipping the lifts keeps the streak** (the day was trained). Only a **fully-missed** required
day — no completed log at all — spends a heart. The heart economy below is unchanged.

Per settled day, given whether the user **trained** and whether it was a **required day**:

| Day | Effect |
|---|---|
| Trained | `streak += 1`; `best = max(best, streak)`; `hearts = min(hearts + 1, 3)` |
| Rest day (not required, not trained) | nothing changes — **streak safe** |
| Missed a required day, `hearts > 0` | `hearts -= 1` — streak **frozen** (not reset) |
| Missed a required day, `hearts == 0` | `streak = 0`; `hearts = 3` (reset + refill) |

- **Max hearts = 3.** A trained day regains one (capped). Logging on a rest day still
  counts as trained (extends the streak).
- It takes **3 misses to empty hearts, a 4th to reset** the streak.

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

**Source of truth:** `lib/tiers.ts` (`leagueTierFromXp` + `LEAGUE_TIER_MIN_XP`, unit-tested),
mirrored by `league_tier_for_xp` in `supabase/migrations/20260706110000_streak_and_league.sql`.

- Tiers, low→high: `bronze → silver → gold → platinum`.
- **Tier from lifetime XP (cumulative thresholds — only ever goes up):**

  | Tier | Min lifetime XP |
  |---|---|
  | bronze | **0** |
  | silver | **5,000** |
  | gold | **20,000** |
  | platinum | **50,000** |

- `profiles.league_tier` is kept in lockstep with `xp` by a DB trigger (`sync_league_tier`,
  fires on `xp` change), so the leaderboard — which reads the stored column — is always
  correct. `tierFromLeague()` maps that stored string to the badge union; unknown/missing
  → **`bronze`**.

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
- **Current week:** `planWeekOf = clamp(planWeekForDate(createdAt, today), 1, weeksTotal)`
  — Monday-anchored, so every surface (dashboard, calendar, training, onboarding,
  coaching) resolves "today" to the **same** week and shows the same sessions. (A
  rolling `weeksSince(createdAt) + 1` count disagreed whenever a plan wasn't
  created on a Monday.)
- **Check-in review week:** `lastElapsedPlanWeek = clamp(planWeekForDate(createdAt, today) − 1, 0, weeksTotal)`
  — the last fully-elapsed Monday-anchored week.
- `weeksSince` / `daysUntil` use whole (floored) weeks / ceil'd days.

---

## 10. Nutrition targets (meal plan)

**Source of truth:** `lib/nutrition-targets.ts` (unit-tested in
`lib/nutrition-targets.test.ts`). The AI meal-plan generator consumes these
targets; it never computes them itself.

- **BMR (Mifflin–St Jeor):** `10·kg + 6.25·cm − 5·age + s`, where `s = +5`
  (male), `−161` (female), `−78` (unspecified — the midpoint).
- **Activity factor** from weekly training days: `0 → 1.2`, `1–2 → 1.375`,
  `3–4 → 1.55`, `5–6 → 1.725`, `7 → 1.9`. `TDEE = BMR × factor`.
- **Goal adjustment** on TDEE: `lose −18%`, `maintain 0`, `gain +12%`,
  `recomp 0`. Target kcal is `max(adjusted, BMR × 1.1)`, rounded to 10 — never
  below ~BMR.
- **Macros:** protein `kg × {lose 2.2, recomp 2.2, maintain 1.6, gain 1.8}` g/kg;
  fat `= 25% of kcal ÷ 9`; carbs take the remaining kcal `÷ 4`.
- Missing height / weight / age → no target (the intake wizard asks the user to
  fill their profile).
- On plan generation the active `calorie_intake` goal is set to the target kcal
  so the nutrition tracker's bar and adherence bonus follow the plan.

---

_When behavior here changes, update the referenced source files and re-run
`pnpm test` — the date and scorecard math is unit-tested._
