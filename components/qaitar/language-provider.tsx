"use client";

import { createContext, useContext, useEffect, useSyncExternalStore } from "react";

import { getMessages, normalizeLocale, type Locale } from "../../lib/i18n/index.ts";

const STORAGE_KEY = "qaitar.language.v1";
const LANGUAGE_EVENT = "qaitar-language-change";

function subscribeLanguage(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(LANGUAGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(LANGUAGE_EVENT, callback);
  };
}

function getLocaleSnapshot() {
  return normalizeLocale(window.localStorage.getItem(STORAGE_KEY));
}

function getServerLocale(): Locale { return "ru"; }
const LanguageContext = createContext<{
  locale: Locale;
  setLocale: (locale: Locale) => void;
  messages: ReturnType<typeof getMessages>;
} | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const locale = useSyncExternalStore(subscribeLanguage, getLocaleSnapshot, getServerLocale);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  function setLocale(next: Locale) {
    window.localStorage.setItem(STORAGE_KEY, next);
    window.dispatchEvent(new Event(LANGUAGE_EVENT));
  }

  return <LanguageContext.Provider value={{ locale, setLocale, messages: getMessages(locale) }}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("LanguageProvider is missing");
  return context;
}
