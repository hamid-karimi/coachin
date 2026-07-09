# Share cards + progress photos + progress charts — execution plan

Branch `feat/share-progress`. Owner intent: shareable training/food cards with
a user photo (growth loop), occasional progress photos, and progress charts.
Decisions baked in: cards are **deterministic canvas composition** (NOT AI
image editing — latency/cost/brand-consistency; AI only suggests captions
later), Web Share API with download fallback, privacy-first defaults (no body
weight on cards, photos only when explicitly picked, nothing auto-posts).

Per phase: implement → `pnpm exec tsc --noEmit` · `pnpm exec eslint <changed>`
· `pnpm test` → commit. Update QA-ONBOARDING.md + module READMEs + WORKLOG.md
per CLAUDE.md. FORMULAS.md governs XP — **nothing here awards XP**.

## Phase 0 — discovery (done, inline)

- `body_photos` (`supabase/migrations/*body_photos*`): kind IN
  ('body_photo','analysis_report'), `analysis` jsonb, consent timestamp on
  profiles, **trigger caps body_photo at 5/user** — progress timeline needs a
  new kind with its own cap.
- No chart library installed; precedent is hand-rolled SVG bars in
  `app/nutrition/components/nutrition-trends.tsx` ("Seven-day kcal bars").
- Volume/PR data: `session_logs.actual.exercises` per-set (normalize via
  `lib/workout-sets.ts` `normalizeLoggedExercises`); weight series in
  `body_measurements`; adherence via `lib/scorecard.ts`; runs in `logs` +
  `session_logs.actual.distance_km`.
- Brand palette for canvas (CSS vars unreadable in canvas — mirror as consts
  with a comment pointing at globals.css): volt #D4F531, ember #FF5C1F,
  amber #FFB03A (see CONFETTI_COLORS in use-confetti-burst.ts), dark card bg.
- Share delivery: `navigator.canShare({files})` → `navigator.share` (mobile
  share sheet); fallback = object-URL download link. Both need a File from
  `canvas.toBlob("image/png")`.
- Meal photos: photo-mode uploads are compressed client-side
  (`lib/client-image.ts` `compressImage`) but NOT stored today (only
  estimates persist) — meal cards let the user re-pick a photo at share time.

## Phase 1 — share-card engine + first two cards

1. `lib/share-card.ts` (pure data shaping, unit-tested): card model
   `ShareCardData { headline; stats: {label; value}[]; equivalence?; date;
   watermark }` + builders `sessionShareCard(exercises, totalVolumeKg,
   prs?)`, `mealShareCard(items|planned meal)`. No DOM here.
2. `components/share/share-card-canvas.ts` (client util): draws a card on an
   offscreen canvas per the handoff spec below (formats: story 1080×1920,
   square 1080×1080); input = ShareCardData + optional user photo File;
   output = PNG File. Photo drawn cover-fit; no photo → brand gradient
   background.
3. `components/share/ShareCardSheet.tsx` (client, BottomSheet): live preview
   (canvas → dataURL <img>), format toggle (Story | Square), optional photo
   picker (reuses `compressImage`), Share button (Web Share API, download
   fallback), "Save image" link. Design-system placement + story only if it
   can render without server actions (it can — pure client).
4. Entry points: (a) `SessionLogSheet` success state — "Share it" button next
   to the volume line, prefilled with volume/equivalence/exercise count;
   (b) nutrition day summary — "Share today" with kcal + macros;
   (c) meal row overflow — per-meal card.

### Handoff spec — share card (both formats)

**Layout (story 1080×1920)**: photo region = top 62% (cover-crop, center),
bottom 38% = solid #0B0B0C panel; a 240px vertical gradient
(transparent → #0B0B0C) bridges the seam. No photo: full-bleed diagonal
gradient #0B0B0C → #1A2005 with a 12%-opacity volt dumbbell/flame glyph.
Square 1080×1080: photo top 55%, panel 45%, same gradient bridge (160px).

**Panel content (both formats, 64px side padding)**:
- Headline (e.g. "Upper body — Day A" / "Tuesday's fuel"), Inter/system-ui
  Bold 64px, #FFFFFF, max 2 lines, ellipsis.
- Stat row: up to 3 stats. Value = Bold 96px volt #D4F531 (tabular digits),
  label = Medium 36px #A1A1AA uppercase, letter-spacing 0.08em.
- Equivalence line (optional): Regular 40px #E4E4E7, emoji kept ("that's a
  small car 🚗").
- Footer bar: date (36px #71717A) left; watermark right — volt dot 20px +
  "coachin" Semibold 40px #FFFFFF. Watermark is NOT removable in v1.

**States**: preview loading = pulse skeleton in the sheet; photo decode
failure = toast + fall back to gradient card; share unsupported =
download-only button ("Save image"); canvas export failure = error toast,
sheet stays open.

**Privacy/content rules**: never render body weight or kcal *targets missed*;
only additive stats (volume, sessions, streak, kcal eaten only on food
cards). Photo EXIF is stripped by canvas re-encode by construction.

**A11y**: preview `<img alt="Share card preview: <headline>, <stats>">`;
format toggle = radiogroup; Share button announces success/failure via toast.

## Phase 2 — progress photos timeline + compare

1. Migration: extend `body_photos.kind` CHECK with `'progress'`; replace the
   5-cap trigger to apply per-kind (body_photo 5, progress 24); index
   (user_id, kind, created_at).
2. Profile "Progress photos" section: grid timeline (month labels), upload
   (compressImage, consent gate reused), delete; compare view = pick two →
   side-by-side with dates (simple 50/50 layout, no slider in v1).
3. Nudge: dashboard quiet hint when last progress photo ≥28 days old
   (dismiss = takes you to profile). No XP.
4. Share tie-in: compare view → "Share progress" builds a two-photo card via
   the Phase 1 engine (photo left/right split, dates + weeks-between stat).
   Explicit confirmation copy: "This image contains your photos."

## Phase 3 — progress charts ("Progress" section on profile)

1. `lib/progress-charts.ts` (pure, unit-tested aggregators):
   `weeklyVolume(sessionLogs)` (Mon-week buckets, kg),
   `exerciseTopSets(sessionLogs, minSessions=3)` (per exercise: date → max
   weight_kg), `weightSeries(measurements)`, `weeklyAdherence(scorecards…)`
   or reuse scorecard outputs, `weeklyKm(logs, sessionLogs)`.
2. Design-system chart primitives (SVG, no lib, + stories):
   `TrendLine` (line + dots + min/max labels), `WeekBars` (extend the
   nutrition-trends bar pattern into a shared component). Tokens only —
   `text-brand`, `bg-secondary`, no raw hex.
3. Profile "Progress" section (server page fetch + client-free render):
   weight trend (when ≥2 measurements), weekly volume (≥1 strength log),
   top-set trend for the 3 most-logged exercises, weekly km (when runs
   exist). Each chart hides itself without data; section shows an explainer
   empty state when everything is empty.
4. Follow-up candidate (not in this plan): promote to `/progress` route +
   add RPE-at-same-weight and pace-at-HR ("self-evidence engine").

## Final — verification

tsc, eslint, tests, build; QA-ONBOARDING: new journey "Share & progress"
(share a session card, upload progress photos, check charts render/degrade);
README updates (nutrition, dashboard, profile-less modules as applicable);
WORKLOG entry. Anti-pattern greps: no XP changes, no AI image calls,
watermark present in share-card-canvas.
