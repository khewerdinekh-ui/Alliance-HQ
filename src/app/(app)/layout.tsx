import { requireMembership } from "@/lib/membership";
import { getLocale } from "@/lib/i18n/getLocale";
import { RTL_LOCALES } from "@/lib/i18n/locales";
import { hasOwnerSession } from "@/lib/ownerAuth";
import { createServiceClient } from "@/lib/supabase/service";
import TopNav from "@/components/TopNav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const membership = await requireMembership();
  const locale = await getLocale();
  const isOwner = await hasOwnerSession();

  let unreadMessages = 0;
  if (isOwner) {
    const { count } = await createServiceClient()
      .from("contact_messages")
      .select("*", { count: "exact", head: true })
      .eq("resolved", false);
    unreadMessages = count ?? 0;
  }

  return (
    <div className="min-h-screen bg-slate-50" dir={RTL_LOCALES.has(locale) ? "rtl" : "ltr"}>
      <TopNav
        membership={membership}
        initialLocale={locale}
        isOwner={isOwner}
        unreadMessages={unreadMessages}
      />
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}
