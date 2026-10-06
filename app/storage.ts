import type { FoodCategory, GameLevel } from "./game-data";

export type Player = {
  id: string;
  name: string;
  avatar: string;
  color: string;
  createdAt: string;
};

export type AnswerRecord = {
  foodId: string;
  expected: FoodCategory;
  selected: FoodCategory;
  correct: boolean;
  responseMs: number;
};

export type GameSession = {
  id: string;
  gameId: "healthy-food";
  playerId: string;
  playerName: string;
  playerAvatar: string;
  level?: GameLevel;
  score: number;
  correctCount: number;
  totalCount: number;
  accuracy: number;
  durationMs: number;
  finishedAt: string;
  answers: AnswerRecord[];
};

export type AnalyticsAnswer = AnswerRecord & {
  foodName: string;
};

export type AnalyticsEvent = {
  eventId: string;
  gameId: "healthy-food";
  gameVersion: string;
  level: GameLevel;
  score: number;
  correctCount: number;
  totalCount: number;
  durationMs: number;
  finishedAt: string;
  answers: AnalyticsAnswer[];
  queuedAt: string;
};

const DATABASE_NAME = "touch-table-games";
const DATABASE_VERSION = 2;

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("IndexedDB is unavailable"));
      return;
    }

    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains("players")) {
        database.createObjectStore("players", { keyPath: "id" });
      }

      if (!database.objectStoreNames.contains("sessions")) {
        const sessions = database.createObjectStore("sessions", { keyPath: "id" });
        sessions.createIndex("playerId", "playerId", { unique: false });
        sessions.createIndex("finishedAt", "finishedAt", { unique: false });
      }

      if (!database.objectStoreNames.contains("analyticsOutbox")) {
        const outbox = database.createObjectStore("analyticsOutbox", { keyPath: "eventId" });
        outbox.createIndex("queuedAt", "queuedAt", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Database error"));
  });
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Database request failed"));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Database transaction failed"));
    transaction.onabort = () => reject(transaction.error ?? new Error("Database transaction aborted"));
  });
}

export async function listPlayers(): Promise<Player[]> {
  const database = await openDatabase();
  const transaction = database.transaction("players", "readonly");
  const players = await requestResult(transaction.objectStore("players").getAll() as IDBRequest<Player[]>);
  database.close();
  return players.sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

export async function savePlayer(player: Player): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction("players", "readwrite");
  transaction.objectStore("players").put(player);
  await transactionDone(transaction);
  database.close();
}

export async function listSessions(): Promise<GameSession[]> {
  const database = await openDatabase();
  const transaction = database.transaction("sessions", "readonly");
  const sessions = await requestResult(transaction.objectStore("sessions").getAll() as IDBRequest<GameSession[]>);
  database.close();
  return sessions.sort((left, right) => right.finishedAt.localeCompare(left.finishedAt));
}

export async function saveSession(session: GameSession): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction("sessions", "readwrite");
  transaction.objectStore("sessions").put(session);
  await transactionDone(transaction);
  database.close();
}

export async function queueAnalyticsEvent(event: AnalyticsEvent): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction("analyticsOutbox", "readwrite");
  transaction.objectStore("analyticsOutbox").put(event);
  await transactionDone(transaction);
  database.close();
}

export async function listPendingAnalytics(limit = 50): Promise<AnalyticsEvent[]> {
  const database = await openDatabase();
  const transaction = database.transaction("analyticsOutbox", "readonly");
  const events = await requestResult(transaction.objectStore("analyticsOutbox").getAll() as IDBRequest<AnalyticsEvent[]>);
  database.close();
  return events.sort((left, right) => left.queuedAt.localeCompare(right.queuedAt)).slice(0, limit);
}

export async function deleteAnalyticsEvents(eventIds: string[]): Promise<void> {
  if (!eventIds.length) return;
  const database = await openDatabase();
  const transaction = database.transaction("analyticsOutbox", "readwrite");
  const store = transaction.objectStore("analyticsOutbox");
  eventIds.forEach((eventId) => store.delete(eventId));
  await transactionDone(transaction);
  database.close();
}

export async function countPendingAnalytics(): Promise<number> {
  const database = await openDatabase();
  const transaction = database.transaction("analyticsOutbox", "readonly");
  const count = await requestResult(transaction.objectStore("analyticsOutbox").count());
  database.close();
  return count;
}

export async function exportLocalData(): Promise<{ players: Player[]; sessions: GameSession[]; exportedAt: string }> {
  const [players, sessions] = await Promise.all([listPlayers(), listSessions()]);
  return { players, sessions, exportedAt: new Date().toISOString() };
}
