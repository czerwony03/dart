import type { Game, FinishMode, NewGameOptions } from './types';
import { VALID_LANGS, GAME_ID_PARAM, LANG_PARAM } from './constants';
import { readPlayerSuggestions, writePlayerSuggestions, readHistory, readActive } from './storage';

/* ─── Language helpers ───────────────────────────────────────────────────── */
export function normalizeLang(lang: unknown): string | null {
  const normalized = typeof lang === 'string' ? lang.trim().toLowerCase() : '';
  return (VALID_LANGS as readonly string[]).includes(normalized) ? normalized : null;
}

/* ─── URL helpers ────────────────────────────────────────────────────────── */
export function getGameIdFromUrl(): string | null {
  try { return new URLSearchParams(window.location.search).get(GAME_ID_PARAM) ?? null; } catch { return null; }
}

export function getLangFromUrl(): string | null {
  try { return normalizeLang(new URLSearchParams(window.location.search).get(LANG_PARAM)); } catch { return null; }
}

export function setGameUrlParam(id: string, lang: string | null): void {
  try {
    const u = new URL(window.location.href);
    u.search = '';
    u.searchParams.set(GAME_ID_PARAM, id);
    const normalizedLang = normalizeLang(lang);
    if (normalizedLang) u.searchParams.set(LANG_PARAM, normalizedLang);
    window.history.replaceState(null, '', u.toString());
  } catch { /* noop */ }
}

export function clearGameUrlParam(lang: string | null): void {
  try {
    const u = new URL(window.location.href);
    u.search = '';
    const normalizedLang = normalizeLang(lang);
    if (normalizedLang) u.searchParams.set(LANG_PARAM, normalizedLang);
    window.history.replaceState(null, '', u.toString());
  } catch { /* noop */ }
}

export function buildGameQueryString(id: string, lang: string | null): string {
  const searchParams = new URLSearchParams();
  searchParams.set(GAME_ID_PARAM, id);
  const normalizedLang = normalizeLang(lang);
  if (normalizedLang) searchParams.set(LANG_PARAM, normalizedLang);
  return searchParams.toString();
}

export function getGameShareUrl(id: string, lang: string | null): string {
  try {
    const u = new URL(window.location.href);
    u.search = buildGameQueryString(id, lang);
    return u.toString();
  } catch {
    return `${window.location.origin}${window.location.pathname}?${buildGameQueryString(id, lang)}`;
  }
}

/* ─── Game factory ───────────────────────────────────────────────────────── */
export function genId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export function normalizeFinishMode(mode: unknown): FinishMode {
  return mode === 'single' ? 'single' : 'double';
}

export function shufflePlayers(players: string[]): string[] {
  const original = [...players];
  if (original.length < 2) return original;

  const canChangeOrder = new Set(original).size > 1;
  if (!canChangeOrder) return [...original];

  for (let attempt = 0; attempt < 5; attempt++) {
    const shuffled = [...original];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    if (!shuffled.every((name, i) => name === original[i])) return shuffled;
  }

  return [...original.slice(1), original[0]];
}

export function newGame(players: string[], opts: NewGameOptions = {}): Game {
  const startScore = opts.startScore ?? 501;
  const finishMode = normalizeFinishMode(opts.finishMode);
  return {
    id:            genId(),
    phase:         'playing',
    players,
    startScore,
    finishMode,
    scores:        players.map(() => startScore),
    currentPlayer: 0,
    round:         1,
    darts:         [],
    turnScore:     0,
    isBust:        false,
    winner:        -1,
    updatedAt:     Date.now(),
    startedAt:     Date.now(),
    finishedAt:    null,
    nextGameId:    null,
    stateHistory:  [],
  };
}

/* ─── Per-player avg round score for a completed game ───────────────────── */
export function playerAvg(g: Game, i: number): string {
  const pointsScored    = g.startScore - g.scores[i];
  const roundsCompleted = i > g.winner ? g.round - 1 : g.round;
  return roundsCompleted > 0 ? (pointsScored / roundsCompleted).toFixed(1) : '—';
}

export function isValidPlayerIndex(playerIndex: number | null, game: Game | null): playerIndex is number {
  const playerCount = game?.players?.length ?? 0;
  return Number.isInteger(playerIndex)
    && (playerIndex as number) >= 0
    && (playerIndex as number) < playerCount;
}

export function getTurnStateKey(game: Game): string {
  return `${game.id}:${game.round}:${game.currentPlayer}`;
}

export function hasUndoableState(game: Game): boolean {
  return game.darts.length > 0 || game.isBust || Boolean(game.stateHistory && game.stateHistory.length > 0);
}

/* ─── Date formatting ────────────────────────────────────────────────────── */
export function fmtDate(ts: number | null): string {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    + ' · ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/* ─── Player suggestions ─────────────────────────────────────────────────── */
export function dedupePlayerNames(names: string[]): string[] {
  const seen = new Set<string>();
  return names.filter(name => {
    const key = name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function updatePlayerSuggestions(names: string[]): string[] {
  const normalized = (Array.isArray(names) ? names : [])
    .map(name => (typeof name === 'string' ? name.trim() : ''))
    .filter(Boolean);
  if (normalized.length === 0) return readPlayerSuggestions();
  const merged = dedupePlayerNames([...normalized, ...readPlayerSuggestions()]).slice(0, 50);
  writePlayerSuggestions(merged);
  return merged;
}

export function getPlayerNameSuggestions(): string[] {
  const normalizeNames = (names: unknown): string[] =>
    (Array.isArray(names) ? names : [])
      .map(name => (typeof name === 'string' ? name.trim() : ''))
      .filter(Boolean);

  const historyNames = readHistory().flatMap(g => normalizeNames(g?.players));
  const activeNames  = normalizeNames(readActive()?.players);
  return dedupePlayerNames([
    ...readPlayerSuggestions(),
    ...activeNames,
    ...historyNames,
  ]).slice(0, 50);
}
