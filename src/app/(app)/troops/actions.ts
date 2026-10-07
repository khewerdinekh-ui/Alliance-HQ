"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireMembership } from "@/lib/membership";
import { extractTroopsFromImages, type ExtractedTroopRow } from "@/lib/screenshotImport";

export type TroopPatch = {
  infantry?: string;
  lancers?: string;
  marksmen?: string;
  slot1?: boolean;
  slot2?: boolean;
  slot3?: boolean;
  status?: string;
};

// "Last updated" tracks troop changes only — ticking a time slot or setting a
// status doesn't move it.
function touchesTroops(patch: TroopPatch) {
  return patch.infantry !== undefined || patch.lancers !== undefined || patch.marksmen !== undefined;
}

function toFields(patch: TroopPatch) {
  const fields: Record<string, unknown> = {};
  if (patch.infantry !== undefined) fields.infantry = patch.infantry;
  if (patch.lancers !== undefined) fields.lancers = patch.lancers;
  if (patch.marksmen !== undefined) fields.marksmen = patch.marksmen;
  if (patch.slot1 !== undefined) fields.slot_1 = patch.slot1;
  if (patch.slot2 !== undefined) fields.slot_2 = patch.slot2;
  if (patch.slot3 !== undefined) fields.slot_3 = patch.slot3;
  if (patch.status !== undefined) fields.status = patch.status;
  return fields;
}

// Only sends the fields that changed, so editing one dropdown never overwrites
// another admin's edit to a different field of the same row. Every save
// stamps updated_at, which the grid shows as "Last updated".
export async function updateTroopRow(
  memberId: string,
  patch: TroopPatch
): Promise<{ error: string | null; updatedAt: string | null }> {
  const membership = await requireMembership();
  if (!membership.isAdmin) return { error: "Only admins can edit troops.", updatedAt: null };

  const touched = touchesTroops(patch);
  const updatedAt = touched ? new Date().toISOString() : null;
  const supabase = await createClient();
  const { error } = await supabase
    .from("troops")
    .upsert(
      {
        org_id: membership.orgId,
        member_id: memberId,
        ...toFields(patch),
        ...(updatedAt ? { updated_at: updatedAt } : {}),
      },
      { onConflict: "member_id" }
    );
  if (error) return { error: error.message, updatedAt: null };

  revalidatePath("/troops");
  return { error: null, updatedAt };
}

export async function extractTroopsScreenshot(
  dataUrls: string[]
): Promise<{ rows: ExtractedTroopRow[]; error: string | null }> {
  try {
    return { rows: await extractTroopsFromImages(dataUrls), error: null };
  } catch (err) {
    return { rows: [], error: err instanceof Error ? err.message : "Extraction failed." };
  }
}

// Applies reviewed import rows. Each row only touches the fields it carries.
export async function importTroops(
  items: { memberId: string; patch: TroopPatch }[]
): Promise<{ saved: number; updatedAt: string | null; error: string | null }> {
  const membership = await requireMembership();
  if (!membership.isAdmin) return { saved: 0, updatedAt: null, error: "Only admins can edit troops." };

  const updatedAt = new Date().toISOString();
  const supabase = await createClient();
  let saved = 0;
  let firstError: string | null = null;

  for (let i = 0; i < items.length; i += 20) {
    const results = await Promise.all(
      items.slice(i, i + 20).map((it) =>
        supabase.from("troops").upsert(
          {
            org_id: membership.orgId,
            member_id: it.memberId,
            ...toFields(it.patch),
            ...(touchesTroops(it.patch) ? { updated_at: updatedAt } : {}),
          },
          { onConflict: "member_id" }
        )
      )
    );
    for (const r of results) {
      if (r.error) firstError ??= r.error.message;
      else saved += 1;
    }
  }

  revalidatePath("/troops");
  return { saved, updatedAt, error: firstError };
}
