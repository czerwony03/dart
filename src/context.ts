import { createContext, useContext, useState, useCallback, useRef } from 'react';
import type { LangContextValue } from './types';

export const LangContext = createContext<LangContextValue>({
  lang: 'en',
  setLang: () => {},
  t: k => k,
});

export function useLang(): LangContextValue {
  return useContext(LangContext);
}

export function useToast(): [string, (msg: string) => void] {
  const [msg, setMsg]  = useState('');
  const timerRef       = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show           = useCallback((m: string) => {
    setMsg(m);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setMsg(''), 950);
  }, []);
  return [msg, show];
}
