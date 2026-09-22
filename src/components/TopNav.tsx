"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/(app)/actions";
import type { Membership } from "@/lib/membership";
import type { Locale } from "@/lib/i18n/locales";
import { useTranslations } from "@/lib/i18n/useTranslations";
import LanguageSwitcher from "./LanguageSwitcher";

const LINKS: { href: string; key: Parameters<ReturnType<typeof useTranslations>["t"]>[0] }[] = [
  { href: "/members", key: "nav.members" },
  { href: "/percentages", key: "nav.percentages" },
  { href: "/foundry", key: "nav.foundry" },
  { href: "/canyon", key: "nav.canyon" },
  { href: "/bear", key: "nav.bear" },
  { href: "/import", key: "nav.import" },
  { href: "/subscription", key: "nav.subscription" },
  { href: "/contact", key: "nav.contact" },
  { href: "/admin", key: "nav.admin" },
];

export default function TopNav({
  membership,
  initialLocale,
}: {
  membership: Membership;
  initialLocale: Locale;
}) {
  const pathname = usePathname();
  const { t } = useTranslations(initialLocale);

  return (
    <header className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-teal-900 text-white shadow-md">
      <div
        className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-teal-400/10 blur-2xl"
        aria-hidden
      />
      <div className="relative mx-auto max-w-5xl px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-teal-400/30 bg-teal-500/20 sm:flex">
              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 text-teal-300">
                <path
                  d="M12 2.5l7.5 3v5.2c0 4.8-3.1 8.9-7.5 10.3-4.4-1.4-7.5-5.5-7.5-10.3V5.5l7.5-3z"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinejoin="round"
                  fill="currentColor"
                  fillOpacity="0.15"
                />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-semibold text-white">
                {membership.orgName}
                {membership.orgState ? (
                  <span className="text-teal-300"> · STATE {membership.orgState}</span>
                ) : (
                  ""
                )}
              </h1>
              <p className="text-xs text-slate-300">{t("common.commandCentre")}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <LanguageSwitcher initialLocale={initialLocale} />
            <span className="hidden text-slate-200 sm:inline">
              {membership.displayName} — {membership.allianceRank}
            </span>
            <form action={signOut}>
              <button className="rounded-lg border border-white/20 bg-white/5 px-3 py-1.5 text-slate-100 transition hover:bg-white/10">
                {t("common.signOut")}
              </button>
            </form>
          </div>
        </div>

        <nav className="mt-4 flex flex-wrap gap-1 text-sm">
          {LINKS.filter((l) => l.href !== "/admin" || membership.isAdmin).map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-full px-3 py-1.5 font-medium transition ${
                  active
                    ? "bg-teal-500 text-white shadow-sm shadow-teal-500/40"
                    : "text-slate-200 hover:bg-white/10"
                }`}
              >
                {t(link.key)}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
