import { useState, useEffect, useCallback, useRef } from 'react';
import type { Game, Lang } from './types';
import { LangContext, useToast } from './context';
import { TRANSLATIONS } from './translations';
import { POLL_MS, REFRESH_THROTTLE_MS, MAX_FORCE_REFRESH_QUEUE, NEXT_TICK_MS, TURN_VIBRATION_MS } from './constants';
import {
  readActive, writeActive, clearActive, readHistory, writeHistory, pushToHistory,
  readLang, writeLang, readPlayerIdentity, writePlayerIdentity,
} from './storage';
import {
  newGame, shufflePlayers, normalizeFinishMode, normalizeLang,
  getGameIdFromUrl, getLangFromUrl, getRoomCodeFromUrl, setGameUrlParam, clearGameUrlParam, getGameShareUrl,
  isValidPlayerIndex, getTurnStateKey,
} from './game';
import { syncToBackend, fetchFromBackend, updateRoomCode, fetchGameByRoomCode } from './api';
import { HomeScreen } from './components/HomeScreen';
import { SetupScreen } from './components/SetupScreen';
import { GameScreen } from './components/GameScreen';
import { WinScreen } from './components/WinScreen';
import { Toast } from './components/Toast';
import { ShareModal } from './components/ShareModal';
import type { NewGameOptions } from './types';

