import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { sq } from './translations';

export type Language = 'en' | 'sq';

const STORAGE_KEY = 'risklens.language.v1';

type LanguageContextValue = {
  language: Language;
  setLanguage: (lang: Language) => void;
  ready: boolean;
};

const LanguageContext = createContext<LanguageContextValue>({
  language: 'en',
  setLanguage: () => {},
  ready: true,
});

/**
 * Core translation function. The English string IS the key, so any text that
 * hasn't been translated yet simply falls back to English instead of breaking.
 * Surrounding whitespace is preserved (e.g. "Within " -> "Brenda ") so the
 * auto-translating <Text> can translate individual segments of interpolated
 * strings like <Text>Within {n} days</Text>.
 *
 * Supports {placeholder} interpolation via the optional vars argument.
 */
export function translate(text: string, language: Language, vars?: Record<string, string | number>) {
  let result = text;

  if (language === 'sq' && typeof text === 'string') {
    const match = text.match(/^(\s*)([\s\S]*?)(\s*)$/);
    if (match) {
      const [, lead, core, trail] = match;
      const translated = sq[core];
      if (translated !== undefined) {
        result = lead + translated + trail;
      }
    }
  }

  if (vars) {
    for (const key of Object.keys(vars)) {
      result = result.split(`{${key}}`).join(String(vars[key]));
    }
  }

  return result;
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (active && (stored === 'en' || stored === 'sq')) {
          setLanguageState(stored);
        }
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    AsyncStorage.setItem(STORAGE_KEY, lang).catch(() => {});
  }, []);

  const value = useMemo(() => ({ language, setLanguage, ready }), [language, setLanguage, ready]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  return useContext(LanguageContext);
}

/**
 * Hook returning a `t(text, vars?)` function bound to the current language.
 * Use for strings that are NOT plain <Text> children — placeholders, Alert
 * dialogs, and dynamically built sentences.
 */
export function useT() {
  const { language } = useLanguage();
  return useCallback(
    (text: string, vars?: Record<string, string | number>) => translate(text, language, vars),
    [language]
  );
}
