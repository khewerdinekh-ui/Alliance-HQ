"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { hasOwnerSession, clearOwnerSession } from "@/lib/ownerAuth";
import { createServiceClient } from "@/lib/supabase/service";

async function assertOwner() {
  if (!(await hasOwnerSession())) {
    redirect("/owner/login");
  }
}

export async function resolveContactMessage(formData: FormData) {
  await assertOwner();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = createServiceClient();
  await supabase.from("contact_messages").update({ resolved: true }).eq("id", id);
  revalidatePath("/owner/messages");
}

export async function ownerLogout() {
  await clearOwnerSession();
  redirect("/owner/login");
}
