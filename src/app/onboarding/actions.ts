"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function createOrg(_prevState: string | undefined, formData: FormData) {
  const orgName = String(formData.get("orgName") ?? "").trim();
  const state = String(formData.get("state") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const chiefId = String(formData.get("chiefId") ?? "").trim();
  const displayName = String(formData.get("displayName") ?? "").trim();

  if (!orgName || !state || !password || !chiefId || !displayName) {
    return "All fields are required.";
  }
  if (password.length < 8) {
    return "Alliance password must be at least 8 characters.";
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_org", {
    org_name: orgName,
    org_state: state,
    org_password: password,
    chief_id: chiefId,
    display_name: displayName,
  });

  if (error) {
    if (error.message.includes("duplicate key")) {
      return "An alliance with that name already exists.";
    }
    return error.message;
  }

  redirect("/members");
}

export async function joinOrg(_prevState: string | undefined, formData: FormData) {
  const orgName = String(formData.get("orgName") ?? "").trim();
  const state = String(formData.get("state") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const chiefId = String(formData.get("chiefId") ?? "").trim();
  const displayName = String(formData.get("displayName") ?? "").trim();

  if (!orgName || !state || !password || !chiefId || !displayName) {
    return "All fields are required.";
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("join_org", {
    org_name: orgName,
    org_state: state,
    org_password: password,
    chief_id: chiefId,
    display_name: displayName,
  });

  if (error) {
    return error.message.includes("No alliance found") ||
      error.message.includes("Incorrect") ||
      error.message.includes("don't match")
      ? error.message
      : "Couldn't join that alliance. Check the details and try again.";
  }

  redirect("/members");
}
