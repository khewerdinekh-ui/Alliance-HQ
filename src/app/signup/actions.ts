"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { emailForChiefId } from "@/lib/supabase/chief-id";

export async function signUp(_prevState: string | undefined, formData: FormData) {
  const chiefId = String(formData.get("chiefId") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const displayName = String(formData.get("displayName") ?? "").trim();

  if (!chiefId) return "Chief ID is required.";

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: emailForChiefId(chiefId),
    password,
    options: { data: { chief_id: chiefId, display_name: displayName || chiefId } },
  });

  if (error) {
    if (error.message.toLowerCase().includes("already registered")) {
      return "That Chief ID already has an account.";
    }
    return error.message;
  }

  redirect("/members");
}
