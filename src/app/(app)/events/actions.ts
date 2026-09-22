"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { extractAttendanceFromImages, type ExtractedAttendanceRow } from "@/lib/screenshotImport";

export type EventType = "foundry" | "canyon" | "bear";

export async function extractAttendanceScreenshot(
  dataUrls: string[]
): Promise<{ rows: ExtractedAttendanceRow[]; error: string | null }> {
  try {
    const rows = await extractAttendanceFromImages(dataUrls);
    return { rows, error: null };
  } catch (err) {
    return { rows: [], error: err instanceof Error ? err.message : "Extraction failed." };
  }
}

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

// Same as addPunishment but callable directly (for the confirmation modal).
export async function createPunishment(input: {
  orgId: string;
  memberId: string;
  eventType: EventType;
  requiredEvents: number;
  reason: string;
}) {
  const supabase = await createClient();
  await supabase.from("punishments").insert({
    org_id: input.orgId,
    member_id: input.memberId,
    event_type: input.eventType,
    required_events: input.requiredEvents,
    reason: input.reason.trim() || null,
  });
  revalidatePath(`/${input.eventType}`);
}

export async function resolvePunishment(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  const eventType = String(formData.get("eventType") ?? "");
  if (!id) return;

  await supabase
    .from("punishments")
    .update({ resolved: true, resolved_at: new Date().toISOString() })
    .eq("id", id);
  revalidatePath(`/${eventType}`);
}

export type AttendanceImportRow = {
  nameOrChiefId: string;
  signedUp?: boolean;
  arrived?: boolean;
  reason?: string;
  legion?: string;
  lineupRole?: "main" | "sub";
};

export async function bulkImportAttendance(
  orgId: string,
  eventId: string,
  eventType: EventType,
  rows: AttendanceImportRow[]
) {
  const supabase = await createClient();

  const { data: members } = await supabase
    .from("members")
    .select("id, name, chief_id")
    .eq("org_id", orgId);

  const byChiefId = new Map((members ?? []).filter((m) => m.chief_id).map((m) => [m.chief_id!, m.id]));
  const byName = new Map((members ?? []).map((m) => [m.name.toLowerCase(), m.id]));

  const upserts = [];
  let unmatched = 0;

  for (const row of rows) {
    const key = row.nameOrChiefId.trim();
    const memberId = byChiefId.get(key) ?? byName.get(key.toLowerCase());
    if (!memberId) {
      unmatched += 1;
      continue;
    }
    const arrived = row.arrived ?? false;
    const reason = row.reason?.trim() ?? "";
    upserts.push({
      org_id: orgId,
      event_id: eventId,
      member_id: memberId,
      signed_up: row.signedUp ?? true,
      legion: row.legion || null,
      lineup_role: row.lineupRole ?? "main",
      reason: reason || null,
      status: arrived ? "attended" : reason ? "excused" : "no_show",
    });
  }

  if (upserts.length) {
    await supabase.from("attendance").upsert(upserts, { onConflict: "event_id,member_id" });
  }

  revalidatePath(`/${eventType}`);
  return { imported: upserts.length, unmatched };
}
