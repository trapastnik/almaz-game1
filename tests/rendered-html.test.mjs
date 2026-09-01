import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("renders the game entry screen", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Вредно-полезно<\/title>/i);
  assert.match(html, /Загружаем игроков/);
  assert.doesNotMatch(html, /codex-preview|SkeletonPreview|react-loading-skeleton/i);
});

test("keeps local game data and adult controls in the product source", async () => {
  const [gameApp, gameData, storage, packageJson, styles, sunnyTheme, forestTheme, spaceTheme, productAssets] = await Promise.all([
    readFile(new URL("app/GameApp.tsx", projectRoot), "utf8"),
    readFile(new URL("app/game-data.ts", projectRoot), "utf8"),
    readFile(new URL("app/storage.ts", projectRoot), "utf8"),
    readFile(new URL("package.json", projectRoot), "utf8"),
    readFile(new URL("app/globals.css", projectRoot), "utf8"),
    readFile(new URL("public/themes/sunny-meadow.webp", projectRoot)),
    readFile(new URL("public/themes/story-forest.webp", projectRoot)),
    readFile(new URL("public/themes/space-kitchen.webp", projectRoot)),
    readdir(new URL("public/products/level-1/", projectRoot)),
  ]);

  assert.match(gameApp, /Вход для взрослых/);
  assert.match(gameApp, /ADMIN_PIN/);
  assert.match(gameApp, /facts-rail/);
  assert.doesNotMatch(gameApp, /secret-corner|CORNER_SEQUENCE/);
  assert.match(gameApp, /RegistrationDialog/);
  assert.match(gameApp, /Новый игрок/);
  assert.match(gameApp, /LeaderboardScreen/);
  assert.match(gameApp, /Результаты игроков/);
  assert.match(gameApp, /FEEDBACK_DURATION_MS = 2400/);
  assert.match(gameApp, /THEME_STORAGE_KEY/);
  assert.match(gameApp, /Стиль игры/);
  assert.match(gameApp, /requestFullscreen/);
  assert.match(gameData, /ROUND_SIZE = 20/);
  assert.equal(gameData.match(/\{ id: "l[123]-/g)?.length, 60);
  assert.equal(gameData.match(/\{ id: "l1-/g)?.length, 20);
  assert.equal(gameData.match(/\{ id: "l2-/g)?.length, 20);
  assert.equal(gameData.match(/\{ id: "l3-/g)?.length, 20);
  assert.match(gameData, /FoodCategory = "good" \| "harmful"/);
  assert.match(gameData, /getFoodImage/);
  assert.match(storage, /level\?: GameLevel/);
  assert.match(storage, /indexedDB\.open/);
  assert.match(styles, /sunny-meadow\.webp/);
  assert.match(styles, /story-forest\.webp/);
  assert.match(styles, /space-kitchen\.webp/);
  assert.ok(sunnyTheme.length > 50_000);
  assert.ok(forestTheme.length > 50_000);
  assert.ok(spaceTheme.length > 50_000);
  assert.equal(productAssets.filter((file) => file.endsWith(".webp")).length, 20);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
});
