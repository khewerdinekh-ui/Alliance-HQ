export const LOCALES = ["en", "es", "fr", "ar", "it", "pl", "cs"] as const;
export type Locale = (typeof LOCALES)[number];

export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  es: "Español",
  fr: "Français",
  ar: "العربية",
  it: "Italiano",
  pl: "Polski",
  cs: "Čeština",
};

export const RTL_LOCALES: ReadonlySet<Locale> = new Set(["ar"]);

export const LOCALE_COOKIE = "locale";
export const DEFAULT_LOCALE: Locale = "en";
