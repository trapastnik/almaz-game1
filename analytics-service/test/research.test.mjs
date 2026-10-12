import assert from "node:assert/strict";
import test from "node:test";
import { buildRegionalComparison } from "../public/research-model.js";
import { readAnalyticsFilters, readComparisonOptions, researchCsv } from "../src/research.mjs";

const cohort = (region, level, sessions, mean_accuracy, demo_sessions = 0) => ({ region, level, sessions, mean_accuracy, answers: sessions * 20, demo_sessions });

test("regional comparison removes advantages from a different mix of difficulty levels", () => {
  const data = { cohorts: [cohort("А", 1, 90, 90), cohort("А", 2, 10, 50), cohort("Б", 1, 10, 90), cohort("Б", 2, 90, 50)], products: [] };
  const result = buildRegionalComparison(data);
  assert.deepEqual(result.commonLevels, [1, 2]);
  assert.equal(result.regionRows[0].rawAccuracy, 86);
  assert.equal(result.regionRows[1].rawAccuracy, 54);
  assert.equal(result.regionRows[0].adjustedAccuracy, 70);
  assert.equal(result.regionRows[1].adjustedAccuracy, 70);
  assert.equal(result.regionRows[0].difference, 0);
  assert.equal(result.regionRows[0].smallSample, true);
});

test("comparison only uses levels present in every selected region", () => {
  const data = { cohorts: [cohort("А", 1, 50, 80), cohort("А", 2, 40, 60), cohort("Б", 1, 30, 70)], products: [] };
  const result = buildRegionalComparison(data);
  assert.deepEqual(result.commonLevels, [1]);
  assert.equal(result.regionRows[0].adjustedAccuracy, 80);
  assert.equal(result.regionRows[0].comparableSessions, 50);
  assert.equal(result.regionRows[0].difference, 10);
  assert.equal(result.regionRows[0].smallSample, false);
});

test("disjoint levels and an empty selection never produce invented comparisons", () => {
  const data = { cohorts: [cohort("А", 1, 50, 80), cohort("Б", 2, 50, 60)], products: [] };
  assert.equal(buildRegionalComparison(data).regionRows[0].adjustedAccuracy, null);
  assert.equal(buildRegionalComparison(data).regionRows[0].difference, null);
  assert.deepEqual(buildRegionalComparison(data, []).regionRows, []);
});

test("product gaps use rates and exclude undersized cells", () => {
  const data = { cohorts: [cohort("А", 1, 50, 80, 50), cohort("Б", 1, 50, 70)], products: [
    { region: "А", level: 1, food_id: "apple", food_name: "Яблоко", answers: 100, mistakes: 20, good_as_harmful: 20, harmful_as_good: 0 },
    { region: "Б", level: 1, food_id: "apple", food_name: "Яблоко", answers: 20, mistakes: 10, good_as_harmful: 10, harmful_as_good: 0 },
  ] };
  const result = buildRegionalComparison(data);
  assert.equal(result.productRows[0].gap, 30);
  assert.equal(result.productRows[0].cells["Б"].errorRate, 50);
  assert.equal(result.demoSessions, 50);
  assert.equal(buildRegionalComparison(data, null, 30, 21).productRows[0].gap, null);
  const selected = buildRegionalComparison(data, ["А"]);
  assert.equal(selected.sessions, 50);
  assert.equal(selected.productRows[0].gap, null);
});

test("a region name cannot modify product cell prototypes", () => {
  const result = buildRegionalComparison({ cohorts: [cohort("__proto__", 1, 50, 80)], products: [
    { region: "__proto__", level: 1, food_id: "apple", food_name: "Яблоко", answers: 50, mistakes: 10, good_as_harmful: 10, harmful_as_good: 0 },
  ] });
  assert.equal(result.productRows[0].cells.__proto__.errorRate, 20);
  assert.equal(Object.getPrototypeOf(result.productRows[0].cells), null);
});

test("research filters default to real observations and one game version", () => {
  const filters = readAnalyticsFilters(new URLSearchParams());
  assert.equal(filters.dataSource, "real");
  assert.equal(filters.gameId, "healthy-food");
  assert.equal(filters.gameVersion, "1.0.0");
  for (const values of [{ data: "other" }, { level: "1e4" }, { level: "51" }]) {
    assert.throws(() => readAnalyticsFilters(new URLSearchParams(values)), { status: 400 });
  }
});

test("comparison options preserve an explicitly empty selection and reject invalid thresholds", () => {
  assert.equal(readComparisonOptions(new URLSearchParams()).regions, null);
  assert.deepEqual(readComparisonOptions(new URLSearchParams("selection=explicit")).regions, []);
  assert.deepEqual(readComparisonOptions(new URLSearchParams("selection=explicit&compareRegion=А&compareRegion=Б")).regions, ["А", "Б"]);
  for (const value of ["0", "", "10001", "-1", "1.5", "bad"]) {
    assert.throws(() => readComparisonOptions(new URLSearchParams({ minSessions: value })), { status: 400 });
  }
});

test("CSV reproduces the comparison and includes dataset provenance and error directions", () => {
  const data = {
    cohorts: [cohort("А", 1, 50, 80, 50), cohort("Б", 1, 50, 70, 50)],
    products: [{ region: "А", level: 1, food_id: "apple", food_name: "=FORMULA", answers: 50, mistakes: 10, good_as_harmful: 10, harmful_as_good: 0 }],
    range: { from: "2026-09-30T21:00:00.000Z", to: "2026-10-12T20:59:59.999Z" },
    gameId: "healthy-food", gameVersion: "1.0.0", dataSource: "demo", city: "", venue: "",
  };
  const options = readComparisonOptions(new URLSearchParams());
  const csv = researchCsv(data, options);
  assert.match(csv, /Точность с равным весом уровней/);
  assert.match(csv, /2026-10-01T00:00:00.000\+03:00/);
  assert.match(csv, /healthy-food;1.0.0;demo/);
  assert.match(csv, /А;50;1000;50;80;80;10;50;50;нет;1;50;80/);
  const products = researchCsv(data, options, "products");
  assert.match(products, /Полезное назвали вредным/);
  assert.match(products, /'=FORMULA;50;10;20;10;0;нет/);
  assert.equal(researchCsv(data, { ...options, regions: [] }).split("\n").length, 2);
});

test("identical product IDs on different levels are not pooled", () => {
  const result = buildRegionalComparison({ cohorts: [cohort("А", 1, 50, 80), cohort("А", 2, 50, 70)], products: [
    { region: "А", level: 1, food_id: "apple", food_name: "Яблоко", answers: 50, mistakes: 0, good_as_harmful: 0, harmful_as_good: 0 },
    { region: "А", level: 2, food_id: "apple", food_name: "Яблоко", answers: 50, mistakes: 25, good_as_harmful: 25, harmful_as_good: 0 },
  ] });
  assert.equal(result.productRows.length, 2);
  assert.equal(result.productRows[1].cells["А"].errorRate, 50);
});
