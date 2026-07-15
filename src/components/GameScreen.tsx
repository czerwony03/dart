import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { Game } from '../types';
import { useLang } from '../context';
import { LIVE_MESSAGE_DURATION_MS, SLOW_REFRESH_MODAL_DELAY_MS } from '../constants';
import { normalizeFinishMode, isValidPlayerIndex, hasUndoableState } from '../game';
import { calculateCheckout } from '../checkout';
import { Dartboard } from './Dartboard';

interface GameScreenProps {
  game: Game;
  selectedPlayer: number | null;
  onSelectPlayer: (i: number) => void;
  onDartHit: (score: number, label: string, isMiss?: boolean) => void;
  onUndo: () => void;
  onAdvance: () => void;
  onHome: () => void;
  onShare: () => void;
  onForceRefresh: () => void;
  refreshing: boolean;
}

export function GameScreen({
  game, selectedPlayer, onSelectPlayer, onDartHit, onUndo, onAdvance,
  onHome, onShare, onForceRefresh, refreshing,
}: GameScreenProps) {
  const { t } = useLang();
  const [manualVal, setManualVal] = useState('');
  const [manualErr, setManualErr] = useState(false);
  const [historyModal, setHistoryModal] = useState<number | 'all' | null>(null);
  const [liveRefreshMsg, setLiveRefreshMsg] = useState('');
  const [showSlowRefreshModal, setShowSlowRefreshModal] = useState(false);
  const [slowRefreshDismissed, setSlowRefreshDismissed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const wasRefreshingRef = useRef(false);

  useEffect(() => {
    const wasRefreshing = wasRefreshingRef.current;
    if (refreshing && !wasRefreshing) setLiveRefreshMsg(t('refreshingNow'));
    if (!refreshing && wasRefreshing) setLiveRefreshMsg(t('refreshComplete'));
    wasRefreshingRef.current = refreshing;
  }, [refreshing, t]);
  useEffect(() => {
    if (!liveRefreshMsg) return undefined;
    const timeoutId = setTimeout(() => setLiveRefreshMsg(''), LIVE_MESSAGE_DURATION_MS);
    return () => clearTimeout(timeoutId);
  }, [liveRefreshMsg]);

  useEffect(() => {
    if (!refreshing) {
      setShowSlowRefreshModal(false);
      setSlowRefreshDismissed(false);
      return undefined;
    }
    if (slowRefreshDismissed) return undefined;
    const timeoutId = setTimeout(() => setShowSlowRefreshModal(true), SLOW_REFRESH_MODAL_DELAY_MS);
    return () => clearTimeout(timeoutId);
  }, [refreshing, slowRefreshDismissed]);

  const closeSlowRefreshModal = useCallback(() => {
    setShowSlowRefreshModal(false);
    setSlowRefreshDismissed(true);
  }, []);

  const retrySlowRefresh = useCallback(() => {
    setShowSlowRefreshModal(false);
    setSlowRefreshDismissed(true);
    onForceRefresh();
  }, [onForceRefresh]);

  const cp     = game.currentPlayer;
  const locked = game.darts.length >= 3 || game.isBust;
  const hasValidPlayerSelection = isValidPlayerIndex(selectedPlayer, game);
  const controlsLocked = locked || !hasValidPlayerSelection;
  const canUndo = hasValidPlayerSelection && hasUndoableState(game);
  const handleBoardHit = useCallback((score: number, label: string) => {
    if (controlsLocked) return;
    onDartHit(score, label);
  }, [controlsLocked, onDartHit]);

  const nextLabel = (game.darts.length >= 3 || game.isBust)
    ? t('nextPlayer')
    : game.darts.length === 0 ? t('skipTurn') : t('doneNext');

  // Checkout hints
  const finishMode = normalizeFinishMode(game.finishMode);
  const remaining = game.scores[cp] - game.turnScore;
  const dartsLeft = 3 - game.darts.length;
  const checkout  = (!game.isBust && dartsLeft > 0)
    ? calculateCheckout(remaining, dartsLeft, finishMode)
    : null;

  const turnHistoryByPlayer = useMemo(() => {
    const snapshots = Array.isArray(game.stateHistory) ? game.stateHistory : [];
    const turns = snapshots
      .filter(st => Number.isInteger(st.currentPlayer))
      .map((st, idx) => ({
        id: `snap-${idx}`,
        player: st.currentPlayer,
        round: st.round,
        points: st.isBust ? 0 : st.turnScore,
        bust: Boolean(st.isBust),
        darts: Array.isArray(st.darts) ? st.darts.map(d => d.label).filter(Boolean) : [] as string[],
      }));

    if ((game.phase === 'playing' || game.phase === 'won') && (game.darts.length > 0 || game.isBust)) {
      turns.push({
        id: 'current-turn',
        player: game.currentPlayer,
        round: game.round,
        points: game.isBust ? 0 : game.turnScore,
        bust: Boolean(game.isBust),
        darts: game.darts.map(d => d.label).filter(Boolean),
      });
    }

    const grouped: (typeof turns)[] = game.players.map(() => []);
    turns.forEach(turn => {
      if (grouped[turn.player]) grouped[turn.player].push(turn);
    });
    return grouped;
  }, [
    game.stateHistory,
    game.phase,
    game.darts,
    game.isBust,
    game.currentPlayer,
    game.round,
    game.turnScore,
    game.players,
  ]);

  const submitManual = () => {
    const v = parseInt(manualVal, 10);
    if (isNaN(v) || v < 0 || v > 60) {
      setManualErr(true);
      setTimeout(() => setManualErr(false), 700);
      return;
    }
    onDartHit(v, String(v), false);
    setManualVal('');
    inputRef.current?.focus();
  };

  return (
    <div className="game-screen">
      <div className="game-header">
        <span className="round-badge">{t('round')} {game.round}</span>
        <span className="cp-name">{game.players[cp]}</span>
        <div className="header-right">
          <span className="dart-counter">{game.darts.length}/3 🎯</span>
          <button className="btn btn-icon history-icon"
                  type="button"
                  onClick={() => setHistoryModal('all')}
                  aria-label={t('viewAllHistory')}>☰</button>
          <button className="btn btn-icon refresh-icon"
                  type="button"
                  onClick={onForceRefresh}
                  aria-label={t('refreshNow')}
                  aria-busy={refreshing}>
            <span className={`refresh-glyph${refreshing ? ' refresh-glyph-spinning' : ''}`} aria-hidden="true">⟳</span>
          </button>
          <span className="sr-only" aria-live="polite">{liveRefreshMsg}</span>
          <button className="btn btn-icon share-icon" onClick={onShare} aria-label={t('shareGame')}>⎋</button>
          <button className="btn btn-icon home-icon" onClick={onHome} aria-label={t('goHome')}>⌂</button>
        </div>
      </div>

      <div className="scoreboard">
        {game.players.map((name, i) => {
          const roundsCompleted = i < cp ? game.round : game.round - 1;
          const pointsScored    = game.startScore - game.scores[i];
          const avg             = roundsCompleted > 0 ? (pointsScored / roundsCompleted).toFixed(1) : '—';
          return (
            <button key={i}
                    type="button"
                    className={`score-card score-card-btn${i === cp ? ' active' : ''}${i === selectedPlayer ? ' score-card-self' : ''}`}
                    onClick={() => setHistoryModal(i)}
                    aria-label={`${t('playerHistory')}: ${name}`}>
              <span className={`sc-name${i === selectedPlayer ? ' sc-name-self' : ''}`}>{name}</span>
              <span className="sc-val">{game.scores[i]}</span>
              <span className="sc-avg">{t('avg')} {avg}</span>
            </button>
          );
        })}
      </div>

      <div className="dartboard-wrap">
        <Dartboard onHit={handleBoardHit} />
      </div>

      <div className="game-bottom">
        <div className="throw-row">
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {checkout && (
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                {[0, 1, 2].map(i => {
                  const hintIdx = i - game.darts.length;
                  const hint = (hintIdx >= 0 && hintIdx < checkout.length) ? checkout[hintIdx] : null;
                  return <div key={i} className="checkout-hint">{hint ?? ''}</div>;
                })}
              </div>
            )}
            <div className="dart-chips">
              {[0, 1, 2].map(i => {
                const d = game.darts[i];
                if (!d) return <div key={i} className="chip chip-empty">·</div>;
                return <div key={i} className={`chip ${d.isMiss ? 'chip-miss' : 'chip-used'}`}>{d.label}</div>;
              })}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="turn-lbl">{t('turn')}</div>
            <div className="turn-score">
              <div className="turn-val">{game.turnScore}</div>
              <div className="turn-left">{remaining}</div>
            </div>
          </div>
        </div>

        {game.isBust && <div className="bust-bar">{t('bust')}</div>}

        <div className="manual-row">
          <input
            ref={inputRef}
            type="number"
            min="0" max="60"
            placeholder={t('manualHint')}
            inputMode="numeric"
            value={manualVal}
            disabled={controlsLocked}
            style={manualErr ? { borderColor: '#e94560' } : {}}
            onChange={e => setManualVal(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submitManual()}
          />
          <button className="btn btn-amber" disabled={controlsLocked}
                  onClick={() => onDartHit(0, 'Miss', true)}>{t('miss')}</button>
          <button className="btn btn-green" disabled={controlsLocked}
                  onClick={submitManual}>{t('add')}</button>
        </div>

        <div className="action-row">
          <button className="btn btn-gray" style={{ flex: 1 }}
                  disabled={!canUndo}
                  onClick={onUndo}>{t('undo')}</button>
          <button className="btn btn-red" style={{ flex: 2 }}
                  disabled={!hasValidPlayerSelection}
                  onClick={onAdvance}>{nextLabel}</button>
        </div>
      </div>

      {!hasValidPlayerSelection && (
        <div className="history-modal-backdrop">
          <div className="identity-modal" role="dialog" aria-modal="true" aria-labelledby="identity-modal-title">
            <div id="identity-modal-title" className="identity-modal-title">{t('whoAreYou')}</div>
            <div className="identity-modal-hint">{t('choosePlayer')}</div>
            <div className="identity-player-list">
              {game.players.map((name, i) => (
                <button
                  key={i}
                  type="button"
                  className="btn identity-player-btn"
                  onClick={() => onSelectPlayer(i)}>
                  {name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {showSlowRefreshModal && refreshing && (
        <div className="history-modal-backdrop">
          <div className="slow-refresh-modal" role="dialog" aria-modal="true" aria-labelledby="slow-refresh-title">
            <div id="slow-refresh-title" className="slow-refresh-title">{t('slowRefreshTitle')}</div>
            <div className="slow-refresh-body">{t('slowRefreshBody')}</div>
            <div className="slow-refresh-spinner" aria-hidden="true">
              <span className="refresh-glyph refresh-glyph-spinning">⟳</span>
            </div>
            <div className="slow-refresh-actions">
              <button className="btn btn-gray" type="button" onClick={closeSlowRefreshModal}>{t('keepWaiting')}</button>
              <button className="btn btn-green" type="button" onClick={retrySlowRefresh}>{t('retryRefresh')}</button>
            </div>
          </div>
        </div>
      )}

      {historyModal !== null && (
        <div className="history-modal-backdrop" onClick={() => setHistoryModal(null)}>
          <div className="history-modal" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
            <div className="history-modal-header">
              <div className="history-modal-title">
                {historyModal === 'all'
                  ? t('allPlayersHistory')
                  : `${game.players[historyModal as number]} · ${t('history')}`}
              </div>
              <button className="btn btn-gray btn-sm" onClick={() => setHistoryModal(null)}>{t('close')}</button>
            </div>
            <div className="history-modal-content">
              {(historyModal === 'all' ? game.players.map((_, i) => i) : [historyModal as number]).map(i => {
                const turns = turnHistoryByPlayer[i] ?? [];
                return (
                  <div key={i} className="history-player-block">
                    {historyModal === 'all' && <div className="history-player-name">{game.players[i]}</div>}
                    {turns.length === 0 ? (
                      <div className="history-empty">{t('noTurnsYet')}</div>
                    ) : (
                      <div className="history-turn-list">
                        {turns.map(turn => (
                          <div key={turn.id} className="history-turn-row">
                            <span>{t('round')} {turn.round} · {turn.points} {t('pointsShort')}</span>
                            <span className="history-turn-meta">
                              {turn.bust ? t('bustShort') : (turn.darts.length ? turn.darts.join(', ') : '—')}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
