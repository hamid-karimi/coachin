# Coachin — Formulas & Calculations

Single source of truth for every formula, constant, and decision rule in the app.

**How this file works:** edit the math here, then ask an AI (or yourself) to update the
code to match. Each section lists its **source of truth** file(s) — the code that must
stay in sync. When you change a number here, change it there. When you change it there,
change it here. They must never disagree.

> **Go rewrite in progress:** the `legacy/…` paths below are today's implementation and the
> reference for the port. Go paths (`apps/api/internal/domain/…`) are added next to them as
> each section is ported, and become the only source of truth in Phase 4. Each Go port
> replays golden vectors produced by the legacy code (`make golden` → `testdata/golden/`),
> so a formula change must land in both until the legacy copy is deleted.

> Values in **bold** are tunable knobs — safe to change. Formulas are the shape of the
> calculation — changing them is a behavior change, not just a tune.

---

## 1. XP & Levels

**Source of truth:** `legacy/lib/xp.ts`, and every `award_*` RPC in `legacy/supabase/migrations/`.
**Go:** `apps/api/internal/domain/xp` (`LevelProgress`, `Level`).

### Level from total XP

```
level = floor(totalXp / 1000) + 1
```

- **1000 XP per level**, flat (linear, not escalating). Level 1 is 0–999 XP.
- Progress within a level: `currentXp = totalXp mod 1000`, `nextLevelXp = 1000`.

### XP awards (each written to `xp_transactions`, then added to `profiles.xp`)

| Action | XP | Reason key | Idempotent by | Source |
|---|---|---|---|---|
| Routine workout log | `round(60 × sport.xp_multiplier)` | `workout_log:<sportId>:<date>` (legacy rows: `workout_log:<sportId>`) | per sport per day | Go: `apps/api/internal/app/today` (`LogWorkout`); legacy `legacy/app/dashboard/actions.ts` |
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
- **Multiplier default:** a sport with no (or zero) `xp_multiplier` counts as **1**
  (`xp.Multiplier`).
- **One routine log per sport per day** (rewrite): the API refuses a second log of the
  same sport on the same date (legacy only hid the button). Completion on Today is per
  sport: logging it completes every session of that sport that day.
- **Plan-item done window**: done only on the item's date or the day after (undo any
  time) — enforced by the API (`domain/planitem.LogWindowOpen`), not just the button.
- **"My week" estimate** (display only, awards nothing):
  `round(Σ over fixed sessions of 60 × multiplier)` — rounded once over the sum, not per
  session. Go: `apps/api/internal/domain/xp` (`EstimatedWeeklyXP`); legacy:
  `legacy/app/onboarding/page.tsx`.
- **Plan-item XP is per item** (idempotent by `plan_item:<id>`), so with **multiple active
  plans** each item's award stands on its own and the totals simply **sum across plans** —
  no double-counting, nothing special per discipline.
- **Meal daily cap = 3** awarded meals per date; extras log but earn 0 (`capped: true`).
- **Deleting a meal gives its XP back** (`-5`, reason `meal_log_undo:<id>`; Go
  `store.NutritionStore.DeleteMeal`). The cap counts the date's *remaining* awarded
  logs, so without the refund log → delete → log farmed unlimited XP (legacy bug); now a
  day nets at most 15 meal XP. Logs are awarded one at a time under the profile lock.
- Plan-item **undo** writes a compensating `-XP` txn (`plan_item_undo:<id>`) so
  done→undo→done nets zero. See `complete_plan_item`.

---

## 2. Streaks

