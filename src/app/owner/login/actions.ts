"use server";

import { redirect } from "next/navigation";
import { checkOwnerPassword, createOwnerSession } from "@/lib/ownerAuth";

export async function ownerLogin(_prevState: string | undefined, formData: FormData) {
  const password = String(formData.get("password") ?? "");

  if (!checkOwnerPassword(password)) {
    return "Incorrect password.";
  }

  await createOwnerSession();
  redirect("/owner/messages");
}
