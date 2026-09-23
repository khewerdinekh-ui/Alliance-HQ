"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireMembership } from "@/lib/membership";

async function assertAdmin() {
  const membership = await requireMembership();
  if (!membership.isAdmin) {
    throw new Error("Forbidden");
  }
  return membership;
}

export async function updateMemberRank(formData: FormData) {
  await assertAdmin();
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  const rank = String(formData.get("rank") ?? "");
  if (!id || !rank) return;

  await supabase.from("org_members").update({ alliance_rank: rank }).eq("id", id);
  revalidatePath("/admin");
}

export async function setMemberAdmin(formData: FormData) {
  const membership = await assertAdmin();
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  const isAdmin = formData.get("isAdmin") === "true";
  if (!id) return;

  if (!isAdmin) {
    const { count } = await supabase
      .from("org_members")
      .select("*", { count: "exact", head: true })
      .eq("org_id", membership.orgId)
      .eq("is_admin", true);
    if ((count ?? 0) <= 1) {
      return;
    }
  }

  await supabase.from("org_members").update({ is_admin: isAdmin }).eq("id", id);
  revalidatePath("/admin");
}

export async function removeOrgMember(formData: FormData) {
  const membership = await assertAdmin();
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const { data: target } = await supabase
    .from("org_members")
    .select("is_admin")
    .eq("id", id)
    .single();

  if (target?.is_admin) {
    const { count } = await supabase
      .from("org_members")
      .select("*", { count: "exact", head: true })
      .eq("org_id", membership.orgId)
      .eq("is_admin", true);
    if ((count ?? 0) <= 1) {
      return;
    }
  }

  await supabase.from("org_members").delete().eq("id", id);
  revalidatePath("/admin");
}

export async function addSubAlliance(formData: FormData) {
  const membership = await assertAdmin();
  const supabase = await createClient();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  await supabase.from("sub_alliances").insert({ org_id: membership.orgId, name });
  revalidatePath("/admin");
}

export async function deleteSubAlliance(formData: FormData) {
  await assertAdmin();
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await supabase.from("sub_alliances").delete().eq("id", id);
  revalidatePath("/admin");
}

export async function updateOrgDetails(formData: FormData) {
  const membership = await assertAdmin();
  const supabase = await createClient();
  const name = String(formData.get("orgName") ?? "").trim();
  const state = String(formData.get("orgState") ?? "").trim();
  if (!name || !state) return;

  await supabase.from("orgs").update({ name, state }).eq("id", membership.orgId);
  revalidatePath("/admin");
}

export async function updateOrgPassword(_prevState: string | undefined, formData: FormData) {
  const membership = await assertAdmin();
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (newPassword !== confirmPassword) {
    return "Passwords don't match.";
  }
  if (newPassword.length < 8) {
    return "Alliance password must be at least 8 characters.";
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_org_password", {
    p_org_id: membership.orgId,
    p_new_password: newPassword,
  });

  if (error) return error.message;
  return "updated";
}
