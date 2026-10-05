"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireMembership } from "@/lib/membership";

export type TroopPatch = {
  infantry?: string;
  lancers?: string;
  marksmen?: string;
  slot1?: boolean;
  slot2?: boolean;
  slot3?: boolean;
  status?: string;
};

// Only sends the fields that changed, so editing one dropdown never overwrites
// another admin's edit to a different field of the same row.
export async function updateTroopRow(memberId: string, patch: TroopPatch): Promise<{ error: string | null }> {
  const membership = await requireMembership();
  if (!membership.isAdmin) return { error: "Only admins can edit troops." };

  const fields: Record<string, unknown> = {};
  if (patch.infantry !== undefined) fields.infantry = patch.infantry;
  if (patch.lancers !== undefined) fields.lancers = patch.lancers;
  if (patch.marksmen !== undefined) fields.marksmen = patch.marksmen;
  if (patch.slot1 !== undefined) fields.slot_1 = patch.slot1;
  if (patch.slot2 !== undefined) fields.slot_2 = patch.slot2;
  if (patch.slot3 !== undefined) fields.slot_3 = patch.slot3;
  if (patch.status !== undefined) fields.status = patch.status;

  const supabase = await createClient();
  const { error } = await supabase
    .from("troops")
    .upsert(
      { org_id: membership.orgId, member_id: memberId, ...fields, updated_at: new Date().toISOString() },
      { onConflict: "member_id" }
    );
  if (error) return { error: error.message };

  revalidatePath("/troops");
  return { error: null };
}
