"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { hasOwnerSession, markMembersSeen as markSeen } from "@/lib/ownerAuth";

export async function markAllMembersSeen() {
  if (!(await hasOwnerSession())) {
    redirect("/owner/login");
  }
  await markSeen();
  revalidatePath("/owner/members");
}
