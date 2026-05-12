import type { Game, Lang } from './types';
import {
  LS_ACTIVE,
  LS_HISTORY,
  LS_LANG,
  LS_PLAYER_SUGGESTIONS,
  LS_PLAYER_IDENTITIES,
} from './constants';

export const readActive = (): Game | null => {
  try { return JSON.parse(localStorage.getItem(LS_ACTIVE) ?? 'null') ?? null; } catch { return null; }
};

export const writeActive = (g: Game): void => {
  try {
    localStorage.setItem(LS_ACTIVE, JSON.stringify(g));
  } catch {
    /* private mode / quota exceeded — silently ignore autosave */
  }
};

export const clearActive = (): void => { localStorage.removeItem(LS_ACTIVE); };

export const readHistory = (): Game[] => {
  try { return JSON.parse(localStorage.getItem(LS_HISTORY) ?? 'null') ?? []; } catch { return []; }
};

export const writeHistory = (h: Game[]): void => {
  localStorage.setItem(LS_HISTORY, JSON.stringify(h));
};

export const readLang = (): string | null => {
  try { return localStorage.getItem(LS_LANG); } catch { return null; }
};

export const writeLang = (lang: Lang): void => {
  try { localStorage.setItem(LS_LANG, lang); } catch { /* private/storage-full — silently ignore */ }
};

export const readPlayerSuggestions = (): string[] => {
  try {
    const data = JSON.parse(localStorage.getItem(LS_PLAYER_SUGGESTIONS) ?? 'null');
    if (!Array.isArray(data)) return [];
    return (data as unknown[])
      .map(name => (typeof name === 'string' ? name.trim() : ''))
      .filter(Boolean);
  } catch {
    return [];
  }
};

export const writePlayerSuggestions = (names: string[]): void => {
  try { localStorage.setItem(LS_PLAYER_SUGGESTIONS, JSON.stringify(names)); } catch { /* ignore */ }
};

export const readPlayerIdentities = (): Record<string, number> => {
  try {
    const data = JSON.parse(localStorage.getItem(LS_PLAYER_IDENTITIES) ?? 'null');
    return data && typeof data === 'object' ? (data as Record<string, number>) : {};
  } catch {
    return {};
  }
};

export const readPlayerIdentity = (gameId: string | null): number | null => {
  if (!gameId) return null;
  const stored = readPlayerIdentities()[gameId];
  return Number.isInteger(stored) ? stored : null;
};

export const writePlayerIdentity = (gameId: string, playerIndex: number): void => {
  if (!gameId || !Number.isInteger(playerIndex)) return;
  const identities = readPlayerIdentities();
  identities[gameId] = playerIndex;
  try { localStorage.setItem(LS_PLAYER_IDENTITIES, JSON.stringify(identities)); } catch { /* ignore */ }
};

export const pushToHistory = (game: Game): void => {
  const h   = readHistory();
  const idx = h.findIndex(g => g.id === game.id);
  if (idx >= 0) h[idx] = game; else h.unshift(game);
  writeHistory(h);
};
