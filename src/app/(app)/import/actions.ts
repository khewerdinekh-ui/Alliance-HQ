"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireMembership } from "@/lib/membership";
import { extractMembersFromImages } from "@/lib/screenshotImport";
import { guessMemberId, stripTag } from "@/lib/memberMatch";

export type ImportRow = {
  name: string;
  chiefId?: string;
  alliance?: string;
  rank?: string;
  power?: string;
  level?: string;
  // Explicit match chosen in the review table — "" means "new member",
  // undefined means "let the server guess" (used by plain CSV rows that
  // never went through the review UI's matcher).
  memberId?: string | null;
  // True when the admin picked/changed the match by hand (as opposed to
  // accepting the auto-guess) — triggers a name update + alias so the same
  // reading auto-matches next time (see the rename block below).
  manualMatch?: boolean;
};

const RANKS = new Set(["R1", "R2", "R3", "R4", "R5"]);

async function assertAdmin() {
  const membership = await requireMembership();
  if (!membership.isAdmin) {
    throw new Error("Only admins can import members.");
  }
  return membership;
}

export async function extractMembersScreenshot(dataUrls: string[]): Promise<{
  rows: { name: string; power: number | null; level: number | null; rank: string | null }[];
  error: string | null;
}> {
  try {
    const rows = await extractMembersFromImages(dataUrls);
    return { rows, error: null };
  } catch (err) {
    return { rows: [], error: err instanceof Error ? err.message : "Extraction failed." };
  }
}

// Importing a fresh roster screenshot/video for one alliance is the best
// signal of who's actually in it now — bulkImportMembers matches each row
// against the org's current roster (by Chief ID, name, or alias) so existing
// members get updated rather than duplicated, reports which rows were
// genuinely new, and — when a sub-alliance is chosen — reports which of that
// alliance's current members were absent from this import (likely left),
// without changing their status itself (see markMembersOld).
export async function bulkImportMembers(rows: ImportRow[], subAllianceId?: string | null) {
  const membership = await assertAdmin();
  const orgId = membership.orgId;
  const supabase = await createClient();

  const [{ data: subAlliances }, { data: existingMembers }] = await Promise.all([
    supabase.from("sub_alliances").select("id, name").eq("org_id", orgId),
    supabase
      .from("members")
      .select("id, name, chief_id, aliases, sub_alliance_id, status")
      .eq("org_id", orgId),
  ]);

  const subAllianceByName = new Map((subAlliances ?? []).map((a) => [a.name.trim().toLowerCase(), a.id]));
  const matchable = (existingMembers ?? []).map((m) => ({
    id: m.id,
    name: m.name,
    chiefId: m.chief_id,
    aliases: m.aliases ?? [],
  }));
  const existingIds = new Set((existingMembers ?? []).map((m) => m.id));
  const memberById = new Map((existingMembers ?? []).map((m) => [m.id, m]));

  const newNames: string[] = [];
  const updatedNames: string[] = [];
  const matchedIds = new Set<string>();

  for (const row of rows) {
    const name = row.name?.trim();
    if (!name) continue;

    let rowSubAllianceId: string | null = subAllianceId ?? null;
    const allianceName = row.alliance?.trim().toLowerCase();
    if (allianceName) {
      const existing = subAllianceByName.get(allianceName);
      if (existing) {
        rowSubAllianceId = existing;
      } else {
        const { data: created } = await supabase
          .from("sub_alliances")
          .insert({ org_id: orgId, name: row.alliance!.trim() })
          .select("id")
          .single();
        if (created) {
          subAllianceByName.set(allianceName, created.id);
          rowSubAllianceId = created.id;
        }
      }
    }

    const rank = row.rank?.trim().toUpperCase();
    const power = row.power?.trim() ? Number(row.power) : null;
    const level = row.level?.trim() ? Number(row.level) : null;

    let matchId: string | null | undefined;
    if (row.memberId !== undefined) {
      // Explicit decision from the review table: "" means new, an id means that member.
      matchId = row.memberId && existingIds.has(row.memberId) ? row.memberId : null;
    } else {
      matchId = row.chiefId?.trim()
        ? matchable.find((m) => m.chiefId === row.chiefId!.trim())?.id
        : guessMemberId(name, matchable);
    }

    if (matchId) {
      matchedIds.add(matchId);
      const existing = memberById.get(matchId)!;

      // A manually-picked match means the admin confirmed this reading is
      // that member under a name the roster doesn't have on file yet (an
      // OCR variant, decoration, or a real in-game rename) — adopt it as
      // the current name and keep the old one as an alias, so the same
      // reading matches automatically next time instead of asking again.
      let newName = existing.name;
      let newAliases = existing.aliases ?? [];
      if (row.manualMatch) {
        const stripped = stripTag(name);
        if (stripped && stripped !== existing.name) {
          const aliases = new Set(existing.aliases ?? []);
          aliases.add(existing.name);
          if (name !== stripped) aliases.add(name);
          aliases.delete(stripped);
          newName = stripped;
          newAliases = [...aliases];
        }
      }

      await supabase
        .from("members")
        .update({
          name: newName,
          aliases: newAliases,
          status: "current",
          sub_alliance_id: rowSubAllianceId ?? existing.sub_alliance_id,
          alliance_rank: rank && RANKS.has(rank) ? rank : undefined,
          power: power ?? undefined,
          level: level ?? undefined,
          chief_id: row.chiefId?.trim() || existing.chief_id,
        })
        .eq("id", matchId);
      updatedNames.push(name);
    } else {
      const { data: created } = await supabase
        .from("members")
        .insert({
          org_id: orgId,
          name,
          chief_id: row.chiefId?.trim() || null,
          sub_alliance_id: rowSubAllianceId,
          alliance_rank: rank && RANKS.has(rank) ? rank : "R1",
          power,
          level,
        })
        .select("id")
        .single();
      if (created) matchedIds.add(created.id);
      newNames.push(name);
    }
  }

  if (newNames.length === 0 && updatedNames.length === 0) {
    return { imported: 0, newNames: [], updatedNames: [], missing: [], error: "No valid rows found." };
  }

  // Reconciliation: current members of the chosen alliance not seen in this import.
  const missing = subAllianceId
    ? (existingMembers ?? [])
        .filter(
          (m) =>
            m.sub_alliance_id === subAllianceId && m.status === "current" && !matchedIds.has(m.id)
        )
        .map((m) => ({ id: m.id, name: m.name }))
    : [];

  revalidatePath("/members");
  return {
    imported: newNames.length + updatedNames.length,
    newNames,
    updatedNames,
    missing,
    error: null,
  };
}

export async function markMembersOld(memberIds: string[], leftAt: string | null) {
  await assertAdmin();
  if (!memberIds.length) return;

  const supabase = await createClient();
  await supabase.from("members").update({ status: "old", left_at: leftAt }).in("id", memberIds);
  revalidatePath("/members");
}
