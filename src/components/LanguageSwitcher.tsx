"use client";

import { useRouter } from "next/navigation";
import { LOCALES, LOCALE_LABELS, LOCALE_COOKIE, RTL_LOCALES, type Locale } from "@/lib/i18n/locales";
import { useTranslations } from "@/lib/i18n/useTranslations";

export default function LanguageSwitcher({ initialLocale }: { initialLocale?: Locale }) {
  const router = useRouter();
  const { locale } = useTranslations(initialLocale);

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value;
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000`;
    document.documentElement.dir = RTL_LOCALES.has(next as never) ? "rtl" : "ltr";
    router.refresh();
  }

  return (
    <select
      value={locale}
      onChange={handleChange}
      className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700"
    >
      {LOCALES.map((l) => (
        <option key={l} value={l}>
          {LOCALE_LABELS[l]}
        </option>
      ))}
    </select>
  );
}
