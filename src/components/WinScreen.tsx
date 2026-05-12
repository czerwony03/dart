import type { Game } from '../types';
import { useLang } from '../context';
import { fmtDate } from '../game';

interface WinScreenProps {
  game: Game;
  onRematch?: () => void;
  onNewGame?: () => void;
  onHome: () => void;
  readOnly?: boolean;
}

export function WinScreen({ game, onRematch, onNewGame, onHome, readOnly = false }: WinScreenProps) {
  const { t } = useLang();
  return (
    <div className="win-screen">
      {readOnly && (
        <button className="btn btn-gray back-btn" onClick={onHome}>{t('back')}</button>
      )}
      <div className="trophy">🏆</div>
      <div className="win-title">{game.players[game.winner]} {t('wins')}</div>
      <div className="win-sub">{t('game')} {game.startScore} · {t('round')} {game.round}</div>
      {game.finishedAt && <div className="win-date">{fmtDate(game.finishedAt)}</div>}

      <div className="final-scores">
        {game.players.map((name, i) => (
          <div key={i} className={`fs-row${i === game.winner ? ' winner-row' : ''}`}>
            <span>{name}{i === game.winner ? ' 🏆' : ''}</span>
            <span>{game.scores[i]}</span>
          </div>
        ))}
      </div>

      <div className="win-actions">
        {readOnly ? (
          <button className="btn btn-red"
                  style={{ fontSize: '1.1rem', padding: '1rem' }}
                  onClick={onHome}>{t('backToHome')}</button>
        ) : (
          <>
            <button className="btn btn-red"
                    style={{ fontSize: '1.1rem', padding: '1rem' }}
                    onClick={onRematch}>{t('rematch')}</button>
            <button className="btn btn-gray" style={{ padding: '0.9rem' }}
                    onClick={onNewGame}>{t('newGameBtn')}</button>
            <button className="btn btn-gray" style={{ padding: '0.9rem' }}
                    onClick={onHome}>{t('home')}</button>
          </>
        )}
      </div>
    </div>
  );
}
