"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type EventType = "foundry" | "canyon" | "bear";

export async function createEvent(formData: FormData) {
  const supabase = await createClient();

  const orgId = String(formData.get("orgId") ?? "");
  const eventType = String(formData.get("eventType") ?? "") as EventType;
  const eventDate = String(formData.get("eventDate") ?? "");
  if (!orgId || !eventType || !eventDate) return;

  await supabase.from("events").insert({ org_id: orgId, event_type: eventType, event_date: eventDate });

  revalidatePath(`/${eventType}`);
}

export async function deleteEvent(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  const eventType = String(formData.get("eventType") ?? "");
  if (!id) return;

  await supabase.from("events").delete().eq("id", id);
  revalidatePath(`/${eventType}`);
}

export async function setAttendance(formData: FormData) {
  const supabase = await createClient();

  const orgId = String(formData.get("orgId") ?? "");
  const eventId = String(formData.get("eventId") ?? "");
  const memberId = String(formData.get("memberId") ?? "");
  const status = String(formData.get("status") ?? "");
  const eventType = String(formData.get("eventType") ?? "");
  if (!orgId || !eventId || !memberId || !status) return;

  await supabase
    .from("attendance")
    .upsert(
      { org_id: orgId, event_id: eventId, member_id: memberId, status },
      { onConflict: "event_id,member_id" }
    );

  revalidatePath(`/${eventType}`);
}

export async function addPunishment(formData: FormData) {
  const supabase = await createClient();

  const orgId = String(formData.get("orgId") ?? "");
  const memberId = String(formData.get("memberId") ?? "");
  const eventType = String(formData.get("eventType") ?? "") as EventType;
  const requiredEvents = Number(formData.get("requiredEvents") ?? "1");
  const reason = String(formData.get("reason") ?? "").trim() || null;
  if (!orgId || !memberId || !eventType) return;

  await supabase.from("punishments").insert({
    org_id: orgId,
    member_id: memberId,
    event_type: eventType,
    required_events: requiredEvents,
    reason,
  });

  revalidatePath(`/${eventType}`);
}

export async function resolvePunishment(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  const eventType = String(formData.get("eventType") ?? "");
  if (!id) return;

  await supabase.from("punishments").update({ resolved: true }).eq("id", id);
  revalidatePath(`/${eventType}`);
}
