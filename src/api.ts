import type { Game } from './types';
import { API_GAME_URL, API_REQUEST_TIMEOUT_MS } from './constants';

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), API_REQUEST_TIMEOUT_MS);
  const externalSignal = init.signal;
  const abortFromExternal = () => controller.abort();

  if (externalSignal?.aborted) controller.abort();
  else externalSignal?.addEventListener('abort', abortFromExternal, { once: true });

  const { signal: _signal, ...fetchInit } = init;
  try {
    return await fetch(input, { ...fetchInit, signal: controller.signal });
  } finally {
    window.clearTimeout(timeoutId);
    externalSignal?.removeEventListener('abort', abortFromExternal);
  }
}

export function syncToBackend(game: Game): void {
  if (!game?.id) return;
  fetchWithTimeout(API_GAME_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: game.id, state: game }),
  }).catch(() => {}); // fire-and-forget — silently ignore offline errors
}

export async function fetchFromBackend(id: string, options: { signal?: AbortSignal } = {}): Promise<Game | null> {
  const res = await fetchWithTimeout(API_GAME_URL + '?id=' + encodeURIComponent(id), { signal: options.signal });
  if (!res.ok) return null;
  const data = await res.json() as { id?: string } | null;
  return data?.id ? (data as Game) : null;
}

export async function updateRoomCode(code: string, gameId: string): Promise<void> {
  await fetchWithTimeout(API_GAME_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, gameId }),
  }).catch(() => {}); // fire-and-forget — silently ignore offline errors
}

export async function fetchGameByRoomCode(code: string): Promise<Game | null> {
  const res = await fetchWithTimeout(API_GAME_URL + '?code=' + encodeURIComponent(code));
  if (!res.ok) return null;
  const data = await res.json() as { gameId?: string } | null;
  if (!data?.gameId) return null;
  return fetchFromBackend(data.gameId);
}
