import { useCallback, useEffect, useRef, useState } from 'react';
import { applyOffline, newGame, SAVE_VERSION, tick } from './engine';
import type { ActionResult } from './engine';
import type { GameState } from './types';

const KEY = 'saas-tycoon-save-v' + SAVE_VERSION;

export function loadSave(): GameState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as GameState;
    if (s.version !== SAVE_VERSION) return null;
    applyOffline(s, Date.now());
    return s;
  } catch { return null; }
}
export function hasSave() { return !!localStorage.getItem(KEY); }
export function clearSave() { localStorage.removeItem(KEY); }
function persist(s: GameState) {
  s.lastSaved = Date.now();
  localStorage.setItem(KEY, JSON.stringify(s));
}

export interface Toast { id: number; text: string; good: boolean }

export function useGame(initial: GameState | null) {
  const [state, setState] = useState<GameState | null>(initial);
  const ref = useRef(state);
  useEffect(() => { ref.current = state; }, [state]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(1);

  const pushToast = useCallback((text: string, good: boolean) => {
    const id = toastId.current++;
    setToasts(t => [...t.slice(-3), { id, text, good }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500);
  }, []);

  // mutate helper: clones, applies fn, saves
  const act = useCallback((fn: (s: GameState) => ActionResult | void, toast = true) => {
    const cur = ref.current;
    if (!cur) return;
    const next = structuredClone(cur);
    const res = fn(next);
    if (res && !res.ok) { if (toast) pushToast(res.msg, false); return; }
    if (res && toast) pushToast(res.msg, !!res.good);
    persist(next);
    ref.current = next;
    setState(next);
  }, [pushToast]);

  // game clock
  useEffect(() => {
    const iv = setInterval(() => {
      const cur = ref.current;
      if (!cur || cur.speed === 0 || cur.modals.length > 0) return;
      const next = structuredClone(cur);
      for (let i = 0; i < cur.speed; i++) tick(next);
      persist(next);
      ref.current = next;
      setState(next);
    }, 1000);
    return () => clearInterval(iv);
  }, []);

  const start = useCallback((name: string) => { const s = newGame(name); persist(s); ref.current = s; setState(s); }, []);
  const reset = useCallback(() => { clearSave(); ref.current = null; setState(null); }, []);

  return { state, act, start, reset, toasts };
}
