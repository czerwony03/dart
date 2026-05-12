import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';
import { App } from './App';

const sentry = (window as unknown as { Sentry?: { init: (opts: unknown) => void; captureMessage: (msg: string, level: string) => void; captureException: (err: unknown) => void } }).Sentry;
if (sentry) {
  sentry.init({
    dsn: 'https://9a68ba7c3e7a123929063f6bec63c34c@o4509889334083584.ingest.de.sentry.io/4511236468113488',
    sendDefaultPii: true,
  });

  const toMessage = (args: unknown[]): string => args.map(arg => {
    if (arg instanceof Error) return arg.stack ?? arg.message;
    if (typeof arg === 'string') return arg;
    try { return JSON.stringify(arg); } catch { return String(arg); }
  }).join(' ');

  const rawConsoleWarn = console.warn.bind(console);
  const rawConsoleError = console.error.bind(console);

  console.warn = (...args: unknown[]) => {
    sentry.captureMessage(toMessage(args), 'warning');
    rawConsoleWarn(...args);
  };

  console.error = (...args: unknown[]) => {
    if (args[0] instanceof Error) {
      sentry.captureException(args[0]);
    } else {
      sentry.captureMessage(toMessage(args), 'error');
    }
    rawConsoleError(...args);
  };
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
