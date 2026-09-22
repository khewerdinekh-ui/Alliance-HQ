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
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto max-w-5xl px-4 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">
              {membership.orgName}
              {membership.orgState ? ` · STATE ${membership.orgState}` : ""}
            </h1>
            <p className="text-xs text-slate-500">{t("common.commandCentre")}</p>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <LanguageSwitcher initialLocale={initialLocale} />
            <span className="text-slate-600">
              {membership.displayName} — {membership.allianceRank}
            </span>
            <form action={signOut}>
              <button className="rounded-lg border border-slate-300 px-3 py-1.5 text-slate-600 transition hover:bg-slate-100">
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
                  active ? "bg-teal-600 text-white" : "text-slate-600 hover:bg-slate-100"
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
