"use client";

import {
  ArrowLeft,
  BarChart3,
  BookOpen,
  Castle,
  Check,
  Delete as DeleteIcon,
  Download,
  LockKeyhole,
  Palette,
  Play,
  Rocket,
  RotateCcw,
  Star,
  Sun,
  Trees,
  Trophy,
  UserRoundPlus,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import Image from "next/image";
import { FOODS, LEVELS, getFoodImage, makeRound } from "./game-data";
import type { FoodCategory, FoodItem, GameLevel } from "./game-data";
import {
  exportLocalData,
  listPlayers,
  listSessions,
  savePlayer,
  saveSession,
} from "./storage";
import type { AnswerRecord, GameSession, Player } from "./storage";

type View = "profiles" | "levels" | "game" | "results" | "leaderboard" | "admin";
type ThemeId = "sunny" | "forest" | "space";
type Feedback = { correct: boolean; title: string; detail: string } | null;
type AcceptedDrop = { category: FoodCategory; rotation: number } | null;

const ADMIN_PIN = "5553";
const FEEDBACK_DURATION_MS = 2400;
const PRODUCT_DROP_DURATION_MS = 460;
const THEME_STORAGE_KEY = "healthy-food-theme";
const THEMES: { id: ThemeId; label: string }[] = [
  { id: "sunny", label: "Поляна" },
  { id: "forest", label: "Лес" },
  { id: "space", label: "Космос" },
];
const KEYBOARD_ROWS = [
  ["Й", "Ц", "У", "К", "Е", "Н", "Г", "Ш", "Щ", "З", "Х"],
  ["Ф", "Ы", "В", "А", "П", "Р", "О", "Л", "Д", "Ж", "Э"],
  ["Я", "Ч", "С", "М", "И", "Т", "Ь", "Б", "Ю"],
];
const AVATARS = [
  { symbol: "★", color: "#2f78c4" },
  { symbol: "☀", color: "#ef8b2c" },
  { symbol: "♫", color: "#d75382" },
  { symbol: "⚽", color: "#2f8b67" },
  { symbol: "✦", color: "#7956b3" },
  { symbol: "☁", color: "#4b91a8" },
  { symbol: "♥", color: "#df594f" },
  { symbol: "⚡", color: "#bf7b00" },
];

function createId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatDuration(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.round(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function isToday(isoDate: string): boolean {
  return new Date(isoDate).toDateString() === new Date().toDateString();
}

function getBestSessions(sessions: GameSession[]): GameSession[] {
  const bestByPlayer = new Map<string, GameSession>();

  sessions.forEach((session) => {
    const current = bestByPlayer.get(session.playerId);
    const isBetter =
      !current ||
      session.score > current.score ||
      (session.score === current.score && session.accuracy > current.accuracy) ||
      (session.score === current.score &&
        session.accuracy === current.accuracy &&
        session.durationMs < current.durationMs);

    if (isBetter) bestByPlayer.set(session.playerId, session);
  });

  return [...bestByPlayer.values()].sort(
    (left, right) =>
      right.score - left.score ||
      right.accuracy - left.accuracy ||
      left.durationMs - right.durationMs,
  );
}

function playTone(success: boolean, enabled: boolean): void {
  if (!enabled || typeof window === "undefined") return;

  const AudioContextClass = window.AudioContext ??
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return;

  const audioContext = new AudioContextClass();
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = success ? "sine" : "triangle";
  oscillator.frequency.setValueAtTime(success ? 520 : 180, audioContext.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(success ? 760 : 130, audioContext.currentTime + 0.18);
  gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.16, audioContext.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.25);
  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + 0.26);
  oscillator.addEventListener("ended", () => void audioContext.close());
}

export function GameApp() {
  const [view, setView] = useState<View>("profiles");
  const [players, setPlayers] = useState<Player[]>([]);
  const [sessions, setSessions] = useState<GameSession[]>([]);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [registrationOpen, setRegistrationOpen] = useState(false);
  const [storageWarning, setStorageWarning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [currentLevel, setCurrentLevel] = useState<GameLevel>(1);
  const [theme, setTheme] = useState<ThemeId>("sunny");

  const [round, setRound] = useState<FoodItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [answers, setAnswers] = useState<AnswerRecord[]>([]);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [result, setResult] = useState<GameSession | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dropTarget, setDropTarget] = useState<FoodCategory | null>(null);
  const [acceptedDrop, setAcceptedDrop] = useState<AcceptedDrop>(null);
  const [factsScroll, setFactsScroll] = useState({ visible: false, thumbSize: 100, thumbTop: 0 });

  const [pinOpen, setPinOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState(false);

  const goodBasketRef = useRef<HTMLButtonElement>(null);
  const harmfulBasketRef = useRef<HTMLButtonElement>(null);
  const productCardRef = useRef<HTMLDivElement>(null);
  const factsListRef = useRef<HTMLOListElement>(null);
  const dragRef = useRef<{ pointerId: number; x: number; y: number } | null>(null);
  const roundStartedAtRef = useRef(0);
  const itemStartedAtRef = useRef(0);

  const currentFood = round[currentIndex];
  const levelDefinition = LEVELS.find((level) => level.id === currentLevel) ?? LEVELS[0];
  const learnedFacts = useMemo(
    () => answers
      .slice()
      .reverse()
      .map((answer) => round.find((food) => food.id === answer.foodId))
      .filter((food): food is FoodItem => Boolean(food)),
    [answers, round],
  );

  const syncFactsScrollbar = useCallback(() => {
    const list = factsListRef.current;
    if (!list) return;
    const visible = list.scrollHeight > list.clientHeight + 1;
    const thumbSize = visible ? Math.max(14, (list.clientHeight / list.scrollHeight) * 100) : 100;
    const thumbTop = visible
      ? (list.scrollTop / (list.scrollHeight - list.clientHeight)) * (100 - thumbSize)
      : 0;

    setFactsScroll({ visible, thumbSize, thumbTop });
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(syncFactsScrollbar);
    window.addEventListener("resize", syncFactsScrollbar);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", syncFactsScrollbar);
    };
  }, [learnedFacts.length, syncFactsScrollbar]);

  useEffect(() => {
    const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    const restoreTheme = window.setTimeout(() => {
      if (savedTheme === "sunny" || savedTheme === "forest" || savedTheme === "space") {
        setTheme(savedTheme);
      }
    }, 0);

    Promise.all([listPlayers(), listSessions()])
      .then(([savedPlayers, savedSessions]) => {
        setPlayers(savedPlayers);
        setSessions(savedSessions);
      })
      .catch(() => setStorageWarning(true))
      .finally(() => setLoading(false));

    return () => window.clearTimeout(restoreTheme);
  }, []);

  const chooseTheme = (nextTheme: ThemeId) => {
    setTheme(nextTheme);
    window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
  };

  useEffect(() => {
    const preventDefault = (event: Event) => event.preventDefault();
    const guardKeys = (event: KeyboardEvent) => {
      const zoomKey = (event.ctrlKey || event.metaKey) && ["+", "-", "=", "0"].includes(event.key);
      const navigationKey = ["F5", "F11"].includes(event.key);
      const backspaceOutsideInput =
        event.key === "Backspace" &&
        !(event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement);
      if (zoomKey || navigationKey || backspaceOutsideInput) event.preventDefault();
    };

    document.addEventListener("contextmenu", preventDefault);
    document.addEventListener("dragstart", preventDefault);
    document.addEventListener("selectstart", preventDefault);
    document.addEventListener("gesturestart", preventDefault);
    window.addEventListener("keydown", guardKeys);

    return () => {
      document.removeEventListener("contextmenu", preventDefault);
      document.removeEventListener("dragstart", preventDefault);
      document.removeEventListener("selectstart", preventDefault);
      document.removeEventListener("gesturestart", preventDefault);
      window.removeEventListener("keydown", guardKeys);
    };
  }, []);

  useEffect(() => {
    if (!feedback) return;
    const hideFeedback = window.setTimeout(() => setFeedback(null), FEEDBACK_DURATION_MS);
    return () => window.clearTimeout(hideFeedback);
  }, [feedback]);

  const selectPlayer = (player: Player) => {
    setCurrentPlayer(player);
    setResult(null);
    setView("levels");
    document.documentElement.requestFullscreen?.().catch(() => undefined);
  };

  const startRound = (level = currentLevel, player = currentPlayer) => {
    if (!player) return;
    setCurrentPlayer(player);
    setCurrentLevel(level);
    setRound(makeRound(level));
    setCurrentIndex(0);
    setScore(0);
    setStreak(0);
    setCorrectCount(0);
    setAnswers([]);
    setFeedback(null);
    setResult(null);
    setDragOffset({ x: 0, y: 0 });
    setDragging(false);
    setDropTarget(null);
    setAcceptedDrop(null);
    roundStartedAtRef.current = Date.now();
    itemStartedAtRef.current = Date.now();
    setView("game");
  };

  const createPlayer = async (name: string, avatar: string, color: string) => {
    const player: Player = {
      id: createId(),
      name: name.trim(),
      avatar,
      color,
      createdAt: new Date().toISOString(),
    };
    setPlayers((current) => [...current, player]);
    setRegistrationOpen(false);
    try {
      await savePlayer(player);
    } catch {
      setStorageWarning(true);
    }
    selectPlayer(player);
  };

  const detectDropTarget = (clientX: number, clientY: number): FoodCategory | null => {
    const inRect = (rect: DOMRect | undefined) =>
      Boolean(rect && clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom);
    if (inRect(goodBasketRef.current?.getBoundingClientRect())) return "good";
    if (inRect(harmfulBasketRef.current?.getBoundingClientRect())) return "harmful";
    return null;
  };

  const finishRound = async (
    finalAnswers: AnswerRecord[],
    finalScore: number,
    finalCorrectCount: number,
  ) => {
    if (!currentPlayer) return;
    const session: GameSession = {
      id: createId(),
      gameId: "healthy-food",
      playerId: currentPlayer.id,
      playerName: currentPlayer.name,
      playerAvatar: currentPlayer.avatar,
      level: currentLevel,
      score: finalScore,
      correctCount: finalCorrectCount,
      totalCount: round.length,
      accuracy: Math.round((finalCorrectCount / round.length) * 100),
      durationMs: Date.now() - roundStartedAtRef.current,
      finishedAt: new Date().toISOString(),
      answers: finalAnswers,
    };

    setResult(session);
    setSessions((current) => [session, ...current]);
    setView("results");
    try {
      await saveSession(session);
    } catch {
      setStorageWarning(true);
    }
  };

  const submitAnswer = (selected: FoodCategory) => {
    if (!currentFood || acceptedDrop) return;
    const responseMs = Date.now() - itemStartedAtRef.current;
    const correct = selected === currentFood.category;
    const nextStreak = correct ? streak + 1 : 0;
    const speedBonus = Math.max(0, 40 - Math.floor(Math.max(0, responseMs - 3000) / 250));
    const streakBonus = Math.min(nextStreak * 10, 40);
    const earned = correct ? 100 + speedBonus + streakBonus : 0;
    const nextScore = score + earned;
    const nextCorrectCount = correctCount + (correct ? 1 : 0);
    const answer: AnswerRecord = {
      foodId: currentFood.id,
      expected: currentFood.category,
      selected,
      correct,
      responseMs,
    };
    const nextAnswers = [...answers, answer];

    setScore(nextScore);
    setStreak(nextStreak);
    setCorrectCount(nextCorrectCount);
    setAnswers(nextAnswers);
    setFeedback({
      correct,
      title: correct ? `Верно! +${earned}` : "Почти получилось",
      detail: currentFood.fact,
    });
    playTone(correct, soundEnabled);

    window.setTimeout(() => {
      setDragOffset({ x: 0, y: 0 });
      setDropTarget(null);
      setAcceptedDrop(null);
      if (currentIndex + 1 >= round.length) {
        void finishRound(nextAnswers, nextScore, nextCorrectCount);
      } else {
        setCurrentIndex((index) => index + 1);
        itemStartedAtRef.current = Date.now();
      }
    }, PRODUCT_DROP_DURATION_MS);
  };

  const acceptProduct = (selected: FoodCategory) => {
    if (!currentFood || acceptedDrop) return;

    const productRect = productCardRef.current?.getBoundingClientRect();
    const basket = selected === "good" ? goodBasketRef.current : harmfulBasketRef.current;
    const basketRect = basket?.getBoundingClientRect();

    if (productRect && basketRect) {
      const productCenterX = productRect.left + productRect.width / 2;
      const productCenterY = productRect.top + productRect.height / 2;
      const basketCenterX = basketRect.left + basketRect.width / 2;
      const basketCenterY = basketRect.top + basketRect.height / 2;

      setDragOffset((offset) => ({
        x: offset.x + basketCenterX - productCenterX,
        y: offset.y + basketCenterY - productCenterY,
      }));
    }

    dragRef.current = null;
    setDragging(false);
    setDropTarget(selected);
    setAcceptedDrop({ category: selected, rotation: selected === "good" ? -14 : 14 });
    submitAnswer(selected);
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (acceptedDrop) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
    setDragging(true);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = dragRef.current;
    if (!start || start.pointerId !== event.pointerId) return;
    setDragOffset({ x: event.clientX - start.x, y: event.clientY - start.y });
    setDropTarget(detectDropTarget(event.clientX, event.clientY));
  };

  const resetDrag = () => {
    dragRef.current = null;
    setDragging(false);
    setDropTarget(null);
    setDragOffset({ x: 0, y: 0 });
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = dragRef.current;
    if (!start || start.pointerId !== event.pointerId) return;
    const target = detectDropTarget(event.clientX, event.clientY);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (target) {
      acceptProduct(target);
    } else {
      resetDrag();
    }
  };

  const openAdultAccess = () => {
    setPin("");
    setPinError(false);
    setPinOpen(true);
  };

  const appendPin = (digit: string) => {
    if (pin.length >= 4) return;
    const nextPin = `${pin}${digit}`;
    setPin(nextPin);
    setPinError(false);
    if (nextPin.length === 4) {
      if (nextPin === ADMIN_PIN) {
        window.setTimeout(() => {
          setPinOpen(false);
          setPin("");
          setView("admin");
        }, 160);
      } else {
        setPinError(true);
        window.setTimeout(() => setPin(""), 500);
      }
    }
  };

  const downloadStatistics = async () => {
    try {
      const payload = await exportLocalData();
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `touch-game-statistics-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      setStorageWarning(true);
    }
  };

  return (
    <main className={`app-shell theme-${theme}`}>
      {view === "profiles" && (
        <ProfilesScreen
          players={players}
          sessions={sessions}
          loading={loading}
          storageWarning={storageWarning}
          theme={theme}
          onPlayer={selectPlayer}
          onNewPlayer={() => setRegistrationOpen(true)}
          onLeaderboard={() => setView("leaderboard")}
          onAdultAccess={openAdultAccess}
          onTheme={chooseTheme}
        />
      )}

      {view === "levels" && currentPlayer && (
        <LevelSelectScreen
          player={currentPlayer}
          onLevel={(level) => startRound(level)}
          onBack={() => setView("profiles")}
        />
      )}

      {view === "game" && currentPlayer && currentFood && (
        <section className={`game-shell ${feedback ? (feedback.correct ? "is-correct" : "is-wrong") : ""}`}>
          <header className="game-header">
            <div className="player-chip" aria-label={`Игрок: ${currentPlayer.name}`}>
              <span className="player-avatar" style={{ backgroundColor: currentPlayer.color }} aria-hidden="true">{currentPlayer.avatar}</span>
              <span>{currentPlayer.name}</span>
            </div>
            <div className="round-progress" aria-label={`Пройдено ${currentIndex} из ${round.length} продуктов`}>
              <span className="level-chip">Уровень {currentLevel}</span>
              <div className="progress-track"><span style={{ width: `${(currentIndex / round.length) * 100}%` }} /></div>
              <strong>{currentIndex + 1} / {round.length}</strong>
            </div>
            <div className="game-actions">
              <button
                className="icon-button"
                type="button"
                aria-label={soundEnabled ? "Выключить звук" : "Включить звук"}
                title={soundEnabled ? "Выключить звук" : "Включить звук"}
                onClick={() => setSoundEnabled((enabled) => !enabled)}
              >
                {soundEnabled ? <Volume2 /> : <VolumeX />}
              </button>
              <div className="score-chip" aria-label={`Счёт: ${score} очков`}>
                <Star fill="currentColor" aria-hidden="true" /><strong>{score}</strong>
              </div>
            </div>
          </header>

          <div className="game-body">
            <section className="game-stage" aria-labelledby="game-question">
              <button
                ref={goodBasketRef}
                type="button"
                className={`basket basket-good ${dropTarget === "good" ? "is-target" : ""} ${acceptedDrop?.category === "good" ? "is-accepting" : ""}`}
                onClick={() => acceptProduct("good")}
                disabled={Boolean(acceptedDrop)}
              >
                <span className="basket-symbol" aria-hidden="true"><Check /></span><strong>Полезно</strong>
              </button>

              <div className="product-area">
                <p className="eyebrow">Продукт {currentIndex + 1}</p>
                <h1 id="game-question">Куда положим?</h1>
                <div
                  ref={productCardRef}
                  className={`product-card ${dragging ? "is-dragging" : ""} ${acceptedDrop ? "is-accepted" : ""}`}
                  role="img"
                  aria-label={currentFood.name}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerCancel={resetDrag}
                  style={{
                    transform: acceptedDrop
                      ? `translate3d(${dragOffset.x}px, ${dragOffset.y}px, 0) rotate(${acceptedDrop.rotation}deg) scale(0.08)`
                      : `translate3d(${dragOffset.x}px, ${dragOffset.y}px, 0)`,
                  }}
                >
                  <FoodArtwork food={currentFood} />
                </div>
                <p className="product-name">{currentFood.name}</p>
              </div>

              <button
                ref={harmfulBasketRef}
                type="button"
                className={`basket basket-harmful ${dropTarget === "harmful" ? "is-target" : ""} ${acceptedDrop?.category === "harmful" ? "is-accepting" : ""}`}
                onClick={() => acceptProduct("harmful")}
                disabled={Boolean(acceptedDrop)}
              >
                <span className="basket-symbol" aria-hidden="true">!</span>
                <strong>Вредно</strong>
                {levelDefinition.harmfulHint && <small>{levelDefinition.harmfulHint}</small>}
              </button>
            </section>

            <aside className="facts-rail" aria-label="Факты о продуктах" aria-live="polite">
              <div className="facts-heading">
                <BookOpen aria-hidden="true" />
                <strong>Запомни</strong>
                <span>{learnedFacts.length} / {round.length}</span>
              </div>
              {learnedFacts.length ? (
                <ol ref={factsListRef} className="facts-list" onScroll={syncFactsScrollbar}>
                  {learnedFacts.map((food) => (
                    <li key={food.id} className={food.category === "good" ? "fact-good" : "fact-harmful"}>
                      <FoodArtwork food={food} compact />
                      <span><strong>{food.name}</strong><small>{food.fact}</small></span>
                    </li>
                  ))}
                </ol>
              ) : (
                <div className="facts-empty" aria-hidden="true"><BookOpen /></div>
              )}
              <div className={`facts-scrollbar ${factsScroll.visible ? "is-visible" : ""}`} aria-hidden="true">
                <span style={{ height: `${factsScroll.thumbSize}%`, top: `${factsScroll.thumbTop}%` }} />
              </div>
            </aside>
          </div>

          <div className="streak" aria-label={`${streak} правильных ответов подряд`}>
            <Star fill="currentColor" aria-hidden="true" />Серия: {streak}
          </div>

          {feedback && (
            <div className={`feedback-banner ${feedback.correct ? "feedback-good" : "feedback-wrong"}`} role="status">
              <span className="feedback-mark" aria-hidden="true">{feedback.correct ? <Check /> : <X />}</span>
              <span><strong>{feedback.title}</strong><small>{feedback.detail}</small></span>
            </div>
          )}
        </section>
      )}

      {view === "results" && result && (
        <ResultsScreen
          result={result}
          onAgain={() => startRound(result.level ?? 1)}
          onNextLevel={(result.level ?? 1) < 3 ? () => startRound(((result.level ?? 1) + 1) as GameLevel) : undefined}
          onLeaderboard={() => setView("leaderboard")}
          onLevels={() => setView("levels")}
          onProfiles={() => setView("profiles")}
        />
      )}

      {view === "leaderboard" && (
        <LeaderboardScreen
          sessions={sessions}
          initialLevel={currentLevel}
          currentPlayerId={currentPlayer?.id}
          onBack={() => setView(result ? "results" : currentPlayer ? "levels" : "profiles")}
        />
      )}

      {view === "admin" && (
        <AdminScreen players={players} sessions={sessions} onExport={() => void downloadStatistics()} onClose={() => setView("profiles")} />
      )}

      {registrationOpen && (
        <RegistrationDialog onClose={() => setRegistrationOpen(false)} onCreate={(name, avatar, color) => void createPlayer(name, avatar, color)} />
      )}

      {pinOpen && (
        <PinDialog pin={pin} error={pinError} onDigit={appendPin} onBackspace={() => setPin((value) => value.slice(0, -1))} onClose={() => setPinOpen(false)} />
      )}
    </main>
  );
}

function FoodArtwork({ food, compact = false }: { food: FoodItem; compact?: boolean }) {
  const image = getFoodImage(food);

  if (image) {
    return (
      <Image
        className={compact ? "fact-image" : "product-image"}
        src={image}
        alt=""
        width={720}
        height={720}
        draggable={false}
        unoptimized
        priority={!compact}
      />
    );
  }

  return <span className={compact ? "fact-emoji" : "product-emoji"} aria-hidden="true">{food.emoji}</span>;
}

function ProfilesScreen({
  players,
  sessions,
  loading,
  storageWarning,
  theme,
  onPlayer,
  onNewPlayer,
  onLeaderboard,
  onAdultAccess,
  onTheme,
}: {
  players: Player[];
  sessions: GameSession[];
  loading: boolean;
  storageWarning: boolean;
  theme: ThemeId;
  onPlayer: (player: Player) => void;
  onNewPlayer: () => void;
  onLeaderboard: () => void;
  onAdultAccess: () => void;
  onTheme: (theme: ThemeId) => void;
}) {
  return (
    <section className="screen profiles-screen">
      <header className="screen-header">
        <div className="brand-mark"><span aria-hidden="true">🍎</span><strong>Вредно-полезно</strong></div>
        <div className="theme-switcher" role="group" aria-label="Стиль игры">
          <span className="theme-switcher-label"><Palette aria-hidden="true" />Стиль</span>
          {THEMES.map((item) => (
            <button
              className={theme === item.id ? "is-active" : ""}
              type="button"
              key={item.id}
              onClick={() => onTheme(item.id)}
              aria-pressed={theme === item.id}
              title={item.label}
            >
              {item.id === "sunny" ? <Sun aria-hidden="true" /> : item.id === "forest" ? <Trees aria-hidden="true" /> : <Rocket aria-hidden="true" />}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
        <div className="screen-header-actions">
          <button className="header-command" type="button" onClick={onLeaderboard} disabled={!sessions.length}><Trophy aria-hidden="true" />Рейтинг</button>
          <button className="header-command adult-command" type="button" onClick={onAdultAccess}><LockKeyhole aria-hidden="true" />Вход для взрослых</button>
        </div>
      </header>
      <div className="profiles-content">
        <p className="eyebrow">Начинаем игру</p>
        <h1>{loading ? "Загружаем игроков…" : "Кто сегодня играет?"}</h1>
        {!loading && (
          <div className="profile-grid">
            {players.map((player) => (
              <button className="profile-button" type="button" key={player.id} onClick={() => onPlayer(player)}>
                <span className="large-avatar" style={{ backgroundColor: player.color }} aria-hidden="true">{player.avatar}</span>
                <strong>{player.name}</strong><Play aria-hidden="true" />
              </button>
            ))}
            <button className="profile-button new-profile" type="button" onClick={onNewPlayer}>
              <span className="large-avatar" aria-hidden="true"><UserRoundPlus /></span><strong>Новый игрок</strong>
            </button>
          </div>
        )}
        {storageWarning && <p className="storage-warning">Данные сохранятся только до закрытия этой вкладки.</p>}
      </div>
    </section>
  );
}

function LevelSelectScreen({
  player,
  onLevel,
  onBack,
}: {
  player: Player;
  onLevel: (level: GameLevel) => void;
  onBack: () => void;
}) {
  return (
    <section className="screen levels-screen">
      <header className="screen-header">
        <button className="header-command" type="button" onClick={onBack}><ArrowLeft />Назад</button>
        <div className="player-chip" aria-label={`Игрок: ${player.name}`}>
          <span className="player-avatar" style={{ backgroundColor: player.color }} aria-hidden="true">{player.avatar}</span>
          <span>{player.name}</span>
        </div>
        <span className="header-spacer" />
      </header>
      <div className="levels-content">
        <p className="eyebrow">Выбери приключение</p>
        <h1>На какой уровень отправимся?</h1>
        <div className="level-grid">
          {LEVELS.map((level) => (
            <button
              className={`level-card level-card-${level.id}`}
              type="button"
              key={level.id}
              onClick={() => onLevel(level.id)}
            >
              <span className="level-icon" aria-hidden="true">
                {level.id === 1 ? <Sun /> : level.id === 2 ? <Trees /> : <Castle />}
              </span>
              <span className="level-number">{level.name}</span>
              <strong>{level.subtitle}</strong>
              <small>{level.description}</small>
              <span className="level-play"><Play fill="currentColor" />Играть</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function RegistrationDialog({ onClose, onCreate }: { onClose: () => void; onCreate: (name: string, avatar: string, color: string) => void }) {
  const [name, setName] = useState("");
  const [avatarIndex, setAvatarIndex] = useState(0);
  const selectedAvatar = AVATARS[avatarIndex];
  const cleanName = name.replace(/\s+/g, " ").trim();
  const append = (letter: string) => name.length < 12 && setName((value) => `${value}${letter}`);

  return (
    <div className="dialog-backdrop" role="presentation">
      <section className="dialog registration-dialog" role="dialog" aria-modal="true" aria-labelledby="registration-title">
        <button className="dialog-close icon-button" type="button" onClick={onClose} aria-label="Закрыть" title="Закрыть"><X /></button>
        <p className="eyebrow">Новый игрок</p><h2 id="registration-title">Как тебя зовут?</h2>
        <div className="registration-top">
          <div className="avatar-picker" aria-label="Выберите значок">
            {AVATARS.map((avatar, index) => (
              <button key={`${avatar.symbol}-${avatar.color}`} className={index === avatarIndex ? "is-selected" : ""} type="button" aria-label={`Значок ${index + 1}`} onClick={() => setAvatarIndex(index)} style={{ backgroundColor: avatar.color }}>{avatar.symbol}</button>
            ))}
          </div>
          <label className="name-field">
            <span>Имя или псевдоним</span>
            <input maxLength={12} value={name} onChange={(event) => setName(event.target.value.replace(/[^A-Za-zА-Яа-яЁё0-9 _-]/g, ""))} placeholder="Например, Маша" />
          </label>
        </div>
        <div className="touch-keyboard" aria-label="Экранная клавиатура">
          {KEYBOARD_ROWS.map((row, index) => (
            <div className="keyboard-row" key={index}>{row.map((letter) => <button type="button" key={letter} onClick={() => append(letter)}>{letter}</button>)}</div>
          ))}
          <div className="keyboard-row">
            <button className="space-key" type="button" onClick={() => append(" ")}>Пробел</button>
            <button type="button" onClick={() => setName((value) => value.slice(0, -1))} aria-label="Удалить букву" title="Удалить букву"><DeleteIcon /></button>
          </div>
        </div>
        <button className="primary-command" type="button" disabled={cleanName.length < 2} onClick={() => onCreate(cleanName, selectedAvatar.symbol, selectedAvatar.color)}><Check aria-hidden="true" />Готово</button>
      </section>
    </div>
  );
}

function ResultsScreen({
  result,
  onAgain,
  onNextLevel,
  onLeaderboard,
  onLevels,
  onProfiles,
}: {
  result: GameSession;
  onAgain: () => void;
  onNextLevel?: () => void;
  onLeaderboard: () => void;
  onLevels: () => void;
  onProfiles: () => void;
}) {
  const stars = result.accuracy >= 90 ? 3 : result.accuracy >= 70 ? 2 : 1;
  const title = stars === 3 ? "Отлично!" : stars === 2 ? "Хорошая работа!" : "Продолжим тренироваться!";
  return (
    <section className="screen results-screen">
      <div className="result-celebration" aria-hidden="true">{[0, 1, 2].map((index) => <Star key={index} className={index < stars ? "earned-star" : "empty-star"} fill="currentColor" />)}</div>
      <p className="eyebrow">Уровень {result.level ?? 1} пройден</p>
      <h1>{title}</h1><p className="result-player">{result.playerAvatar} {result.playerName}</p>
      <div className="result-metrics">
        <div><strong>{result.score}</strong><span>очков</span></div>
        <div><strong>{result.correctCount} / {result.totalCount}</strong><span>верных ответов</span></div>
        <div><strong>{formatDuration(result.durationMs)}</strong><span>время</span></div>
      </div>
      <div className="result-actions">
        {onNextLevel ? (
          <button className="primary-command" type="button" onClick={onNextLevel}><Play />Следующий уровень</button>
        ) : (
          <button className="primary-command" type="button" onClick={onAgain}><RotateCcw />Играть ещё</button>
        )}
        {onNextLevel && <button className="secondary-command" type="button" onClick={onAgain}><RotateCcw />Повторить</button>}
        <button className="secondary-command" type="button" onClick={onLeaderboard}><Trophy />Рейтинг</button>
        <button className="secondary-command" type="button" onClick={onLevels}><BookOpen />Все уровни</button>
        <button className="secondary-command" type="button" onClick={onProfiles}><ArrowLeft />Другой игрок</button>
      </div>
    </section>
  );
}

function LeaderboardScreen({
  sessions,
  initialLevel,
  currentPlayerId,
  onBack,
}: {
  sessions: GameSession[];
  initialLevel: GameLevel;
  currentPlayerId?: string;
  onBack: () => void;
}) {
  const [range, setRange] = useState<"today" | "all">("today");
  const [level, setLevel] = useState<GameLevel>(initialLevel);
  const entries = useMemo(
    () => getBestSessions(sessions.filter((session) =>
      (session.level ?? 1) === level && (range === "all" || isToday(session.finishedAt)))),
    [level, range, sessions],
  );
  return (
    <section className="screen leaderboard-screen">
      <header className="screen-header">
        <button className="header-command" type="button" onClick={onBack}><ArrowLeft />Назад</button>
        <div className="brand-mark"><Trophy aria-hidden="true" /><strong>Лучшие игроки</strong></div><span className="header-spacer" />
      </header>
      <div className="leaderboard-content">
        <div className="segmented-control level-segments" aria-label="Уровень рейтинга">
          {LEVELS.map((item) => (
            <button className={level === item.id ? "is-active" : ""} type="button" key={item.id} onClick={() => setLevel(item.id)}>
              {item.name}
            </button>
          ))}
        </div>
        <div className="segmented-control" aria-label="Период рейтинга">
          <button className={range === "today" ? "is-active" : ""} type="button" onClick={() => setRange("today")}>Сегодня</button>
          <button className={range === "all" ? "is-active" : ""} type="button" onClick={() => setRange("all")}>Всё время</button>
        </div>
        {entries.length ? (
          <ol className="leaderboard-list">
            {entries.slice(0, 10).map((session, index) => (
              <li key={session.id} className={session.playerId === currentPlayerId ? "is-current" : ""}>
                <span className={`rank rank-${index + 1}`}>{index + 1}</span><span className="leader-avatar" aria-hidden="true">{session.playerAvatar}</span>
                <strong>{session.playerName}</strong><span>{session.accuracy}%</span><b>{session.score}</b>
              </li>
            ))}
          </ol>
        ) : (
          <div className="empty-state"><Trophy aria-hidden="true" /><strong>Первое место пока свободно</strong></div>
        )}
      </div>
    </section>
  );
}

function AdminScreen({ players, sessions, onExport, onClose }: { players: Player[]; sessions: GameSession[]; onExport: () => void; onClose: () => void }) {
  const totalAnswers = sessions.reduce((sum, session) => sum + session.totalCount, 0);
  const totalCorrect = sessions.reduce((sum, session) => sum + session.correctCount, 0);
  const accuracy = totalAnswers ? Math.round((totalCorrect / totalAnswers) * 100) : 0;
  const mistakeCounts = new Map<string, number>();
  sessions.forEach((session) => session.answers.filter((answer) => !answer.correct).forEach((answer) => mistakeCounts.set(answer.foodId, (mistakeCounts.get(answer.foodId) ?? 0) + 1)));
  const hardest = [...mistakeCounts.entries()].sort((left, right) => right[1] - left[1]).slice(0, 5).map(([foodId, count]) => ({ foodId, food: FOODS.find((item) => item.id === foodId), count }));
  const rowsByPlayer = new Map<string, {
    id: string;
    name: string;
    avatar: string;
    games: number;
    best: Record<GameLevel, number>;
  }>();

  players.forEach((player) => rowsByPlayer.set(player.id, {
    id: player.id,
    name: player.name,
    avatar: player.avatar,
    games: 0,
    best: { 1: 0, 2: 0, 3: 0 },
  }));
  sessions.forEach((session) => {
    const row = rowsByPlayer.get(session.playerId) ?? {
      id: session.playerId,
      name: session.playerName,
      avatar: session.playerAvatar,
      games: 0,
      best: { 1: 0, 2: 0, 3: 0 } as Record<GameLevel, number>,
    };
    const level = session.level ?? 1;
    row.games += 1;
    row.best[level] = Math.max(row.best[level], session.score);
    rowsByPlayer.set(session.playerId, row);
  });
  const playerRows = [...rowsByPlayer.values()].sort((left, right) =>
    Math.max(...Object.values(right.best)) - Math.max(...Object.values(left.best)) ||
    left.name.localeCompare(right.name, "ru"),
  );

  return (
    <section className="screen admin-screen">
      <header className="screen-header">
        <div className="brand-mark"><LockKeyhole aria-hidden="true" /><strong>Взрослый раздел</strong></div>
        <button className="header-command" type="button" onClick={onClose}><X />Закрыть</button>
      </header>
      <div className="admin-content">
        <div className="admin-metrics">
          <div><UserRoundPlus /><strong>{players.length}</strong><span>игроков</span></div>
          <div><BarChart3 /><strong>{sessions.length}</strong><span>игр</span></div>
          <div><Check /><strong>{accuracy}%</strong><span>точность</span></div>
        </div>
        <section className="player-results-section">
          <div className="admin-section-heading">
            <div><h2>Результаты игроков</h2><p>Лучший результат на каждом уровне, сохранённый на этом столе</p></div>
            <Trophy aria-hidden="true" />
          </div>
          {playerRows.length ? (
            <div className="player-results-scroll">
              <table className="player-results-table">
                <thead><tr><th>Игрок</th><th>Уровень 1</th><th>Уровень 2</th><th>Уровень 3</th><th>Игр</th></tr></thead>
                <tbody>
                  {playerRows.map((row) => (
                    <tr key={row.id}>
                      <td><span aria-hidden="true">{row.avatar}</span><strong>{row.name}</strong></td>
                      <td>{row.best[1] || "—"}</td>
                      <td>{row.best[2] || "—"}</td>
                      <td>{row.best[3] || "—"}</td>
                      <td>{row.games}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="admin-empty">Игроки появятся после первой регистрации.</p>}
        </section>
        <section className="hardest-section">
          <h2>Где чаще ошибаются</h2>
          {hardest.length ? (
            <div className="hardest-list">{hardest.map(({ foodId, food, count }) => <div key={foodId}><span aria-hidden="true">{food?.emoji ?? "?"}</span><strong>{food?.name ?? "Продукт из прошлой версии"}</strong><b>{count}</b></div>)}</div>
          ) : <p className="admin-empty">Статистика появится после первой игры.</p>}
        </section>
        <button className="primary-command export-command" type="button" onClick={onExport} disabled={!players.length && !sessions.length}><Download />Экспорт статистики</button>
      </div>
    </section>
  );
}

function PinDialog({ pin, error, onDigit, onBackspace, onClose }: { pin: string; error: boolean; onDigit: (digit: string) => void; onBackspace: () => void; onClose: () => void }) {
  return (
    <div className="dialog-backdrop" role="presentation">
      <section className={`dialog pin-dialog ${error ? "has-error" : ""}`} role="dialog" aria-modal="true" aria-labelledby="pin-title">
        <button className="dialog-close icon-button" type="button" onClick={onClose} aria-label="Закрыть" title="Закрыть"><X /></button>
        <LockKeyhole className="pin-lock" aria-hidden="true" /><h2 id="pin-title">Введите PIN</h2>
        <div className="pin-dots" aria-label={`Введено цифр: ${pin.length}`}>{[0, 1, 2, 3].map((index) => <span key={index} className={index < pin.length ? "is-filled" : ""} />)}</div>
        <div className="pin-keypad">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"].map((digit) => <button type="button" key={digit} onClick={() => onDigit(digit)}>{digit}</button>)}
          <button type="button" aria-label="Удалить цифру" title="Удалить цифру" onClick={onBackspace}><DeleteIcon /></button>
        </div>
      </section>
    </div>
  );
}
