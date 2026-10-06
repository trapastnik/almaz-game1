import { FOODS } from "./game-data";
import {
  countPendingAnalytics,
  deleteAnalyticsEvents,
  listPendingAnalytics,
  queueAnalyticsEvent,
} from "./storage";
import type { AnalyticsEvent, GameSession } from "./storage";

const DEVICE_STORAGE_KEY = "healthy-food-analytics-device";
const LAST_SYNC_STORAGE_KEY = "healthy-food-analytics-last-sync";
const GAME_VERSION = "1.0.0";

export type AnalyticsDevice = {
  deviceId: string;
  token: string;
  region: string;
  city: string;
  venue: string;
  tableLabel: string;
};

export type AnalyticsState = {
  configured: boolean;
  pending: number;
  syncing: boolean;
  online: boolean;
  lastSync?: string;
  device?: Omit<AnalyticsDevice, "token">;
  error?: string;
};

let activeFlush: Promise<AnalyticsState> | null = null;

function createAnalyticsId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `analytics_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function readDevice(): AnalyticsDevice | null {
  try {
    const value = window.localStorage.getItem(DEVICE_STORAGE_KEY);
    if (!value) return null;
    const device = JSON.parse(value) as AnalyticsDevice;
    return device.deviceId && device.token && device.region && device.city && device.venue && device.tableLabel ? device : null;
  } catch {
    return null;
  }
}

function publicDevice(device: AnalyticsDevice | null): AnalyticsState["device"] {
  if (!device) return undefined;
  return {
    deviceId: device.deviceId,
    region: device.region,
    city: device.city,
    venue: device.venue,
    tableLabel: device.tableLabel,
  };
}

export async function getAnalyticsState(overrides: Partial<AnalyticsState> = {}): Promise<AnalyticsState> {
  const device = readDevice();
  return {
    configured: Boolean(device),
    pending: await countPendingAnalytics(),
    syncing: false,
    online: navigator.onLine,
    lastSync: window.localStorage.getItem(LAST_SYNC_STORAGE_KEY) ?? undefined,
    device: publicDevice(device),
    ...overrides,
  };
}

export async function queueSessionForAnalytics(session: GameSession): Promise<AnalyticsState> {
  const foodNames = new Map(FOODS.map((food) => [food.id, food.name]));
  const event: AnalyticsEvent = {
    eventId: createAnalyticsId(),
    gameId: session.gameId,
    gameVersion: GAME_VERSION,
    level: session.level ?? 1,
    score: session.score,
    correctCount: session.correctCount,
    totalCount: session.totalCount,
    durationMs: session.durationMs,
    finishedAt: session.finishedAt,
    answers: session.answers.map((answer) => ({
      ...answer,
      foodName: foodNames.get(answer.foodId) ?? "Продукт из прошлой версии",
    })),
    queuedAt: new Date().toISOString(),
  };
  await queueAnalyticsEvent(event);
  return flushAnalytics();
}

async function runFlush(): Promise<AnalyticsState> {
  const device = readDevice();
  if (!device) return getAnalyticsState();
  if (!navigator.onLine) return getAnalyticsState({ error: "Нет подключения к интернету" });

  try {
    let pending = await listPendingAnalytics();
    while (pending.length) {
      const response = await fetch("/api/analytics/events", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${device.token}`,
        },
        body: JSON.stringify({
          events: pending.map((event) => ({
            eventId: event.eventId,
            gameId: event.gameId,
            gameVersion: event.gameVersion,
            level: event.level,
            score: event.score,
            correctCount: event.correctCount,
            totalCount: event.totalCount,
            durationMs: event.durationMs,
            finishedAt: event.finishedAt,
            answers: event.answers,
          })),
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Центральный сервер недоступен");
      await deleteAnalyticsEvents(Array.isArray(result.accepted) ? result.accepted : pending.map((event) => event.eventId));
      pending = await listPendingAnalytics();
    }
    const lastSync = new Date().toISOString();
    window.localStorage.setItem(LAST_SYNC_STORAGE_KEY, lastSync);
    return getAnalyticsState({ lastSync });
  } catch (error) {
    return getAnalyticsState({ error: error instanceof Error ? error.message : "Ошибка синхронизации" });
  }
}

export function flushAnalytics(): Promise<AnalyticsState> {
  if (!activeFlush) {
    activeFlush = runFlush().finally(() => {
      activeFlush = null;
    });
  }
  return activeFlush;
}

export async function activateAnalytics(code: string): Promise<AnalyticsState> {
  const response = await fetch("/api/analytics/activate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "Не удалось подключить стол");
  const device = result as AnalyticsDevice;
  window.localStorage.setItem(DEVICE_STORAGE_KEY, JSON.stringify(device));
  return flushAnalytics();
}
