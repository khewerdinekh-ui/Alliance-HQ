import { requireMembership } from "@/lib/membership";
import { getLocale } from "@/lib/i18n/getLocale";
import { RTL_LOCALES } from "@/lib/i18n/locales";
import TopNav from "@/components/TopNav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const membership = await requireMembership();
  const locale = await getLocale();

  return (
    <div className="min-h-screen bg-slate-50" dir={RTL_LOCALES.has(locale) ? "rtl" : "ltr"}>
      <TopNav membership={membership} initialLocale={locale} />
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}
