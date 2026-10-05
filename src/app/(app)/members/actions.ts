"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parsePower, parseLevel, parseAliases } from "@/lib/parseMemberFields";

export type MemberFormInput = {
  id?: string;
  orgId: string;
  name: string;
  chiefId: string;
  subAllianceId: string;
  allianceRank: string;
  status: "current" | "old";
  power: string;
  level: string;
  aliases: string;
};

export async function saveMember(input: MemberFormInput) {
  const supabase = await createClient();
  const name = input.name.trim();
  if (!name) return { error: "Name is required." };

  const row = {
    org_id: input.orgId,
    name,
    chief_id: input.chiefId.trim() || null,
    sub_alliance_id: input.subAllianceId || null,
    alliance_rank: input.allianceRank || "R1",
    status: input.status,
    power: parsePower(input.power),
    level: parseLevel(input.level),
    aliases: parseAliases(input.aliases),
  };

  const { error } = input.id
    ? await supabase.from("members").update(row).eq("id", input.id)
    : await supabase.from("members").insert(row);

  if (error) return { error: error.message };

  revalidatePath("/members");
  return { error: null };
}

const INLINE_FIELDS = new Set(["sub_alliance_id", "chief_id", "power", "level", "alliance_rank"]);

export async function updateMemberField(id: string, field: string, value: string) {
  if (!INLINE_FIELDS.has(field)) return;
  const supabase = await createClient();

  let parsed: string | number | null = value;
  if (field === "power") parsed = parsePower(value);
  else if (field === "level") parsed = parseLevel(value);
  else if (field === "sub_alliance_id" || field === "chief_id") parsed = value.trim() || null;

  await supabase
    .from("members")
    .update({ [field]: parsed })
    .eq("id", id);

  revalidatePath("/members");
}

// Resolves a suggested name change: accept makes the spelling an import read
// the member's real name (old name kept as an alias); dismiss just clears it.
export async function resolveNameChange(memberId: string, accept: boolean): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { data: member } = await supabase
    .from("members")
    .select("name, aliases, pending_name")
    .eq("id", memberId)
    .single();
  if (!member) return { error: "Member not found." };

  const update: Record<string, unknown> = { pending_name: null };
  if (accept && member.pending_name) {
    const aliases = new Set(member.aliases ?? []);
    aliases.add(member.name);
    aliases.delete(member.pending_name);
    update.name = member.pending_name;
    update.aliases = [...aliases];
  }

  const { error } = await supabase.from("members").update(update).eq("id", memberId);
  if (error) return { error: error.message };
  revalidatePath("/members");
  return { error: null };
}

export async function deleteMember(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await supabase.from("members").delete().eq("id", id);
  revalidatePath("/members");
}
