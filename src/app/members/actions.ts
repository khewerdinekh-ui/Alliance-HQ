"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function addMember(formData: FormData) {
  const supabase = await createClient();

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  const chiefId = String(formData.get("chiefId") ?? "").trim() || null;
  const allianceId = String(formData.get("allianceId") ?? "") || null;
  const allianceRank = String(formData.get("allianceRank") ?? "R1");
  const powerRaw = String(formData.get("power") ?? "").trim();
  const levelRaw = String(formData.get("level") ?? "").trim();

  await supabase.from("members").insert({
    name,
    chief_id: chiefId,
    alliance_id: allianceId,
    alliance_rank: allianceRank,
    power: powerRaw ? Number(powerRaw) : null,
    level: levelRaw ? Number(levelRaw) : null,
  });

  revalidatePath("/members");
}

export async function deleteMember(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await supabase.from("members").delete().eq("id", id);
  revalidatePath("/members");
}

export async function toggleMemberStatus(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  const nextStatus = String(formData.get("nextStatus") ?? "");
  if (!id || !nextStatus) return;

  await supabase.from("members").update({ status: nextStatus }).eq("id", id);
  revalidatePath("/members");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
