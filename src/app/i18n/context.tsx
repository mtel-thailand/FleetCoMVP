import { cloneElement, createContext, useCallback, useContext, useLayoutEffect, useMemo, useState, type ReactElement } from "react";
import { getLanguage, setActiveLanguage, translate, type Language } from "./core";

type I18nValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  toggleLanguage: () => void;
  t: (source: string, values?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nValue | null>(null);

export function LanguageProvider({ children }: { children: ReactElement<{ i18nLanguage?: Language }> }) {
  const [language, setLanguageState] = useState<Language>(() => getLanguage());

  const setLanguage = useCallback((next: Language) => {
    setActiveLanguage(next);
    setLanguageState(next);
  }, []);

  const toggleLanguage = useCallback(() => {
    setLanguage(language === "en" ? "th" : "en");
  }, [language, setLanguage]);

  const value = useMemo<I18nValue>(() => ({
    language,
    setLanguage,
    toggleLanguage,
    t: (source, values) => translate(source, values, language),
  }), [language, setLanguage, toggleLanguage]);

  useLayoutEffect(() => {
    const attributes = ["title", "placeholder", "aria-label", "alt"] as const;
    for (const attribute of attributes) {
      document.querySelectorAll<HTMLElement>(`[data-i18n-${attribute}]`).forEach((element) => {
        const source = element.getAttribute(`data-i18n-${attribute}`);
        if (source !== null) element.setAttribute(attribute, translate(source, undefined, language));
      });
    }
  }, [language]);

  // A changing prop makes the application render again without remounting
  // it, so open forms and local page state survive a language switch.
  return <I18nContext.Provider value={value}>{cloneElement(children, { i18nLanguage: language })}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n must be used inside LanguageProvider");
  return value;
}
