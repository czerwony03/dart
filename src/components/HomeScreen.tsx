import type { Game } from '../types';
import { useLang } from '../context';
import { readActive } from '../storage';
import { playerAvg, fmtDate } from '../game';

interface HomeScreenProps {
  history: Game[];
  onNewGame: () => void;
  onResume: () => void;
  onViewGame: (g: Game) => void;
  onDeleteGame: (id: string) => void;
  onClearHistory: () => void;
}

export function HomeScreen({ history, onNewGame, onResume, onViewGame, onDeleteGame, onClearHistory }: HomeScreenProps) {
  const { t, lang, setLang } = useLang();
  const active = readActive();

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    onDeleteGame(id);
  };

  return (
    <div className="home-screen">
      <div className="lang-selector">
        <button className={`lang-btn${lang === 'en' ? ' lang-active' : ''}`} onClick={() => setLang('en')}>EN</button>
        <button className={`lang-btn${lang === 'pl' ? ' lang-active' : ''}`} onClick={() => setLang('pl')}>PL</button>
      </div>

      <div className="home-header">
        <span className="home-emoji">🎯</span>
        <h1 className="home-title">Dart 501</h1>
      </div>

      {active && (
        <div className="active-card">
          <div>
            <span className="active-badge">{t('inProgress')}</span>
            <div className="active-players">{active.players.join(' · ')}</div>
            <div className="active-meta">{t('round')} {active.round}</div>
          </div>
          <button className="btn btn-green" onClick={onResume}>{t('resume')}</button>
        </div>
      )}

      <button className="btn btn-red home-full-width"
              style={{ fontSize: '1.1rem', padding: '1rem' }}
              onClick={onNewGame}>
        {t('newGame')}
      </button>

      {history.length > 0 && (
        <div className="history-section">
          <div className="history-header">
            <span className="history-title">{t('pastGames')}</span>
            <button className="btn btn-gray btn-sm" onClick={onClearHistory}>{t('clearAll')}</button>
          </div>
          <div className="history-list">
            {history.map(g => (
              <div key={g.id} className="hist-item"
                   role="button" tabIndex={0}
                   onClick={() => onViewGame(g)}
                   onKeyDown={e => e.key === 'Enter' && onViewGame(g)}>
                <div className="hist-info">
                  <div className="hist-winner">🏆 {g.players[g.winner]}</div>
                  <div className="hist-player-list">
                    {g.players.map((name, i) => (
                      <div key={i} className="hist-player-row">
                        <span>{name}</span>
                        <span className="hp-avg">{playerAvg(g, i)} {t('avg')}</span>
                      </div>
                    ))}
                  </div>
                  <div className="hist-meta">{g.round} {t('rounds')} · {fmtDate(g.finishedAt)}</div>
                </div>
                <button className="btn btn-gray btn-icon del-btn"
                        aria-label={t('deleteGame')}
                        onClick={e => handleDelete(e, g.id)}>✕</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {history.length === 0 && !active && (
        <p className="empty-hint">{t('emptyHint')}</p>
      )}
    </div>
  );
}
