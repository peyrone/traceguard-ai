import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { thai } from './th';

type Language = 'th' | 'en';
const preferenceKey = 'traceguard-language';
const english = (text: string) => text;
const translateThai = (text: string) => Object.hasOwn(thai, text) ? thai[text] : text;

function initialLanguage(): Language {
  try {
    const saved = localStorage.getItem(preferenceKey);
    if (saved === 'th' || saved === 'en') return saved;
  } catch { /* The current session can still switch languages. */ }
  return typeof navigator !== 'undefined' && /^th\b/i.test(navigator.language) ? 'th' : 'en';
}

interface LanguageState {
  language: Language;
  changeLanguage: (language: Language) => void;
  t: (text: string) => string;
}

const LanguageContext = createContext<LanguageState>({ language: 'en', changeLanguage: () => {}, t: english });

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState(initialLanguage);
  useEffect(() => { document.documentElement.lang = language; }, [language]);

  function changeLanguage(next: Language) {
    setLanguage(next);
    try { localStorage.setItem(preferenceKey, next); } catch { /* Keep the session preference. */ }
  }

  return <LanguageContext.Provider value={{ language, changeLanguage, t: language === 'th' ? translateThai : english }}>
    {children}
  </LanguageContext.Provider>;
}

export function useLanguage() {
  return useContext(LanguageContext);
}
