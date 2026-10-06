import { createHmac, timingSafeEqual } from "node:crypto";

const FORBIDDEN_PLAYER_FIELDS = new Set([
  "playerId",
  "playerName",
  "playerAvatar",
  "profileId",
  "nickname",
  "email",
  "phone",
]);

export function cleanText(value, maximumLength = 120) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ").slice(0, maximumLength);
}

export function clampInteger(value, minimum, maximum) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  const integer = Math.round(number);
  return integer >= minimum && integer <= maximum ? integer : null;
}

export function hashSecret(value, pepper) {
  return createHmac("sha256", pepper).update(value).digest("hex");
}

export function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function containsForbiddenPlayerField(value) {
  if (!value || typeof value !== "object") return false;
  return Object.keys(value).some((key) => FORBIDDEN_PLAYER_FIELDS.has(key));
}

export function validateAnalyticsEvent(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, error: "Некорректное событие" };
  }
  if (containsForbiddenPlayerField(input)) {
    return { ok: false, error: "Персональные поля запрещены" };
  }

  const eventId = cleanText(input.eventId, 80);
  const gameId = cleanText(input.gameId, 80);
  const gameVersion = cleanText(input.gameVersion, 40);
  const level = clampInteger(input.level, 1, 50);
  const score = clampInteger(input.score, 0, 1_000_000);
  const correctCount = clampInteger(input.correctCount, 0, 1000);
  const totalCount = clampInteger(input.totalCount, 1, 1000);
  const durationMs = clampInteger(input.durationMs, 0, 86_400_000);
  const finishedAt = new Date(input.finishedAt);

  if (!/^[A-Za-z0-9_-]{12,80}$/.test(eventId)) return { ok: false, error: "Некорректный eventId" };
  if (!gameId || !gameVersion || level === null || score === null || correctCount === null || totalCount === null || durationMs === null) {
    return { ok: false, error: "Не заполнены параметры результата" };
  }
  if (correctCount > totalCount || Number.isNaN(finishedAt.getTime())) {
    return { ok: false, error: "Некорректные итоги игры" };
  }
  const now = Date.now();
  if (finishedAt.getTime() > now + 86_400_000 || finishedAt.getTime() < now - 5 * 365 * 86_400_000) {
    return { ok: false, error: "Некорректная дата результата" };
  }
  finishedAt.setUTCMinutes(0, 0, 0);
  if (!Array.isArray(input.answers) || input.answers.length > 100 || input.answers.length !== totalCount) {
    return { ok: false, error: "Некорректный список ответов" };
  }

  const answers = [];
  for (const rawAnswer of input.answers) {
    if (!rawAnswer || typeof rawAnswer !== "object" || containsForbiddenPlayerField(rawAnswer)) {
      return { ok: false, error: "Некорректный ответ" };
    }
    const foodId = cleanText(rawAnswer.foodId, 80);
    const foodName = cleanText(rawAnswer.foodName, 120);
    const expected = rawAnswer.expected === "good" || rawAnswer.expected === "harmful" ? rawAnswer.expected : null;
    const selected = rawAnswer.selected === "good" || rawAnswer.selected === "harmful" ? rawAnswer.selected : null;
    const responseMs = clampInteger(rawAnswer.responseMs, 0, 3_600_000);
    if (!foodId || !foodName || !expected || !selected || responseMs === null || typeof rawAnswer.correct !== "boolean") {
      return { ok: false, error: "Некорректные данные ответа" };
    }
    answers.push({ foodId, foodName, expected, selected, correct: rawAnswer.correct, responseMs });
  }

  return {
    ok: true,
    value: {
      eventId,
      gameId,
      gameVersion,
      level,
      score,
      correctCount,
      totalCount,
      accuracy: Math.round((correctCount / totalCount) * 100),
      durationMs,
      finishedAt: finishedAt.toISOString(),
      answers,
    },
  };
}

export function parseDateRange(searchParams) {
  const now = new Date();
  const defaultFrom = new Date(now.getTime() - 29 * 86_400_000);
  defaultFrom.setHours(0, 0, 0, 0);
  const requestedFrom = new Date(searchParams.get("from") ?? "");
  const requestedTo = new Date(searchParams.get("to") ?? "");
  const from = Number.isNaN(requestedFrom.getTime()) ? defaultFrom : requestedFrom;
  const to = Number.isNaN(requestedTo.getTime()) ? now : requestedTo;
  if (searchParams.get("to") && !Number.isNaN(requestedTo.getTime())) to.setHours(23, 59, 59, 999);
  return { from: from.toISOString(), to: to.toISOString() };
}
