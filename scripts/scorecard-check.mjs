/**
 * Fixture tests for lib/scorecard.ts (adaptive plan Phase 3).
 * Run with: node scripts/scorecard-check.mjs
 * (Node >= 23.6 strips the types from the imported .ts natively.)
 */
import assert from "node:assert/strict";
import { computeWeekScorecard, decideWeek } from "../lib/scorecard.ts";

const run = (details, is_completed = true) => ({
  item_type: "run",
  is_completed,
  details,
});
const strength = (is_completed = true) => ({
  item_type: "strength",
  is_completed,
  details: {},
});
const mealNote = () => ({
  item_type: "meal_note",
  is_completed: false,
  details: {},
});
const log = (actual = {}, flag = null, note = null) => ({
  actual,
  ai_feedback: flag ? { message: `msg-${flag}`, flag } : null,
  note,
});

let passed = 0;
function test(name, fn) {
  fn();
  passed += 1;
  console.log(`ok - ${name}`);
}

test("missed week (adherence 40, no previous) -> repeat", () => {
  const items = [
    run({ distance_km: 8 }),
    run({ distance_km: 10 }, false),
    run({ distance_km: 12 }, false),
    strength(true),
    strength(false),
    mealNote(),
  ];
  const card = computeWeekScorecard(items, []);
  assert.equal(card.planned_items, 5);
  assert.equal(card.completed_items, 2);
  assert.equal(card.adherence_pct, 40);
  const { decision, reasons } = decideWeek(card, null);
  assert.equal(decision, "repeat");
  assert.ok(reasons.length > 0);
});

test("two low weeks -> deload", () => {
  const items = [run({ distance_km: 8 }, false), strength(false), run({}, true)];
  const card = computeWeekScorecard(items, []);
  assert.ok(card.adherence_pct < 50);
  const previous = { ...card, adherence_pct: 33.3 };
  assert.equal(decideWeek(card, previous).decision, "deload");
});

test("red flag -> deload even with perfect adherence", () => {
  const items = [run({ distance_km: 8 }), strength(true)];
  const logs = [log({ distance_km: 8 }, "red", "sharp knee pain at 6k"), null];
  const card = computeWeekScorecard(items, logs);
  assert.equal(card.adherence_pct, 100);
  assert.deepEqual(card.red_flags, ["sharp knee pain at 6k"]);
  const { decision, reasons } = decideWeek(card, null);
  assert.equal(decision, "deload");
  assert.ok(reasons[0].includes("sharp knee pain"));
});

test("healthy week -> advance (caution flags surfaced, not blocking)", () => {
  const items = [
    run({ distance_km: 8 }),
    run({ distance_km: 12 }),
    strength(true),
    mealNote(),
  ];
  const logs = [log({ distance_km: 8.2 }), log({}, "caution", null), null];
  const card = computeWeekScorecard(items, logs);
  assert.equal(card.adherence_pct, 100);
  assert.deepEqual(card.caution_flags, ["msg-caution"]);
  const { decision, reasons } = decideWeek(card, {
    ...card,
    adherence_pct: 40,
  });
  assert.equal(decision, "advance");
  assert.equal(reasons.length, 2);
});

test("adherence math with 0 planned items -> 100, advance", () => {
  const card = computeWeekScorecard([mealNote()], []);
  assert.equal(card.planned_items, 0);
  assert.equal(card.adherence_pct, 100);
  assert.equal(decideWeek(card, null).decision, "advance");
});

test("actual_km falls back to planned distance for completed runs without a log", () => {
  const items = [
    run({ distance_km: 10 }), // completed, no log -> counts 10
    run({ distance_km: 8 }), // completed, log says 7.5 -> counts 7.5
    run({ distance_km: 12 }, false), // not completed, no log -> counts 0
  ];
  const logs = [null, log({ distance_km: 7.5 }), null];
  const card = computeWeekScorecard(items, logs);
  assert.equal(card.planned_km, 30);
  assert.equal(card.actual_km, 17.5);
});

console.log(`\n${passed} scorecard fixture tests passed`);
