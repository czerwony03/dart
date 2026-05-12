export type FinishMode = 'single' | 'double';
export type GamePhase = 'playing' | 'won';
export type Lang = 'en' | 'pl';

export interface Dart {
  score: number;
  label: string;
  isMiss: boolean;
}

export interface Game {
  id: string;
  phase: GamePhase;
  players: string[];
  startScore: number;
  finishMode: FinishMode;
  scores: number[];
  currentPlayer: number;
  round: number;
  darts: Dart[];
  turnScore: number;
  isBust: boolean;
  winner: number;
  updatedAt: number;
  startedAt: number;
  finishedAt: number | null;
  nextGameId: string | null;
  roomCode: string | null;
  stateHistory: Omit<Game, 'stateHistory'>[];
}

export interface NewGameOptions {
  startScore?: number;
  finishMode?: FinishMode;
  roomCode?: string | null;
}

export interface LangContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string) => string;
}
