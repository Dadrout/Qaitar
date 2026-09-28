import { en } from "./en.ts";
import { kk } from "./kk.ts";
import { ru } from "./ru.ts";

export type Locale = "ru" | "kk" | "en";

export function normalizeLocale(value: unknown): Locale {
  return value === "kk" || value === "en" ? value : "ru";
}

export function getMessages(locale: Locale): typeof ru {
  return { ru, kk, en }[locale];
}

export function languageName(locale: Locale) {
  return { ru: "Русский", kk: "Қазақша", en: "English" }[locale];
}

export function responseLanguage(locale: Locale) {
  return { ru: "русском", kk: "казахском", en: "английском" }[locale];
}
