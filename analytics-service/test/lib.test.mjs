import assert from "node:assert/strict";
import test from "node:test";
import { csvCell, hashSecret, safeEqual, validateAnalyticsEvent } from "../src/lib.mjs";

const validEvent = {
  eventId: "event_1234567890",
  gameId: "healthy-food",
  gameVersion: "1.0.0",
  level: 2,
  score: 840,
  correctCount: 1,
  totalCount: 1,
  durationMs: 18_000,
  finishedAt: new Date().toISOString(),
  answers: [{
    foodId: "l2-popcorn",
    foodName: "Попкорн",
    expected: "harmful",
    selected: "harmful",
    correct: true,
    responseMs: 3200,
  }],
};

test("accepts an anonymous game result", () => {
  const result = validateAnalyticsEvent(validEvent);
  assert.equal(result.ok, true);
  assert.equal(result.value.accuracy, 100);
  assert.equal(new Date(result.value.finishedAt).getUTCMinutes(), 0);
});

test("rejects player identity fields", () => {
  const result = validateAnalyticsEvent({ ...validEvent, playerName: "Маша" });
  assert.equal(result.ok, false);
  assert.match(result.error, /Персональные/);
});

test("hashes activation secrets with a server pepper", () => {
  assert.equal(hashSecret("12345678", "first"), hashSecret("12345678", "first"));
  assert.notEqual(hashSecret("12345678", "first"), hashSecret("12345678", "second"));
});

test("compares admin credentials without leaking their length", () => {
  assert.equal(safeEqual("admin", "admin"), true);
  assert.equal(safeEqual("short", "a-much-longer-secret"), false);
});

test("neutralizes spreadsheet formulas in CSV cells", () => {
  assert.equal(csvCell("=2+2"), "'=2+2");
  assert.equal(csvCell("Обычное значение"), "Обычное значение");
  assert.equal(csvCell("Площадка; 1"), '"Площадка; 1"');
});