### Personal streak + hearts
**Go:** `apps/api/internal/domain/streak` (`Next`).
**Source of truth:** `legacy/lib/streak.ts` (`nextStreakState`, unit-tested in `legacy/lib/streak.test.ts`),
mirrored by `evaluate_user_streak` (latest:
`legacy/supabase/migrations/20260706150000_streak_multi_plan.sql`, superseding the original in
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
**Source of truth:** `evaluate_group_streak` in `legacy/supabase/migrations/20260705140000_training_groups.sql`.

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

**Go:** `apps/api/internal/domain/tiers` (`FromXP`, `MinXP`, `FromLeague`).
**Source of truth:** `legacy/lib/tiers.ts` (`leagueTierFromXp` + `LEAGUE_TIER_MIN_XP`, unit-tested),
mirrored by `league_tier_for_xp` in `legacy/supabase/migrations/20260706110000_streak_and_league.sql`.

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

**Source of truth:** `legacy/lib/running.ts`.
**Go:** `apps/api/internal/domain/running`.

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

**Source of truth:** `generatePlanAction` in `legacy/app/training/actions.ts`.

- Race distance must be **1–500 km**.
- Race date must be **≥ 4 weeks** away (`weeksUntil = floor(days / 7)`), else rejected.
- Plan length: `weeksTotal = min(weeksUntil, 24)` → **4–24 weeks**.
- Training days: integer **2–7** per week.
- **First-time-at-distance** = longest PB distance `< targetKm − 0.01` (no PB at or beyond
  the race distance).

---

## 6. Goal progress

**Source of truth:** `legacy/lib/goals.ts` (`goalProgress`).
**Go:** `apps/api/internal/domain/goals` (`ProgressOf`, `TypeMeta`).

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

**Source of truth:** `legacy/lib/scorecard.ts`.
**Go:** `apps/api/internal/domain/scorecard` (`ComputeWeek`, `Decide`, `StalledLifts`).

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

**Source of truth:** `legacy/supabase/migrations/20260705120000_nutrition.sql`.

- **Meal log XP = 5**, capped at **3 awarded meals/day** (§1).
- **Calorie-goal bonus = 30 XP/day**, awarded when a *past* day's intake is **within ±10%**
  of the active `calorie_intake` goal **and ≥ 2 meals** were logged. Never evaluated for
  "today" (still in progress). Idempotent per date.

---

## 9. Plan weeks & calendar dates

**Source of truth:** `legacy/lib/dates.ts` (unit-tested in `legacy/lib/dates.test.ts`).
**Go:** `apps/api/internal/domain/dates` (takes `now` explicitly).

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

**Go:** `apps/api/internal/domain/nutrition` (`ComputeTargets`, `CanComputeTargets`).
**Source of truth:** `legacy/lib/nutrition-targets.ts` (unit-tested in
`legacy/lib/nutrition-targets.test.ts`). The AI meal-plan generator consumes these
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

## 11. Weekly quotas

**Go:** `apps/api/internal/domain/quotas` (`ProgressOf`).
**Source of truth:** `legacy/lib/weekly-quotas.ts` (`quotaProgress`, unit-tested in
`legacy/lib/weekly-quotas.test.ts`). Stored in `weekly_quotas` (one row per user × sport,
`sessions_per_week` 1–14).

- A quota is an **informational weekly target**: sport × N sessions per week, no fixed day.
- Fulfilled automatically by **completed** logs: `done` = count of **distinct dates** with a
  completed log of that sport within the **Mon–Sun local week** (two logs of the same sport
  on one day count as **1** — mirrors the streak's day-based counting).
- The week window (Monday-first, `mondayOf` / `toLocalYMD` in `legacy/lib/dates.ts`) is applied by
  the **caller** — `quotaProgress` only counts the logs it is given, so it works for past
  weeks too. `done` is raw and may exceed the target; capping the display is a UI concern.
- On the rewrite, `GET /routine` applies the window in `apps/api/internal/app/routine`
  (`MondayOf(now)` … +6 days, server time = UTC, as the legacy Vercel server did) and
  returns `doneThisWeek` per quota.
- **v1 has NO gameplay effect:** quotas create no required days and never touch streaks,
  hearts, or XP — progress display only.

## 12. Strength session volume (celebration stat)

**Go:** `apps/api/internal/domain/workout` (`TotalVolumeKg`, `VolumeEquivalence`, `ParsePrescription`, `NormalizeLoggedExercises`).
**Source of truth:** `legacy/lib/workout-sets.ts` (`totalVolumeKg`, `volumeEquivalence`,
`parsePrescription`, `normalizeLoggedExercises` — unit-tested in
`legacy/lib/workout-sets.test.ts`). Logged per set in `session_logs.actual.exercises`
as `[{name, sets: [{weight_kg, reps}]}]` (legacy flat rows
`{name, sets, reps, weight_kg}` are normalized to N identical set entries).

- **Total volume** = Σ over every set of `weight_kg × reps`, rounded to 0.1 kg.
  Non-finite/negative values count as 0; bodyweight sets (0 kg) add no volume.
- **Equivalence** = first threshold cleared in the descending lookup table
  (≥4000 elephant 🐘, ≥1500 small car 🚗, ≥700 grand piano 🎹, ≥400 horse 🐎,
  ≥180 refrigerator 🧊, ≥80 washing machine 🧺; below 80 → none).
- **NO gameplay effect:** volume never touches XP, streaks, hearts, or tiers.
  Session-log XP stays the fixed idempotent **+10** (§1); plan-item XP stays
  per-type. Volume is display + celebration only.
- Prescription prefill parses `plan_items.description ?? title` segments
  (`"Name NxM[-M2]"`, split on `" + "` or newlines); unparseable text falls
  back to a blank editor.

## 13. Supplements (daily stack)

**Go:** `apps/api/internal/domain/supplements` (`IsDue`, `Label`, `TakenRateOver`,
`Normalize`); due-today per stack entry in `apps/api/internal/app/today`, mutations in
`apps/api/internal/app/supplements`.
**Source of truth:** `supplements` + `supplement_logs` tables
(`20260708090000_supplements.sql`, schedules in
`20260709120000_supplement_schedules.sql`, coach read in
`20260709130000_supplements_coach_read.sql`), dashboard card
`legacy/app/dashboard/components/supplements-card.tsx`, actions in
`legacy/app/dashboard/supplements-actions.ts`, due-day + rate helpers
`legacy/lib/supplement-schedule.ts` and `legacy/lib/supplement-adherence.ts`.

- A supplement is a user-defined habit (name + optional dose text).
  Taking one inserts a `supplement_logs` row for the local date; the
  `(supplement_id, date)` unique constraint makes logging idempotent per day.
- "Taken today" = a log row exists for the local `toLocalYMD` date.
- **Schedule (`isSupplementDue`)** decides whether a supplement is *due* on a
  given weekday (0=Sun…6=Sat): `daily` → every day; `training_days` → only
  days with an active-plan session or recurring routine, degrading to daily
  when the user has **no** training structure at all (so it never vanishes);
  `custom` → the listed weekdays (an empty list reads as daily). The dashboard
  checklist and its "X of Y taken" tally cover only **due-today** supplements;
  the Manage sheet lists the whole stack.
- **Coach read**: a coach sees a trainee's stack read-only, gated on the same
  `nutrition_sharing_enabled` flag as meals (RLS mirrors
  `nutrition_coach_read`). The coach's "N/M due days" (`supplementTakenRate`)
  counts, over the last 7 days on/after each supplement's created date, the
  due days that have a log. Read-only — coaches never mutate the stack.
- **Submitted schedules** (`Normalize`): an unknown type becomes `daily`; days are kept
  only for `custom` (0–6, deduplicated, sorted) and are empty otherwise. Stack limit 20;
  name ≤ 60 characters, dose ≤ 40 (trimmed; a blank dose is stored as none).
- **NO gameplay effect:** supplements — including schedules and taken-rates —
  never award XP and never touch streaks, hearts, quotas, or tiers. The card
  is a reminder + logger only.

### Meal adherence (calendar, informational)

**Go:** `apps/api/internal/domain/nutrition` (`AdherenceForDay`; also `ToGrams`, `SummarizePeriod`, `BuildGroceryList`).
**Source of truth:** `legacy/lib/meal-adherence.ts` (`mealAdherenceForDay`, unit-tested),
consumed by `legacy/app/calendar/page.tsx` + `legacy/app/calendar/components/day-meals-line.tsx`.

- For a date with an active meal plan, adherence compares the plan's meals for
  that weekday against the day's `meal_logs`: **slots** = distinct planned
  `meal_type`s, a slot is "logged" when any log shares its type; **kcal ratio**
  = summed logged kcal ÷ summed planned kcal (null when nothing planned).
  Logged meal_types not in the plan are ignored for slots but still count
  toward logged kcal. No thresholds or verdicts — just the numbers.
- Logs are foods (search/photo/manual), plan items are AI dish titles — they
  **never string-match**; adherence is slot + kcal only, deliberately.
- Shown as one muted line on **today/past** calendar cells only; future days
  keep the plain "N meals planned" link. **Display-only:** no XP, streaks,
  hearts, or quotas.

## 14. Watch-file activity import

**Go:** `apps/api/internal/domain/activity` (`Sanitize`, `SplitImportable`).
**Source of truth:** `legacy/lib/activity-import.ts` (`sanitizeActivities`,
`splitImportableActivities`, unit-tested), `importActivitiesAction`
(`legacy/app/profile/actions.ts`), parser `legacy/lib/activity-parse.ts`.

- Uploaded .fit/.gpx files are parsed to run summaries (≤3 files/upload,
  ≤20 activities) and logged as **completed runs** (`logs` rows) from the
  Profile page.
- **Parsing** (Go: `adapters/watchfile` + `activity.FromTotals`; vectors
  `testdata/golden/activity-files.json` over `testdata/activity/`): FIT = the first
  session's total distance and timer time (elapsed time without one), average HR;
  GPX = haversine distance (R = 6,371,000 m) over the first track's points, first →
  last timestamp, mean point HR. A file is a run only at **≥ 200 m and ≥ 60 s**;
  distance to 0.01 km, duration to 0.1 min, pace = duration ÷ distance (unrounded
  inputs) to 0.01 min/km, HR rounded; the date is the start's UTC date.
- **XP = 60 × running sport multiplier per imported run** — the exact
  routine-log formula (§1), summed into one profile update.
- **Window**: only dates within the last **14 days** (and not in the future)
  import; older/future dates are skipped.
- **Dedup**: one completed log per sport×date — dates that already have a
  completed running log are skipped, and two files for the same date import
  once. Re-importing the same file is therefore a no-op.
- Streaks: already-settled past days are never re-evaluated; only un-settled
  days (e.g. today) can benefit from an imported run.

## 15. Progress charts & photo nudge

**Go:** `apps/api/internal/domain/progress` (`WeeklyVolume`, `WeeklyKm`, `ExerciseTopSets`, `WeightSeries`, `IsPhotoDue`).
**Source of truth:** `legacy/lib/progress-charts.ts` (`weeklyVolume`, `weeklyKm`,
`exerciseTopSets`, `weightSeries`) and `legacy/lib/progress-photo-nudge.ts`
(`isProgressPhotoDue`) — both unit-tested. Rendered on Profile → Progress;
the nudge renders on the dashboard.

- **Week buckets**: contiguous **Monday-anchored local weeks** (`mondayOf`),
  default **8 weeks** ending in the current week; zero weeks are kept so bars
  show gaps honestly. Session/day bucketing uses **local** dates, matching
  the rest of the date math (§9).
- **Weekly volume**: per-week sum of §12 session volume (strength logs only),
  rounded to whole kg. **Weekly running**: per-week sum of logged
  `distance_km`, rounded to 0.1.
- **Top-set trends**: per exercise (name case-insensitive), the heaviest
  set weight per local day; an exercise charts only with **≥ 3 logged
  sessions**, and the **top 3 exercises by session count** are shown.
- **Weight series**: measurements ascending, null/zero dropped, rounded to
  0.1 kg; a line needs **≥ 2 points** to render.
- **Progress-photo nudge**: shown to **active** users (current streak > 0 OR
  ≥ 1 log this week) whose newest `progress` photo is **> 28 days** old, or
  who have none. Quiet by design: a text link, no XP, no badge; it disappears
  by adding a photo. Photo caps (DB backstop + app): body_photo 5,
  analysis_report 3, progress 24.

---

_When behavior here changes, update the referenced source files and re-run
`pnpm test` — the date and scorecard math is unit-tested._
