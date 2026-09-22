"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { emailForChiefId } from "@/lib/supabase/chief-id";

export async function signIn(_prevState: string | undefined, formData: FormData) {
  const chiefId = String(formData.get("chiefId") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: emailForChiefId(chiefId),
    password,
  });

  if (error) {
    return "Chief ID or password is incorrect.";
  }

  redirect("/members");
}
