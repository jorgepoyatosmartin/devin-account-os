import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import en from './en';
import es from './es';
import values from './values';

export type Lang = 'en' | 'es';
type Vars = Record<string, string | number>;
type I18nContextValue = { lang: Lang; setLang: (lang: Lang) => void; t: (key: keyof typeof en, vars?: Vars) => string; tv: (value: string | number | undefined | null) => string };
const context = createContext<I18nContextValue | null>(null);
const interpolate = (value: string, vars?: Vars) => value.replace(/\{(\w+)\}/g, (_, key) => String(vars?.[key] ?? `{${key}}`));
const translateTags = (value: string) => value.replace(/\[(FACT|SOURCE-BASED INTERPRETATION|SALES HYPOTHESIS|UNKNOWN)\]/g, (_, tag) => `[${values[tag] || tag}]`);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => (localStorage.getItem('cognition-pipeline-lang') as Lang) || 'en');
  const setLang = (next: Lang) => { setLangState(next); localStorage.setItem('cognition-pipeline-lang', next); };
  useEffect(() => { document.documentElement.lang = lang; document.title = lang === 'es' ? 'Cognition Pipeline OS — Cuenta' : 'Cognition Pipeline OS — Account OS'; }, [lang]);
  const warned = useMemo(() => new Set<string>(), []);
  const api = useMemo<I18nContextValue>(() => ({
    lang,
    setLang,
    t: (key, vars) => {
      const source = lang === 'es' ? es[key] : en[key];
      if (source === undefined) {
        if (typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname) && !warned.has(String(key))) { warned.add(String(key)); console.warn(`Missing i18n key: ${String(key)}`); }
        return interpolate(en[key] || String(key), vars);
      }
      return interpolate(source, vars);
    },
    tv: (value) => {
      if (value === undefined || value === null) return '';
      if (lang === 'en') return String(value);
      return translateTags(values[String(value)] || String(value));
    },
  }), [lang, warned]);
  return <context.Provider value={api}>{children}</context.Provider>;
}

export function useI18n() {
  const value = useContext(context);
  if (!value) throw new Error('useI18n must be used inside LanguageProvider');
  return value;
}
