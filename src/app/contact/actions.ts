"use server";

import { createClient } from "@/lib/supabase/server";

export async function sendContactMessage(_prevState: string | undefined, formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const allianceName = String(formData.get("allianceName") ?? "").trim();
  const contactInfo = String(formData.get("contactInfo") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();

  if (!name || !contactInfo || !message) {
    return "Please fill in your name, a way to reach you, and a message.";
  }

  const supabase = await createClient();
  const { error } = await supabase.from("contact_messages").insert({
    name,
    alliance_name: allianceName || null,
    contact_info: contactInfo,
    message,
  });

  if (error) {
    return "Something went wrong sending that — please try again.";
  }

  return "sent";
}
