import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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
  const [gameApp, gameData, storage, packageJson] = await Promise.all([
    readFile(new URL("app/GameApp.tsx", projectRoot), "utf8"),
    readFile(new URL("app/game-data.ts", projectRoot), "utf8"),
    readFile(new URL("app/storage.ts", projectRoot), "utf8"),
    readFile(new URL("package.json", projectRoot), "utf8"),
  ]);

  assert.match(gameApp, /Вход для взрослых/);
  assert.match(gameApp, /ADMIN_PIN/);
  assert.match(gameApp, /facts-rail/);
  assert.doesNotMatch(gameApp, /secret-corner|CORNER_SEQUENCE/);
  assert.match(gameApp, /RegistrationDialog/);
  assert.match(gameApp, /Новый игрок/);
  assert.match(gameApp, /LeaderboardScreen/);
  assert.match(gameApp, /requestFullscreen/);
  assert.match(gameData, /ROUND_SIZE = 20/);
  assert.match(storage, /indexedDB\.open/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
});
