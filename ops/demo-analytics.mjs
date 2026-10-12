import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import ts from "typescript";
import { validateAnalyticsEvent } from "../analytics-service/src/lib.mjs";

const campaign = "demo_20261012";
const tables = [
  { id: "cd62be60-5f11-4d4e-a217-92a7616c5201", key: "kazan", region: "Республика Татарстан", city: "Казань", venue: "ДЕМО: Семейный центр", label: "ДЕМО: Стол 1", offlineDays: 0 },
  { id: "cd62be60-5f11-4d4e-a217-92a7616c5202", key: "novosibirsk", region: "Новосибирская область", city: "Новосибирск", venue: "ДЕМО: Научный центр", label: "ДЕМО: Стол 2", offlineDays: 2 },
];
const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;
const tableIds = tables.map((table) => quote(table.id)).join(", ");
const campaignPrefix = `${campaign}_`;
const hasDemoPrefix = `left(event_id, ${campaignPrefix.length}) = ${quote(campaignPrefix)}`;
const expectedTables = tables.map((table) => `(id = ${quote(table.id)} AND region = ${quote(table.region)} AND city = ${quote(table.city)} AND venue = ${quote(table.venue)} AND table_label = ${quote(table.label)})`).join(" OR ");
const guard = `DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM devices WHERE id IN (${tableIds}) AND NOT (${expectedTables})) THEN
    RAISE EXCEPTION 'Refusing to modify a non-demo table';
  END IF;
  IF EXISTS (SELECT 1 FROM game_events WHERE device_id IN (${tableIds}) AND NOT (${hasDemoPrefix})) THEN
    RAISE EXCEPTION 'Refusing to modify a demo table containing non-demo results';
  END IF;
END $$;`;

const statusSql = `SELECT d.region, d.city, d.venue, d.table_label,
  COUNT(e.event_id)::int AS sessions, SUM(e.total_count)::int AS answers,
  ROUND(100.0 * SUM(e.correct_count) / NULLIF(SUM(e.total_count), 0)) AS accuracy,
  MIN(e.finished_at) AS first_game, MAX(e.finished_at) AS last_game, d.last_seen_at
FROM devices d LEFT JOIN game_events e ON e.device_id = d.id
WHERE d.id IN (${tableIds}) GROUP BY d.id ORDER BY d.city;`;

