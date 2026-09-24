# Evidence

Gathered by the orchestrator directly (surface is a single small component; no fan-out).

## Structural

- **Interactive elements for one "add":** 7 day buttons (`AddScheduleForm.tsx:66`) + N
  sport chips (7 in the live screenshot, `:103`) + time input (`:129`) + date input
  (`:141`) + Add button (`:151`) = **~16 controls to place one session.**
- **Transactional reset:** on submit the form clears day + sport and bumps a reset key
  (`:42–44`), so composing the "3+ days" the header asks for = **3+ full day→sport→Add
  loops.**
- **Duplicated affordance:** the live screenshot shows **four chips all labeled "Mobility"**
  (2× / 1.2× / 1× / 0.5×). `sportFromName` collapses every "Mobility"-named row to the same
  `mobility` sport, so all four render an identical icon + label (`sport-chip.tsx:16`,
  `:41`); only the trailing `×N` differs.
- **Surface duplication:** the form sits *above* `WeekAgenda`, which already renders the
  week being built (`page.tsx` order: `AddScheduleForm` then `WeekAgenda`).

## Visual (INFERRED from source + screenshot)

- Spacing/type obey the token system; chips use `rounded-full border px-3 py-1.5 text-sm`
  (`sport-chip.tsx:47`), day buttons `rounded-md border py-2.5 text-xs` (`AddScheduleForm.tsx:72`).
- **Multiplier is a loud element during planning:** boosted multipliers render
  `text-brand-ink font-bold` (`sport-chip.tsx:60`) — volt, bold — pulling the eye to XP math
  rather than the sport.
- **States checklist (this form):** disabled ✅ (`:70,:107,:135`), pending ✅ ("Adding…"
  `:155`), selected ✅ (`:74`, ring `:112`), error → toast (external), success → toast
  (external). **empty (sports = []) ❌** — `sports?.map` (`:99`) renders an empty wrap with no
  guidance. **focus-visible:** relies on browser default; no explicit ring on day/sport
  buttons.

## Copy & Honesty

- Strings: "Day", "Sport", "Time (optional)", "Repeat until (optional)", "Add"/"Adding…".
- **Jargon:** `1.5×`, `2×`, `1.2×`, `0.5×` multipliers shown with **no legend** at planning
  time (`sport-chip.tsx:63`, passed at `AddScheduleForm.tsx:117`).
- **Label→behavior mismatch:** four chips share the label "Mobility" but carry different XP
  values — the label doesn't convey the difference (`sport-chip.tsx:16`).
- No dark patterns, no marketing inflation. The multiplier values themselves are truthful.

## Weight & Friction (INFERRED)

- Client component, `useState` only, imports `SportChip`/`Input`/`Label`/`Button` — light.
- No idle animation; transitions on chips are hover/selection only. Dark mode honored via
  tokens. **No `prefers-reduced-motion` guard** on the transitions.

## Known gaps

- No running instance measured; JS bytes / TTI not captured (marked INFERRED).
- `sport_types` rows inspected via screenshot + `sportFromName` behavior, not a live query.
