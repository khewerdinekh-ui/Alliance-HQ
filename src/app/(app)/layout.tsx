import { requireMembership } from "@/lib/membership";
import { getLocale } from "@/lib/i18n/getLocale";
import { RTL_LOCALES } from "@/lib/i18n/locales";
import { hasOwnerSession } from "@/lib/ownerAuth";
import TopNav from "@/components/TopNav";

// isOwner is just a cookie check (cheap). The unread/new-member counts used
// to run as two blocking Supabase queries here on every single page load —
// TopNav now fetches those itself, client-side, after the page has already
// rendered, so a badge popping in a moment late doesn't cost every navigation
// two extra cross-region round trips.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const membership = await requireMembership();
  const locale = await getLocale();
  const isOwner = await hasOwnerSession();

  return (
    <div className="min-h-screen bg-slate-50" dir={RTL_LOCALES.has(locale) ? "rtl" : "ltr"}>
      <TopNav membership={membership} initialLocale={locale} isOwner={isOwner} />
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}
