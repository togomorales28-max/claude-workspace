import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Borrador local con guardado automático. Guarda 500 ms después del último cambio,
 * y también al salir de la pantalla o al ocultar la app, para no perder información.
 */
export function useDraft<T>(load: () => Promise<T | undefined>, save: (v: T) => Promise<unknown>, deps: unknown[]) {
  const [draft, setDraftState] = useState<T | undefined | null>(undefined); // undefined = cargando, null = no existe
  const [status, setStatus] = useState<'idle' | 'pending' | 'saved' | 'error'>('idle');
  const pending = useRef<T | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const saveRef = useRef(save);
  saveRef.current = save;

  const flush = useCallback(async () => {
    clearTimeout(timer.current);
    const v = pending.current;
    if (!v) return;
    pending.current = null;
    try { await saveRef.current(v); setStatus('saved'); } catch { setStatus('error'); pending.current = v; }
  }, []);

  useEffect(() => {
    let alive = true;
    load().then((v) => alive && setDraftState(v ?? null));
    return () => { alive = false; void flush(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    const h = () => { if (document.visibilityState === 'hidden') void flush(); };
    const u = () => { void flush(); };
    document.addEventListener('visibilitychange', h);
    window.addEventListener('pagehide', u);
    return () => { document.removeEventListener('visibilitychange', h); window.removeEventListener('pagehide', u); };
  }, [flush]);

  const setDraft = useCallback((fn: (d: T) => T) => {
    setDraftState((d) => {
      if (!d) return d;
      const next = fn(d);
      pending.current = next;
      setStatus('pending');
      clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), 500);
      return next;
    });
  }, [flush]);

  return { draft, setDraft, status, flush };
}
