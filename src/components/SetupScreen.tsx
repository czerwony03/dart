import { useState } from 'react';
import type { FinishMode, NewGameOptions } from '../types';
import { useLang } from '../context';
import { MAX_PLAYERS } from '../constants';
import { shufflePlayers, updatePlayerSuggestions, getPlayerNameSuggestions } from '../game';

interface SetupScreenProps {
  onStart: (players: string[], opts: NewGameOptions) => void;
  onBack: () => void;
}

export function SetupScreen({ onStart, onBack }: SetupScreenProps) {
  const { t } = useLang();
  const [players,    setPlayers]    = useState(['', '']);
  const [startScore, setStartScore] = useState<number>(501);
  const [finishMode, setFinishMode] = useState<FinishMode>('double');
  const [error,      setError]      = useState('');
  const [nameSuggestions, setNameSuggestions] = useState<string[]>(() => getPlayerNameSuggestions());
  const listId = 'player-name-suggestions';

  const updateName = (i: number, val: string) => setPlayers(prev => { const p = [...prev]; p[i] = val; return p; });
  const addPlayer  = ()         => { if (players.length < MAX_PLAYERS) setPlayers(p => [...p, '']); };
  const delPlayer  = (i: number) => setPlayers(p => p.filter((_, j) => j !== i));
  const handleShuffle = ()      => setPlayers(prev => shufflePlayers(prev));
  const canShuffle = players.map(n => n.trim()).filter(Boolean).length > 1;

  const handleStart = () => {
    const names = players.map(n => n.trim()).filter(Boolean);
    if (names.length < 2) { setError(t('minPlayers')); return; }
    setError('');
    setNameSuggestions(updatePlayerSuggestions(names));
    onStart(names, { startScore, finishMode });
  };

  const handleKey = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    if (i < players.length - 1) document.getElementById(`pname-${i + 1}`)?.focus();
    else handleStart();
  };

  return (
    <div className="setup-screen">
      <button className="btn btn-gray back-btn" onClick={onBack}>{t('back')}</button>
      <span className="setup-emoji">🎯</span>
      <h1 className="setup-title">{t('newGameTitle')}</h1>
      <p className="setup-subtitle">{t('enterNames')}</p>

      <div className="player-list">
        {players.map((name, i) => (
          <div key={i} className="player-row">
            <span className="player-num">{i + 1}.</span>
            <input
              id={`pname-${i}`}
              type="text"
              value={name}
              placeholder={`${t('playerPlaceholder')} ${i + 1}`}
              maxLength={20}
              autoComplete="off"
              list={nameSuggestions.length > 0 ? listId : undefined}
              inputMode="text"
              enterKeyHint="next"
              onChange={e => updateName(i, e.target.value)}
              onKeyDown={e => handleKey(i, e)}
            />
            {players.length > 2 && (
              <button className="btn btn-gray btn-icon"
                      aria-label={`${t('removePlayer')} ${i + 1}`}
                      onClick={() => delPlayer(i)}>✕</button>
            )}
          </div>
        ))}
      </div>
      {nameSuggestions.length > 0 && (
        <datalist id={listId}>
          {nameSuggestions.map(name => <option key={name} value={name} />)}
        </datalist>
      )}

      <div className="finish-toggle-row">
        <span className="finish-toggle-label">{t('startScore')}</span>
        <div className="finish-toggle">
          {([501, 301] as const).map(s => (
            <button key={s}
                    className={`finish-btn${startScore === s ? ' finish-active' : ''}`}
                    onClick={() => setStartScore(s)}>{s}</button>
          ))}
        </div>
      </div>

      <div className="finish-toggle-row">
        <span className="finish-toggle-label">{t('finishMode')}</span>
        <div className="finish-toggle">
          <button className={`finish-btn${finishMode === 'single' ? ' finish-active' : ''}`}
                  onClick={() => setFinishMode('single')}>{t('singleOut')}</button>
          <button className={`finish-btn${finishMode === 'double' ? ' finish-active' : ''}`}
                  onClick={() => setFinishMode('double')}>{t('doubleOut')}</button>
        </div>
      </div>

      <div className="setup-actions">
        {players.length < MAX_PLAYERS && (
          <button className="btn btn-gray" onClick={addPlayer}>{t('addPlayer')}</button>
        )}
        <button className="btn btn-gray"
                aria-label={t('shufflePlayers')}
                onClick={handleShuffle}
                disabled={!canShuffle}>{t('shufflePlayers')}</button>
        <button className="btn btn-red"
                style={{ fontSize: '1.1rem', padding: '1rem' }}
                onClick={handleStart}>{t('startGame')}</button>
        {error && <p className="setup-error">{error}</p>}
      </div>
    </div>
  );
}
