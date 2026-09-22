"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireMembership } from "@/lib/membership";

export type ImportRow = {
  name: string;
  chiefId?: string;
  alliance?: string;
  rank?: string;
  power?: string;
  level?: string;
};

const RANKS = new Set(["R1", "R2", "R3", "R4", "R5"]);

export async function bulkImportMembers(rows: ImportRow[]) {
  const membership = await requireMembership();
  if (!membership.isAdmin) {
    return { imported: 0, error: "Only admins can import members." };
  }

  const supabase = await createClient();
  const orgId = membership.orgId;

  const { data: subAlliances } = await supabase
    .from("sub_alliances")
    .select("id, name")
    .eq("org_id", orgId);

  const subAllianceByName = new Map(
    subAlliances?.map((a) => [a.name.trim().toLowerCase(), a.id])
  );

  const toInsert = [];
  for (const row of rows) {
    const name = row.name?.trim();
    if (!name) continue;

    let subAllianceId: string | null = null;
    const allianceName = row.alliance?.trim().toLowerCase();
    if (allianceName) {
      const existing = subAllianceByName.get(allianceName);
      if (existing) {
        subAllianceId = existing;
      } else {
        const { data: created } = await supabase
          .from("sub_alliances")
          .insert({ org_id: orgId, name: row.alliance!.trim() })
          .select("id")
          .single();
        if (created) {
          subAllianceByName.set(allianceName, created.id);
          subAllianceId = created.id;
        }
      }
    }

    const rank = row.rank?.trim().toUpperCase();

    toInsert.push({
      org_id: orgId,
      name,
      chief_id: row.chiefId?.trim() || null,
      sub_alliance_id: subAllianceId,
      alliance_rank: rank && RANKS.has(rank) ? rank : "R1",
      power: row.power?.trim() ? Number(row.power) : null,
      level: row.level?.trim() ? Number(row.level) : null,
    });
  }

  if (toInsert.length === 0) {
    return { imported: 0, error: "No valid rows found." };
  }

  const { error } = await supabase.from("members").insert(toInsert);
  if (error) {
    return { imported: 0, error: error.message };
  }

  revalidatePath("/members");
  return { imported: toInsert.length, error: null };
}