export function App() {
  const [screen,  setScreen]  = useState<'home' | 'setup' | 'game' | 'win' | 'view'>('home');
  const [game,    setGame]    = useState<Game | null>(null);
  const [history, setHistory] = useState<Game[]>(() => readHistory());
  const [selectedPlayer, setSelectedPlayer] = useState<number | null>(null);
  const [toastMsg, showToast] = useToast();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [lang, setLangState]  = useState<Lang>(() => {
    const urlLang = getLangFromUrl();
    if (urlLang) return urlLang as Lang;
    try { return (normalizeLang(readLang()) ?? 'en') as Lang; } catch { return 'en'; }
  });

  const setLang = useCallback((l: string) => {
    const normalizedLang = (normalizeLang(l) ?? 'en') as Lang;
    setLangState(normalizedLang);
    writeLang(normalizedLang);
  }, []);

  const t = useCallback((key: string) => (TRANSLATIONS[lang] ?? TRANSLATIONS.en)[key] ?? key, [lang]);

  const announceNextGame = useCallback((finishedGame: Game | null, nextGameId: string) => {
    const normalizedNextGameId = typeof nextGameId === 'string' ? nextGameId.trim() : '';
    if (!finishedGame?.id || finishedGame.phase !== 'won' || !normalizedNextGameId || finishedGame.id === normalizedNextGameId) return;
    syncToBackend({ ...finishedGame, nextGameId: normalizedNextGameId, updatedAt: Date.now() });
  }, []);

  const followSuccessorGame = useCallback(async (currentGameId: string, successorGameId: string | null): Promise<boolean> => {
    const nextGameId = typeof successorGameId === 'string' ? successorGameId.trim() : '';
    if (!nextGameId || nextGameId === currentGameId) return false;
    const nextRemote = await fetchFromBackend(nextGameId);
    if (!nextRemote?.id || nextRemote.id !== nextGameId) return false;
    setGameUrlParam(nextGameId, lang, nextRemote.roomCode);
    setGame(nextRemote);
    setScreen(nextRemote.phase === 'won' ? 'win' : 'game');
    return true;
  }, [lang]);

  /* Auto-save active game to localStorage whenever in-progress state changes */
  useEffect(() => {
    if (game?.phase === 'playing') writeActive(game);
  }, [game]);

  /* Sync every game state change to the backend (fire-and-forget, offline-safe) */
  useEffect(() => {
    if (game?.id && (game.phase === 'playing' || game.phase === 'won')) {
      syncToBackend(game);
    }
  }, [game]);

  /* Poll backend every POLL_MS when a game is active — apply if remote is newer */
  const gameRef = useRef(game);
  useEffect(() => { gameRef.current = game; }, [game]);
  const refreshInFlightRef = useRef(false);
  const forceRefreshPendingCountRef = useRef(0);
  useEffect(() => { forceRefreshPendingCountRef.current = 0; }, [game?.id]);
  const lastRefreshAtRef = useRef(0);
  const refreshFromBackend = useCallback(async (id: string, options: { force?: boolean; consumeQueued?: boolean } = {}) => {
    if (!id) return;
    const force = Boolean(options.force);
    const consumeQueued = Boolean(options.consumeQueued);
    const now = Date.now();
    if (refreshInFlightRef.current) {
      if (force) {
        if (consumeQueued) return;
        if (forceRefreshPendingCountRef.current >= MAX_FORCE_REFRESH_QUEUE) {
          showToast(t('refreshQueueFull'));
          return;
        }
        forceRefreshPendingCountRef.current += 1;
        showToast(t('refreshQueued'));
      }
      return;
    }
    // Coalesce near-simultaneous wake events (focus/visibility/online) without affecting 1s polling cadence.
    if (!force && now - lastRefreshAtRef.current < REFRESH_THROTTLE_MS) return;
    refreshInFlightRef.current = true;
    lastRefreshAtRef.current = now;
    setIsRefreshing(true);
    try {
      const remote = await fetchFromBackend(id);
      if (!remote?.id || remote.id !== id) return;
      const local = gameRef.current;
      if (!local || local.id !== id) return; // guard: game changed while request was in-flight
      // If finished game points to a successor, switch to that game instead of applying old state.
      if (await followSuccessorGame(id, remote.nextGameId)) return;
      if ((remote.updatedAt ?? 0) > (local.updatedAt ?? 0)) {
        setGame(remote);
      }
    } catch { /* offline — silently ignore */ }
    finally {
      refreshInFlightRef.current = false;
      setIsRefreshing(false);
      if (forceRefreshPendingCountRef.current > 0 && gameRef.current?.id === id) {
        forceRefreshPendingCountRef.current -= 1;
        setTimeout(() => {
          refreshFromBackend(id, { force: true, consumeQueued: true });
        }, NEXT_TICK_MS);
      }
    }
  }, [followSuccessorGame, showToast, t]);

  useEffect(() => {
    if (!game?.id || (screen !== 'game' && screen !== 'win')) return;
    const id = game.id;
    const iv = setInterval(() => { refreshFromBackend(id); }, POLL_MS);
    return () => clearInterval(iv);
  }, [game?.id, screen, refreshFromBackend]);

  useEffect(() => {
    if (!game?.id || (screen !== 'game' && screen !== 'win')) return;
    const id = game.id;
    const triggerRefresh = () => { refreshFromBackend(id); };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') triggerRefresh();
    };
    const onPageShow = (event: PageTransitionEvent) => {
      if (event?.persisted) triggerRefresh();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('focus', triggerRefresh);
    window.addEventListener('pageshow', onPageShow);
    window.addEventListener('online', triggerRefresh);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('focus', triggerRefresh);
      window.removeEventListener('pageshow', onPageShow);
      window.removeEventListener('online', triggerRefresh);
    };
  }, [game?.id, screen, refreshFromBackend]);

  /* On mount: load game from ?code=XXXX-XXXX or ?game=<id> URL param (offline-safe) */
  useEffect(() => {
    const urlCode = getRoomCodeFromUrl();
    const urlId   = getGameIdFromUrl();
    const urlLang = getLangFromUrl();

    // Handle room code entry: ?code=XXXX-XXXX
    if (urlCode) {
      fetchGameByRoomCode(urlCode).then(async remote => {
        if (!remote?.id) return;
        if (await followSuccessorGame(remote.id, remote.nextGameId)) return;
        setGame(remote);
        setScreen(remote.phase === 'won' ? 'win' : 'game');
      }).catch(() => {}); // backend offline — silently ignore
      return;
    }

    if (!urlId) return;
    try {
      const params = new URLSearchParams(window.location.search);
      let gameParamCount = 0;
      let langParamCount = 0;
      let hasOnlyAllowedParams = true;
      for (const key of params.keys()) {
        if (key === 'game') gameParamCount += 1;
        else if (key === 'lang') langParamCount += 1;
        else hasOnlyAllowedParams = false;
      }
      const isNormalized =
        hasOnlyAllowedParams &&
        gameParamCount === 1 &&
        langParamCount <= 1 &&
        (!params.has('lang') || !!urlLang);
      if (!isNormalized) setGameUrlParam(urlId, urlLang);
    } catch { /* noop */ }
    const local = readActive();
    if (local?.id === urlId) { setGame(local); setScreen('game'); return; }
    fetchFromBackend(urlId).then(async remote => {
      if (!remote?.id) return;
      if (remote.id !== urlId) return;
      if (await followSuccessorGame(remote.id, remote.nextGameId)) return;
      setGame(remote);
      setScreen(remote.phase === 'won' ? 'win' : 'game');
    }).catch(() => {}); // backend offline — silently ignore
  }, [followSuccessorGame]); // only on mount

  /* When a game is won, archive it and navigate to win screen */
  useEffect(() => {
    if (game?.phase === 'won' && screen === 'game') {
      clearActive();
      pushToHistory(game);
      setHistory(readHistory());
      setScreen('win');
    }
  }, [game?.phase, screen]);

  useEffect(() => {
    if (screen !== 'game' || !game?.id) return;
    const storedPlayer = readPlayerIdentity(game.id);
    setSelectedPlayer(isValidPlayerIndex(storedPlayer, game) ? storedPlayer : null);
  }, [game?.id, game?.players?.length, screen]);

  const lastVibrationRef = useRef<string | null>(null);
  useEffect(() => {
    if (screen !== 'game') lastVibrationRef.current = null;
  }, [screen]);
  useEffect(() => {
    if (screen !== 'game' || game?.phase !== 'playing') return;
    if (!isValidPlayerIndex(selectedPlayer, game) || selectedPlayer !== game.currentPlayer) return;
    const turnStateKey = getTurnStateKey(game);
    if (lastVibrationRef.current === turnStateKey) return;
    lastVibrationRef.current = turnStateKey;
    if (navigator?.vibrate) {
      navigator.vibrate(TURN_VIBRATION_MS);
    }
  }, [game?.currentPlayer, game?.id, game?.phase, game?.round, screen, selectedPlayer]);

  /* Show BUST toast on transition to isBust */
  const wasBustRef = useRef(false);
  useEffect(() => {
    const bust = game?.isBust ?? false;
    if (bust && !wasBustRef.current) showToast(t('bustToast'));
    wasBustRef.current = bust;
  }, [game?.isBust, showToast, t]);

  /* ── Navigation ── */
  const goHome = useCallback(() => { clearGameUrlParam(lang); setGame(null); setScreen('home'); }, [lang]);

  const handleNewGame = useCallback(() => {
    if (readActive()) {
      if (!window.confirm(t('confirmInProgress'))) return;
      clearActive();
    }
    setScreen('setup');
  }, [t]);

  const handleStart = useCallback((players: string[], opts: NewGameOptions) => {
    const previousWon = game?.phase === 'won' ? game : null;
    const g = newGame(players, opts);
    announceNextGame(previousWon, g.id);
    if (g.roomCode) updateRoomCode(g.roomCode, g.id).catch(() => {});
    setGame(g);
    setGameUrlParam(g.id, lang, g.roomCode);
    setScreen('game');
    setShareModalOpen(true);
  }, [announceNextGame, game, lang]);

  const handleResume = useCallback(() => {
    const active = readActive();
    if (active) { setGame(active); setGameUrlParam(active.id, lang, active.roomCode); setScreen('game'); }
  }, [lang]);

  const handleViewGame = useCallback((g: Game) => { setGame(g); setScreen('view'); }, []);

  const handleSelectPlayer = useCallback((playerIndex: number) => {
    if (!game?.id || !isValidPlayerIndex(playerIndex, game)) return;
    writePlayerIdentity(game.id, playerIndex);
    setSelectedPlayer(playerIndex);
  }, [game]);

  const handleDeleteGame = useCallback((id: string) => {
    const h = readHistory().filter(g => g.id !== id);
    writeHistory(h);
    setHistory(h);
  }, []);

  const handleClearHistory = useCallback(() => {
    if (!window.confirm(t('confirmClear'))) return;
    writeHistory([]);
    setHistory([]);
  }, [t]);

  /* ── Game actions ── */
  const dartHit = useCallback((score: number, label: string, isMiss = false) => {
    setGame(prev => {
      if (!prev || prev.darts.length >= 3 || prev.isBust) return prev;
      const remaining = prev.scores[prev.currentPlayer] - prev.turnScore - score;
      if (remaining < 0) return { ...prev, isBust: true, updatedAt: Date.now() };
      const darts     = [...prev.darts, { score, label, isMiss }];
      const turnScore = prev.turnScore + score;
      if (remaining === 0) {
        // Double-out: last dart must be a double (D1–D20 or BULL)
        const isDouble = label.startsWith('D') || label === 'BULL';
        const fm = normalizeFinishMode(prev.finishMode);
        if (fm === 'double' && !isDouble) return { ...prev, isBust: true, updatedAt: Date.now() };
        const scores = [...prev.scores];
        scores[prev.currentPlayer] = 0;
        return { ...prev, darts, turnScore, scores,
                 winner: prev.currentPlayer, phase: 'won', finishedAt: Date.now(), updatedAt: Date.now() };
      }
      return { ...prev, darts, turnScore, updatedAt: Date.now() };
    });
  }, []);

  const undoDart = useCallback(() => {
    setGame(prev => {
      if (!prev) return prev;
      if (prev.isBust) return { ...prev, isBust: false, updatedAt: Date.now() };
      if (prev.darts.length === 0) {
        if (!prev.stateHistory || prev.stateHistory.length === 0) return prev;
        const stateHistory = prev.stateHistory.slice(0, -1);
        const restoredState = prev.stateHistory[prev.stateHistory.length - 1];
        return { ...restoredState, stateHistory, updatedAt: Date.now() };
      }
      const darts = prev.darts.slice(0, -1);
      return { ...prev, darts, turnScore: prev.turnScore - prev.darts[prev.darts.length - 1].score, updatedAt: Date.now() };
    });
  }, []);

  const advancePlayer = useCallback(() => {
    setGame(prev => {
      if (!prev) return prev;
      const scores = [...prev.scores];
      if (!prev.isBust) scores[prev.currentPlayer] -= prev.turnScore;
      const cp = (prev.currentPlayer + 1) % prev.players.length;
      const { stateHistory: _stateHistory, ...snapshot } = prev;
      const stateHistory = [...(prev.stateHistory ?? []), snapshot];
      return { ...prev, scores, currentPlayer: cp,
               round: cp === 0 ? prev.round + 1 : prev.round,
               darts: [], turnScore: 0, isBust: false, updatedAt: Date.now(), stateHistory };
    });
  }, []);

  const handleShare = useCallback(() => {
    setShareModalOpen(true);
  }, []);

  const rematch = useCallback(() => {
    if (!game) return;
    const g = newGame(shufflePlayers(game.players), {
      startScore: game.startScore,
      finishMode: game.finishMode,
      roomCode:   game.roomCode ?? undefined,
    });
    announceNextGame(game, g.id);
    if (g.roomCode) updateRoomCode(g.roomCode, g.id).catch(() => {});
    setGame(g);
    setGameUrlParam(g.id, lang, g.roomCode);
    setScreen('game');
    setShareModalOpen(true);
  }, [announceNextGame, game, lang]);

  const handleJoinByCode = useCallback(async (code: string) => {
    const remote = await fetchGameByRoomCode(code).catch(() => null);
    if (!remote?.id) { showToast(t('gameNotFound')); return; }
    if (await followSuccessorGame(remote.id, remote.nextGameId)) return;
    setGameUrlParam(remote.id, lang, remote.roomCode ?? null);
    setGame(remote);
    setScreen(remote.phase === 'won' ? 'win' : 'game');
  }, [followSuccessorGame, lang, showToast, t]);

  /* ── Render ── */
  return (
    <LangContext.Provider value={{ lang, setLang, t }}>
      <>
        {screen === 'home' && (
          <HomeScreen
            history={history}
            onNewGame={handleNewGame}
            onResume={handleResume}
            onViewGame={handleViewGame}
            onDeleteGame={handleDeleteGame}
            onClearHistory={handleClearHistory}
            onJoinByCode={handleJoinByCode}
          />
        )}
        {screen === 'setup' && (
          <SetupScreen onStart={handleStart} onBack={goHome} />
        )}
        {screen === 'game' && game && (
          <GameScreen
            game={game}
            selectedPlayer={selectedPlayer}
            onSelectPlayer={handleSelectPlayer}
            onDartHit={dartHit}
            onUndo={undoDart}
            onAdvance={advancePlayer}
            onHome={goHome}
            onShare={handleShare}
            onForceRefresh={() => refreshFromBackend(game.id, { force: true })}
            refreshing={isRefreshing}
          />
        )}
        {screen === 'win' && game && (
          <WinScreen
            game={game}
            onRematch={rematch}
            onNewGame={handleNewGame}
            onHome={goHome}
          />
        )}
        {screen === 'view' && game && (
          <WinScreen game={game} onHome={goHome} readOnly={true} />
        )}
        {shareModalOpen && game && (
          <ShareModal
            roomCode={game.roomCode ?? null}
            shareUrl={getGameShareUrl(game.id, lang, game.roomCode)}
            onClose={() => setShareModalOpen(false)}
          />
        )}
        <Toast msg={toastMsg} />
      </>
    </LangContext.Provider>
  );
}
