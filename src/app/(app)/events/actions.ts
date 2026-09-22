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

export type AttendanceFieldUpdate = {
  orgId: string;
  eventId: string;
  memberId: string;
  eventType: EventType;
  legion?: string;
  lineupRole?: "main" | "sub";
  signedUp?: boolean;
  arrived?: boolean;
  reason?: string;
};

// Upserts one attendance row, deriving `status` (attended/excused/no_show) from
// arrived + reason so Percentages / punishments keep working unchanged.
export async function updateAttendanceRow(update: AttendanceFieldUpdate) {
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("attendance")
    .select("legion, lineup_role, signed_up, status, reason")
    .eq("event_id", update.eventId)
    .eq("member_id", update.memberId)
    .maybeSingle();

  const legion = update.legion ?? existing?.legion ?? null;
  const lineupRole = update.lineupRole ?? existing?.lineup_role ?? "main";
  const signedUp = update.signedUp ?? existing?.signed_up ?? true;
  const reason = update.reason ?? existing?.reason ?? "";
  const arrived =
    update.arrived ?? (existing ? existing.status === "attended" : false);

  const status = arrived ? "attended" : reason.trim() ? "excused" : "no_show";

  await supabase.from("attendance").upsert(
    {
      org_id: update.orgId,
      event_id: update.eventId,
      member_id: update.memberId,
      legion,
      lineup_role: lineupRole,
      signed_up: signedUp,
      reason: reason || null,
      status,
    },
    { onConflict: "event_id,member_id" }
  );

  revalidatePath(`/${update.eventType}`);
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
