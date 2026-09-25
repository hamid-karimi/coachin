# Profile module

Who you are and how you're doing: identity and stats, goals, progress charts and
measurements, the body profile that feeds the AI plans, and settings. Four tabs
(`?tab=overview|progress|body|settings`; anything else shows Overview).

## API (Go: `apps/api/internal/app/profile`)

| Call | What |
| --- | --- |
| `GET /me/overview` | `joinedAt`, `avatarUrl`, `workoutCount` (completed logs), `recentXp` (5 newest ledger rows with a display `label`, via `domain/xp.ReasonLabel`). Stats (XP, level, streak, hearts, tier) come from `GET /today`, which settles the streak first |
| `GET /goals` | `active` goals (newest first) with `current` (latest weight / body fat, today's kcal for calorie intake; null for untracked types) and `progress` (FORMULAS §6), and the 3 most recent `achieved` |
| `POST /goals` | `{goalType, target, targetDate?}` → "Goal created."; weight / body-fat goals start from the latest reading. 409 "You already have an active … goal" (one active per type). 400 "Pick a goal type", "Target must be a positive number", "Enter a valid target date" |
| `POST /goals/{id}/abandon` | "Goal removed." (no XP); 404 when not an active goal of yours |
| `GET /me/progress` | `measurements` (last 6), `weeklyVolume` / `weeklyKm` (8 weeks), `weight` (from those measurements), `topSets` (up to 3 exercises logged on 3+ days) — all from `domain/progress` (FORMULAS §15), 12 weeks of session logs |
| `POST /measurements` | `{weightKg?, bodyFatPct?}` → inserts the reading, refreshes the profile snapshot, and settles weight / body-fat goals (`goals.Settle`: baseline, or achieved + `goal_achieved:<id>` +200) in one transaction. "Measurement logged." or "Goal achieved: Weight 70kg! +200 XP" with `achievedGoals` |
| `DELETE /measurements/{id}` | "Measurement deleted." (the snapshot keeps its value, as in legacy) |
| `GET /me/body` · `PUT /me/body` | Birth date, sex, height, training history, country (+ the weight / body-fat snapshot and `nutritionSharing` on read). Blank fields clear. "Profile updated." |
| `POST /activities/import` | `{activities}` as returned by `POST /activities/parse` → sanitized (`activity.Sanitize`), last 14 days only, one run per date without a completed running log (FORMULAS §14); each becomes a completed log with a ledger row (`workout_log:<sport>:<date>`), XP 60 × running multiplier, all in one transaction under the profile lock. "Imported 2 runs · +120 XP · 1 skipped (…)"; 400 "Those days already have a logged run" / "Only runs from the last 14 days can be imported" / "No importable runs in those files" |
| `POST /photos` | Multipart `photos` + `set` (`body`: the analysis set, up to 5 per upload; `progress`: exactly one). Per file: sniffed JPEG/PNG/WebP ≤ 5 MB → re-encoded (`adapters/imaging`: EXIF orientation applied, ≤1600 px, JPEG q82, every metadata block dropped) → AI moderation (`aigen.ModerationRequest`, strict safety) sorts it into body photo / report or rejects it → object stored at `<user>/<uuid>.jpg`, then the row, capped (5 body photos, 3 reports, 24 progress) under the profile lock. Rejections are per file ("…; rejected — x.jpg: …"); moderation down stops the batch (502). Rate limited |
| `GET /photos` | `bodyPhotos`, `reports`, `progress` (id, createdAt), newest first; `analysis` (the newest body photo's) and `consented` |
| `POST /photos/analyze` | `{consent: true}` (else 400 "Tick the consent box to run AI analysis") → stamps `ai_photo_consent_at` once, sends the newest 5 body photos in one strict AI call (`aigen.BodyAnalysisRequest`), stores `{build_notes, posture_notes, training_considerations}` on the newest photo. "Body analysis ready."; 400 "Upload at least one body photo first"; 502 when AI is down. The training and meal-plan prompts read the build + posture notes |
| `POST /photos/{id}/extract` | A report → `{weightKg, bodyFatPct, muscleMassKg, notes}` (numbers only when clearly read; also kept on the report row). Nothing is saved as a measurement until the user confirms. 400 when neither weight nor body fat was read; 404 for a non-report |
| `GET /photos/{id}` | Streams the JPEG after the ownership check (storage is private; no signed URLs). `Cache-Control: private, max-age=31536000, immutable` — an id never gets other bytes |
| `DELETE /photos/{id}` | Row first, then the object (an orphaned object is harmless; a row without one is not). "Photo deleted." |
| `PUT /me/nutrition-sharing` | `{enabled}` → the active coach may read meal logs and the meal plan (RLS) |

## Structure

- `page.tsx` — resolves the tab, prefetches the header (`/today`, `/me/overview`) and
  that tab's data (`app/lib/profile-data.ts`), hydrates; no logic
- `loading.tsx` — skeleton
- `hooks/use-profile.ts` — suspense queries and mutations (each refetches what it moves:
  a measurement refetches progress, body, goals, Today, and the overview)
- `lib/profile.ts` — tabs, goal metadata / labels / status lines, available goal types,
  `featuredGoal` (Today's strip), measurement lines, form → request bodies (unit-tested)
- `components/`
  - `profile-identity.tsx` — avatar in the level ring, name, email · joined, chips;
    `profile-tabs.tsx` (links); `profile-tab-content.tsx` (tab → sections map);
    `profile-section.tsx`
  - Overview: `profile-stats.tsx` (stat grid + hearts), `goals-section.tsx`
    (`goal-form.tsx`, remove confirm), `training-links.tsx`, `recent-xp.tsx`
  - Progress: `progress-charts.tsx` (design-system `progress-chart`),
    `measurements-section.tsx` (log form, confetti on a goal payout, list with delete),
    `progress-photos-section.tsx` (add one, grid, compare two — oldest left — and
    `progress-share.tsx`: "Share progress" loads both photos and opens the two-photo card:
    weeks between, month range)
  - `photo-tile.tsx` — a stored photo (`<img src="/api/v1/photos/{id}">`) in a 3:4 frame
    + the corner ✕; `lib/photos.ts` — url, labels, upload form, compare picking (tested)
  - Body: `body-profile-form.tsx` (uses `components/ui/native-select`),
    `body-photos-section.tsx` (picker with previews via `hooks/use-pending-photos.ts`,
    photo grid, `body-analysis-panel.tsx` — consent + result —, report rows with
    "Extract metrics" → `report-metrics-form.tsx` "Save as measurement", delete confirm), `activity-import-section.tsx` (reuses the training module's `useParseActivities` and
    `activityLine`; "Log N runs" refetches Today, the calendar, My week, the overview)
  - Settings: `join-coach-form.tsx` ("My coach": redeem an invite code via
    `POST /coaching/join`; shown only while Community is off), `nutrition-sharing-toggle.tsx`, theme, `change-password-form.tsx`,
    `logout-button.tsx`

## Differences from legacy

- Goals start from the latest reading, and a goal without a start takes the next reading
  as its baseline — legacy saved no start, so a weight-loss goal paid +200 XP on the
  next reading above the target (FORMULAS §6).
- The measurement, snapshot, and goal payouts are one transaction; two goals achieved at
  once say "+400 XP" (legacy said "+200 XP" regardless).
- Recent XP labels drop the row id ("Goal achieved", not "goal achieved:3f2a…") and show
  refunds as negative ("-5").
- Two measurements on one day chart in the order logged (legacy reversed them).
- Training history is capped at 2,000 characters.
- Photos: types are sniffed from the bytes (legacy trusted the browser's type); caps
  hold under concurrent uploads (checked in the insert, under the profile lock); images
  stream through the API instead of hour-long signed URLs; moderation uses Claude first
  (a refusal counts as a safety block) with Gemini's strict filter as the fallback; the
  batch message no longer ends in "..".
- The plan prompts read the newest analyzed **body photo** only; legacy read any kind,
  so a newer report extraction hid the analysis (the prompt got no body notes).
- Imported runs write XP ledger rows and are serialized under the profile lock (legacy
  bumped the balance only, with a read-then-write race).
