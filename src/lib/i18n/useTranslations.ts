"use client";

import { useEffect, useState } from "react";
import { LOCALES, DEFAULT_LOCALE, LOCALE_COOKIE, type Locale } from "./locales";
import { dictionaries } from "./dictionaries";

function readLocaleCookie(): Locale {
  if (typeof document === "undefined") return DEFAULT_LOCALE;
  const match = document.cookie.match(new RegExp(`(?:^|; )${LOCALE_COOKIE}=([^;]*)`));
  const value = match ? decodeURIComponent(match[1]) : "";
  return (LOCALES as readonly string[]).includes(value) ? (value as Locale) : DEFAULT_LOCALE;
}

export function useTranslations(initialLocale?: Locale) {
  const [locale, setLocale] = useState<Locale>(initialLocale ?? DEFAULT_LOCALE);

  useEffect(() => {
    if (!initialLocale) setLocale(readLocaleCookie());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dict = dictionaries[locale];
  return { locale, t: (key: keyof typeof dict) => dict[key] };
}
