import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Membership = {
  orgId: string;
  displayName: string;
  chiefId: string;
  allianceRank: string;
  isAdmin: boolean;
  orgName: string;
  orgState: string | null;
};

// Cached per-request so layout + page can both call this without an extra round trip.
export const getMembership = cache(async (): Promise<Membership | null> => {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: membership } = await supabase
    .from("org_members")
    .select("org_id, chief_id, display_name, alliance_rank, is_admin, orgs(name, state)")
    .eq("user_id", user.id)
    .single();

  if (!membership) return null;

  const org = membership.orgs as unknown as { name: string; state: string | null } | null;

  return {
    orgId: membership.org_id,
    displayName: membership.display_name,
    chiefId: membership.chief_id,
    allianceRank: membership.alliance_rank,
    isAdmin: membership.is_admin,
    orgName: org?.name ?? "Alliance HQ",
    orgState: org?.state ?? null,
  };
});

export async function requireMembership(): Promise<Membership> {
  const membership = await getMembership();
  if (!membership) {
    redirect("/onboarding");
  }
  return membership;
}
