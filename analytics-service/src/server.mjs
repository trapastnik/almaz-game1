import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createDatabase } from "./db.mjs";
import { cleanText, parseDateRange, safeEqual, validateAnalyticsEvent } from "./lib.mjs";

const requiredEnvironment = ["DATABASE_URL", "ANALYTICS_ADMIN_PASSWORD", "ANALYTICS_TOKEN_PEPPER"];
for (const name of requiredEnvironment) {
  if (!process.env[name]) throw new Error(`Missing required environment variable: ${name}`);
}

const port = Number(process.env.PORT ?? 3100);
const adminUser = process.env.ANALYTICS_ADMIN_USER ?? "admin";
const adminPassword = process.env.ANALYTICS_ADMIN_PASSWORD;
const retentionDays = process.env.ANALYTICS_RETENTION_DAYS ?? "730";
const publicDirectory = join(dirname(fileURLToPath(import.meta.url)), "../public");
const database = createDatabase({
  connectionString: process.env.DATABASE_URL,
  tokenPepper: process.env.ANALYTICS_TOKEN_PEPPER,
});
const activationAttempts = new Map();

function securityHeaders(contentType = "application/json; charset=utf-8") {
  return {
    "Content-Type": contentType,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Content-Security-Policy": "default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'",
  };
}

function sendJson(response, status, value, extraHeaders = {}) {
  response.writeHead(status, { ...securityHeaders(), ...extraHeaders });
  response.end(JSON.stringify(value));
}

function sendText(response, status, value, contentType = "text/plain; charset=utf-8", extraHeaders = {}) {
  response.writeHead(status, { ...securityHeaders(contentType), ...extraHeaders });
  response.end(value);
}

async function readJson(request, maximumBytes = 300_000) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maximumBytes) throw Object.assign(new Error("Слишком большой запрос"), { status: 413 });
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  } catch {
    throw Object.assign(new Error("Некорректный JSON"), { status: 400 });
  }
}

function isAdmin(request) {
  const authorization = request.headers.authorization ?? "";
  if (!authorization.startsWith("Basic ")) return false;
  try {
    const [user, password] = Buffer.from(authorization.slice(6), "base64").toString("utf8").split(/:(.*)/s, 2);
    return safeEqual(user, adminUser) && safeEqual(password, adminPassword);
  } catch {
    return false;
  }
}

function requireAdmin(request, response) {
  if (isAdmin(request)) return true;
  sendJson(response, 401, { error: "Требуется вход администратора" }, { "WWW-Authenticate": 'Basic realm="Almaz Analytics", charset="UTF-8"' });
  return false;
}

function bearerToken(request) {
  const authorization = request.headers.authorization ?? "";
  return authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
}

function allowActivationAttempt(request) {
  const address = cleanText(request.headers["x-real-ip"] || request.socket.remoteAddress || "unknown", 80);
  const now = Date.now();
  const recent = (activationAttempts.get(address) ?? []).filter((time) => now - time < 15 * 60_000);
  recent.push(now);
  activationAttempts.set(address, recent);
  return recent.length <= 10;
}

