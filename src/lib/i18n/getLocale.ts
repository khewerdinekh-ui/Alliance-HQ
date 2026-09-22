import { cookies } from "next/headers";
import { LOCALES, DEFAULT_LOCALE, LOCALE_COOKIE, type Locale } from "./locales";
import { dictionaries } from "./dictionaries";

export async function getLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const value = cookieStore.get(LOCALE_COOKIE)?.value;
  return (LOCALES as readonly string[]).includes(value ?? "") ? (value as Locale) : DEFAULT_LOCALE;
}

export async function getTranslations() {
  const locale = await getLocale();
  const dict = dictionaries[locale];
  return { locale, t: (key: keyof typeof dict) => dict[key] };
}