function randomGenerator(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

async function seedSql() {
  const source = await readFile(new URL("../app/game-data.ts", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
  const { FOODS, ROUND_SIZE } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
  const dayMs = 86_400_000;
  const hourMs = 3_600_000;
  const campaignStart = Date.parse("2026-10-12T00:00:00+03:00");
  const campaignNow = Math.min(Date.now(), campaignStart + dayMs - 1);
  assert(campaignNow > campaignStart, "The demo date has not started yet");
  const random = randomGenerator(20261012);
  const difficult = new Set(["l1-glazed-cereal", "l2-carrot-juice", "l2-glazed-curd", "l2-vitamin-cookies", "l3-orange-juice", "l3-granola", "l3-fat-free-dairy", "l3-fitness-bars"]);
  const statements = ["BEGIN;", `SELECT pg_advisory_xact_lock(hashtext('${campaign}'));`, guard];
  let sessions = 0;
  let answersCount = 0;

  for (const [tableIndex, table] of tables.entries()) {
    const events = [];
    for (let dayOffset = 13; dayOffset >= table.offlineDays; dayOffset -= 1) {
      const dailyCount = 8 + Math.floor(random() * 10) + (tableIndex === 0 ? 3 : 0);
      const dayStart = campaignStart - dayOffset * dayMs;
      const dayEnd = Math.min(dayStart + 20 * hourMs, campaignNow - 10 * 60_000);
      const activityStart = Math.min(dayStart + 8 * hourMs, dayEnd - hourMs);
      for (let index = 0; index < dailyCount; index += 1) {
        const levelRoll = random();
        const level = levelRoll < 0.45 ? 1 : levelRoll < 0.8 ? 2 : 3;
        const round = FOODS.filter((food) => food.level === level);
        for (let position = round.length - 1; position > 0; position -= 1) {
          const other = Math.floor(random() * (position + 1));
          [round[position], round[other]] = [round[other], round[position]];
        }
        const skill = 0.88 - (level - 1) * 0.07 + tableIndex * 0.035 + (random() - 0.5) * 0.14;
        let score = 0;
        let streak = 0;
        const answers = round.slice(0, ROUND_SIZE).map((food) => {
          const correct = random() < skill - (difficult.has(food.id) ? 0.2 : 0);
          const responseMs = 2_500 + Math.floor(random() * 6_500) + level * 700;
          streak = correct ? streak + 1 : 0;
          if (correct) score += 100 + Math.max(0, 40 - Math.floor(Math.max(0, responseMs - 3000) / 250)) + Math.min(streak * 10, 40);
          return { foodId: food.id, foodName: food.name, expected: food.category, selected: correct ? food.category : food.category === "good" ? "harmful" : "good", correct, responseMs };
        });
        const event = {
          eventId: `${campaign}_${table.key}_${dayOffset}_${index}`,
          gameId: "healthy-food", gameVersion: "1.0.0", level, score,
          correctCount: answers.filter((answer) => answer.correct).length,
          totalCount: answers.length,
          durationMs: answers.reduce((sum, answer) => sum + answer.responseMs, 0) + answers.length * 4_000,
          finishedAt: new Date(activityStart + (dayEnd - activityStart) * ((index + 1) / (dailyCount + 1))).toISOString(),
          answers,
        };
        const validation = validateAnalyticsEvent(event);
        assert(validation.ok, validation.error);
        events.push(validation.value);
      }
    }
    const activatedAt = new Date(campaignStart - 14 * dayMs).toISOString();
    const lastSeenAt = table.offlineDays ? new Date(Date.parse(events.at(-1).finishedAt) + 10 * 60_000).toISOString() : new Date(campaignNow - 5 * 60_000).toISOString();
    statements.push(`INSERT INTO devices (id, token_hash, region, city, venue, table_label, created_at, activated_at, last_seen_at)
VALUES (${quote(table.id)}, ${quote(randomBytes(32).toString("hex"))}, ${quote(table.region)}, ${quote(table.city)}, ${quote(table.venue)}, ${quote(table.label)}, ${quote(activatedAt)}, ${quote(activatedAt)}, ${quote(lastSeenAt)})
ON CONFLICT (id) DO NOTHING;`);
    const values = events.map((event) => `(${[event.eventId, table.id, event.gameId, event.gameVersion].map(quote).join(", ")}, ${[event.level, event.score, event.correctCount, event.totalCount, event.accuracy, event.durationMs].join(", ")}, ${quote(event.finishedAt)}, ${quote(JSON.stringify(event.answers))}::jsonb)`);
    statements.push(`INSERT INTO game_events (event_id, device_id, game_id, game_version, level, score, correct_count, total_count, accuracy, duration_ms, finished_at, answers)
VALUES ${values.join(",\n")}
ON CONFLICT (event_id) DO NOTHING;`);
    sessions += events.length;
    answersCount += events.reduce((sum, event) => sum + event.totalCount, 0);
  }
  statements.push("COMMIT;", statusSql);
  console.error(`Demo campaign ${campaign}: ${tables.length} tables, ${sessions} sessions, ${answersCount} answers.`);
  return statements.join("\n\n");
}

const [action, outputPath] = process.argv.slice(2);
let sql;
if (action === "seed") sql = await seedSql();
else if (action === "remove") sql = [
  "BEGIN;", `SELECT pg_advisory_xact_lock(hashtext('${campaign}'));`, guard,
  `DELETE FROM game_events WHERE device_id IN (${tableIds}) AND ${hasDemoPrefix};`,
  `DELETE FROM activation_codes WHERE used_by_device_id IN (${tableIds});`,
  `DELETE FROM devices WHERE id IN (${tableIds}) AND venue LIKE 'ДЕМО: %' AND table_label LIKE 'ДЕМО: %';`,
  "COMMIT;", statusSql,
].join("\n\n");
else if (action === "status") sql = statusSql;
else throw new Error("Usage: node ops/demo-analytics.mjs seed|remove|status [output.sql]");

if (outputPath) await writeFile(outputPath, `${sql}\n`, { mode: 0o600 });
else process.stdout.write(`${sql}\n`);