function csvCell(value) {
  const text = value == null ? "" : String(value);
  return /[";,\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

async function serveDashboard(pathname, response) {
  const files = {
    "/analytics": ["index.html", "text/html; charset=utf-8"],
    "/analytics/": ["index.html", "text/html; charset=utf-8"],
    "/analytics/app.js": ["app.js", "text/javascript; charset=utf-8"],
    "/analytics/styles.css": ["styles.css", "text/css; charset=utf-8"],
  };
  const entry = files[pathname];
  if (!entry) return false;
  const content = await readFile(join(publicDirectory, entry[0]));
  sendText(response, 200, content, entry[1]);
  return true;
}

async function handle(request, response) {
  const url = new URL(request.url, `http://${request.headers.host ?? "localhost"}`);

  if (url.pathname === "/api/analytics/health" && request.method === "GET") {
    await database.healthcheck();
    return sendJson(response, 200, { status: "ok" });
  }

  if (url.pathname.startsWith("/analytics")) {
    if (!requireAdmin(request, response)) return;
    if (await serveDashboard(url.pathname, response)) return;
    return sendJson(response, 404, { error: "Не найдено" });
  }

  if (url.pathname === "/api/analytics/activate" && request.method === "POST") {
    if (!allowActivationAttempt(request)) return sendJson(response, 429, { error: "Слишком много попыток. Повторите позже" });
    const body = await readJson(request, 10_000);
    const code = cleanText(body.code, 8);
    if (!/^\d{8}$/.test(code)) return sendJson(response, 400, { error: "Код состоит из 8 цифр" });
    const device = await database.activateDevice(code);
    if (!device) return sendJson(response, 400, { error: "Код недействителен или уже использован" });
    return sendJson(response, 200, device);
  }

  if (url.pathname === "/api/analytics/events" && request.method === "POST") {
    const token = bearerToken(request);
    const device = token ? await database.findDeviceByToken(token) : null;
    if (!device) return sendJson(response, 401, { error: "Стол не зарегистрирован" });
    const body = await readJson(request);
    if (!Array.isArray(body.events) || body.events.length < 1 || body.events.length > 50) {
      return sendJson(response, 400, { error: "В одной отправке должно быть от 1 до 50 событий" });
    }
    const events = [];
    for (const candidate of body.events) {
      const validation = validateAnalyticsEvent(candidate);
      if (!validation.ok) return sendJson(response, 400, { error: validation.error });
      events.push(validation.value);
    }
    await database.saveEvents(device.id, events);
    return sendJson(response, 200, { accepted: events.map((event) => event.eventId), receivedAt: new Date().toISOString() });
  }

  if (url.pathname === "/api/analytics/admin/activation-codes" && request.method === "POST") {
    if (!requireAdmin(request, response)) return;
    const body = await readJson(request, 20_000);
    try {
      const activation = await database.createActivationCode(body);
      return sendJson(response, 201, activation);
    } catch (error) {
      return sendJson(response, 400, { error: error.message });
    }
  }

  if (url.pathname === "/api/analytics/admin/summary" && request.method === "GET") {
    if (!requireAdmin(request, response)) return;
    const range = parseDateRange(url.searchParams);
    const summary = await database.getSummary({
      ...range,
      region: cleanText(url.searchParams.get("region"), 120),
      city: cleanText(url.searchParams.get("city"), 120),
      venue: cleanText(url.searchParams.get("venue"), 160),
      device: cleanText(url.searchParams.get("device"), 40),
      level: /^[1-9]\d*$/.test(url.searchParams.get("level") ?? "") ? url.searchParams.get("level") : "",
    });
    return sendJson(response, 200, summary);
  }

  if (url.pathname === "/api/analytics/admin/export.csv" && request.method === "GET") {
    if (!requireAdmin(request, response)) return;
    const range = parseDateRange(url.searchParams);
    const rows = await database.getCsvRows({
      ...range,
      region: cleanText(url.searchParams.get("region"), 120),
      city: cleanText(url.searchParams.get("city"), 120),
      venue: cleanText(url.searchParams.get("venue"), 160),
      device: cleanText(url.searchParams.get("device"), 40),
      level: /^[1-9]\d*$/.test(url.searchParams.get("level") ?? "") ? url.searchParams.get("level") : "",
    });
    const headers = ["Дата", "Регион", "Город", "Площадка", "Стол", "Игра", "Версия", "Уровень", "Очки", "Верно", "Всего", "Точность", "Время, мс"];
    const lines = rows.map((row) => [row.finished_at?.toISOString?.() ?? row.finished_at, row.region, row.city, row.venue, row.table_label, row.game_id, row.game_version, row.level, row.score, row.correct_count, row.total_count, row.accuracy, row.duration_ms].map(csvCell).join(";"));
    return sendText(response, 200, `\uFEFF${headers.join(";")}\n${lines.join("\n")}`, "text/csv; charset=utf-8", { "Content-Disposition": 'attachment; filename="analytics.csv"' });
  }

  return sendJson(response, 404, { error: "Не найдено" });
}

await database.initialize();
await database.deleteExpiredEvents(retentionDays);

const cleanupTimer = setInterval(() => {
  database.deleteExpiredEvents(retentionDays).catch((error) => console.error("Analytics retention cleanup failed", error.message));
}, 86_400_000);
cleanupTimer.unref();

const server = createServer((request, response) => {
  handle(request, response).catch((error) => {
    console.error("Analytics request failed", error.message);
    if (!response.headersSent) sendJson(response, error.status ?? 500, { error: error.status ? error.message : "Внутренняя ошибка" });
    else response.end();
  });
});

server.listen(port, "0.0.0.0", () => console.log(`Analytics service is listening on ${port}`));

async function shutdown() {
  clearInterval(cleanupTimer);
  server.close();
  await database.close();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
