import { NextResponse } from "next/server";
import { hasOwnerSession, getMembersSeenAt } from "@/lib/ownerAuth";
import { createServiceClient } from "@/lib/supabase/service";
import { ICX_ORG_ID } from "@/lib/icxOrg";

export async function GET() {
  if (!(await hasOwnerSession())) {
    return NextResponse.json({ unreadMessages: 0, newMembers: 0 });
  }

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

  return NextResponse.json({ unreadMessages: unread ?? 0, newMembers: joined ?? 0 });
}
