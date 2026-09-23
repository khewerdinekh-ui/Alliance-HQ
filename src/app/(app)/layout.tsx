import { requireMembership } from "@/lib/membership";
import { getLocale } from "@/lib/i18n/getLocale";
import { RTL_LOCALES } from "@/lib/i18n/locales";
import { hasOwnerSession, getMembersSeenAt } from "@/lib/ownerAuth";
import { createServiceClient } from "@/lib/supabase/service";
import { ICX_ORG_ID } from "@/lib/icxOrg";
import TopNav from "@/components/TopNav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const membership = await requireMembership();
  const locale = await getLocale();
  const isOwner = await hasOwnerSession();

  let unreadMessages = 0;
  let newMembers = 0;
  if (isOwner) {
    const supabase = createServiceClient();
    const seenAt = await getMembersSeenAt();
    const [{ count: unread }, { count: joined }] = await Promise.all([
      supabase.from("contact_messages").select("*", { count: "exact", head: true }).eq("resolved", false),
      supabase
        .from("org_members")
        .select("*", { count: "exact", head: true })
        .eq("org_id", ICX_ORG_ID)
        .gt("created_at", seenAt),
    ]);
    unreadMessages = unread ?? 0;
    newMembers = joined ?? 0;
  }

  return (
    <div className="min-h-screen bg-slate-50" dir={RTL_LOCALES.has(locale) ? "rtl" : "ltr"}>
      <TopNav
        membership={membership}
        initialLocale={locale}
        isOwner={isOwner}
        unreadMessages={unreadMessages}
        newMembers={newMembers}
      />
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}
