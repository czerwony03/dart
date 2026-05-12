import type { Game } from './types';
import { API_GAME_URL } from './constants';

export function syncToBackend(game: Game): void {
  if (!game?.id) return;
  fetch(API_GAME_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: game.id, state: game }),
  }).catch(() => {}); // fire-and-forget — silently ignore offline errors
}

export async function fetchFromBackend(id: string): Promise<Game | null> {
  const res = await fetch(`${API_GAME_URL}?id=${encodeURIComponent(id)}`);
  if (!res.ok) return null;
  const data = await res.json() as { id?: string } | null;
  return data?.id ? (data as Game) : null;
}
