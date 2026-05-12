import { useState } from 'react';
import { useLang } from '../context';

interface ShareModalProps {
  roomCode: string | null;
  shareUrl: string;
  onClose: () => void;
}

export function ShareModal({ roomCode, shareUrl, onClose }: ShareModalProps) {
  const { t } = useLang();
  const [codeCopied, setCodeCopied] = useState(false);
  const [urlCopied, setUrlCopied] = useState(false);

  const handleCopyCode = () => {
    if (!roomCode) return;
    navigator.clipboard.writeText(roomCode).then(() => {
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    }).catch(() => {});
  };

  const handleShareUrl = () => {
    if (navigator.share) {
      navigator.share({ url: shareUrl, title: '🎯 Dart 501' }).catch(() => {});
    } else {
      navigator.clipboard.writeText(shareUrl).then(() => {
        setUrlCopied(true);
        setTimeout(() => setUrlCopied(false), 2000);
      }).catch(() => {});
    }
  };

  return (
    <div className="share-modal-backdrop" onClick={onClose}>
      <div className="share-modal" role="dialog" aria-modal="true" aria-labelledby="share-modal-title" onClick={e => e.stopPropagation()}>
        <div className="share-modal-header">
          <div id="share-modal-title" className="share-modal-title">{t('shareGameTitle')}</div>
          <button className="btn btn-gray btn-sm" onClick={onClose}>{t('close')}</button>
        </div>

        {roomCode && (
          <div className="share-code-section">
            <div className="share-code-label">{t('gameCode')}</div>
            <div className="share-code-display">{roomCode}</div>
            <div className="share-code-hint">{t('gameCodeHint')}</div>
            <button
              className={`btn ${codeCopied ? 'btn-green' : 'btn-gray'} share-btn`}
              onClick={handleCopyCode}>
              {codeCopied ? t('codeCopied') : t('copyCode')}
            </button>
          </div>
        )}

        <div className="share-url-section">
          <button
            className={`btn ${urlCopied ? 'btn-green' : 'btn-red'} share-btn`}
            onClick={handleShareUrl}>
            {urlCopied ? t('linkCopied') : t('shareUrl')}
          </button>
        </div>
      </div>
    </div>
  );
}
