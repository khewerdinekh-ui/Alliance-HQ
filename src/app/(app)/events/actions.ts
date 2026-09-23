"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  extractAttendanceFromImages,
  extractBearResultsFromImages,
  type ExtractedAttendanceRow,
  type ExtractedBearResultRow,
} from "@/lib/screenshotImport";

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

export async function extractBearResultsScreenshot(
  dataUrls: string[]
): Promise<{ rows: ExtractedBearResultRow[]; error: string | null }> {
  try {
    const rows = await extractBearResultsFromImages(dataUrls);
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

// Bear times are per-org (4 daily slots), editable by admins.
export async function updateBearTimes(formData: FormData) {
  const supabase = await createClient();
  const orgId = String(formData.get("orgId") ?? "");
  if (!orgId) return;

  const times = [1, 2, 3, 4].map((n) => String(formData.get(`bearTime${n}`) ?? "").trim() || null);

  await supabase
    .from("orgs")
    .update({ bear_time_1: times[0], bear_time_2: times[1], bear_time_3: times[2], bear_time_4: times[3] })
    .eq("id", orgId);

  revalidatePath("/bear");
}

// One Bear event per (date, slot) — 4 slots on the same date count as a single
// event for percentage purposes, but attendance is tracked per slot.
export async function createBearEvent(formData: FormData) {
  const supabase = await createClient();
  const orgId = String(formData.get("orgId") ?? "");
  const eventDate = String(formData.get("eventDate") ?? "");
  const bearSlot = Number(formData.get("bearSlot") ?? "0");
  if (!orgId || !eventDate || !bearSlot || bearSlot < 1 || bearSlot > 4) return;

  const { data: existing } = await supabase
    .from("events")
    .select("id")
    .eq("org_id", orgId)
    .eq("event_type", "bear")
    .eq("event_date", eventDate)
    .eq("bear_slot", bearSlot)
    .maybeSingle();

  if (!existing) {
    await supabase
      .from("events")
      .insert({ org_id: orgId, event_type: "bear", event_date: eventDate, bear_slot: bearSlot });
  }

  revalidatePath("/bear");
}

// Bear has no arrived/did-not-arrive grid — a saved damage score IS attendance.
export async function addBearResult(formData: FormData) {
  const supabase = await createClient();
  const orgId = String(formData.get("orgId") ?? "");
  const eventId = String(formData.get("eventId") ?? "");
  const memberId = String(formData.get("memberId") ?? "");
  const score = Number(formData.get("score") ?? "");
  if (!orgId || !eventId || !memberId || !Number.isFinite(score) || score < 0) return;

  await supabase.from("attendance").upsert(
    {
      org_id: orgId,
      event_id: eventId,
      member_id: memberId,
      status: "attended",
      signed_up: true,
      score,
    },
    { onConflict: "event_id,member_id" }
  );

  revalidatePath("/bear");
}

export async function removeBearResult(formData: FormData) {
  const supabase = await createClient();
  const eventId = String(formData.get("eventId") ?? "");
  const memberId = String(formData.get("memberId") ?? "");
  if (!eventId || !memberId) return;

  await supabase.from("attendance").delete().eq("event_id", eventId).eq("member_id", memberId);

  revalidatePath("/bear");
}

export type BearResultImportRow = { nameOrChiefId: string; score: number; memberId?: string | null };

// Strips a leading alliance tag like "[ICY]" so a roster name without the
// tag still matches a screenshot/CSV name that includes it.
function stripTag(name: string) {
  return name.replace(/^\s*\[[^\]]+\]\s*/, "").trim();
}

export async function bulkImportBearResults(orgId: string, eventId: string, rows: BearResultImportRow[]) {
  const supabase = await createClient();

  const { data: members } = await supabase
    .from("members")
    .select("id, name, chief_id")
    .eq("org_id", orgId);

  const memberIds = new Set((members ?? []).map((m) => m.id));
  const byChiefId = new Map((members ?? []).filter((m) => m.chief_id).map((m) => [m.chief_id!, m.id]));
  const byName = new Map((members ?? []).map((m) => [m.name.toLowerCase(), m.id]));

  const upserts = [];
  const unmatchedNames: string[] = [];

  for (const row of rows) {
    let memberId: string | null | undefined = row.memberId && memberIds.has(row.memberId) ? row.memberId : null;
    if (!memberId) {
      const key = row.nameOrChiefId.trim();
      memberId =
        byChiefId.get(key) ?? byName.get(key.toLowerCase()) ?? byName.get(stripTag(key).toLowerCase());
    }
    if (!memberId || !Number.isFinite(row.score)) {
      unmatchedNames.push(row.nameOrChiefId);
      continue;
    }
    upserts.push({
      org_id: orgId,
      event_id: eventId,
      member_id: memberId,
      status: "attended",
      signed_up: true,
      score: row.score,
    });
  }

  if (upserts.length) {
    await supabase.from("attendance").upsert(upserts, { onConflict: "event_id,member_id" });
  }

  revalidatePath("/bear");
  return { imported: upserts.length, unmatched: unmatchedNames.length, unmatchedNames };
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
  score?: number | null;
};

// Upserts one attendance row, deriving `status` (attended/excused/no_show) from
// arrived + reason so Percentages / punishments keep working unchanged.
export async function updateAttendanceRow(update: AttendanceFieldUpdate) {
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("attendance")
    .select("legion, lineup_role, signed_up, status, reason, score")
    .eq("event_id", update.eventId)
    .eq("member_id", update.memberId)
    .maybeSingle();

  const legion = update.legion ?? existing?.legion ?? null;
  const lineupRole = update.lineupRole ?? existing?.lineup_role ?? "main";
  const signedUp = update.signedUp ?? existing?.signed_up ?? true;
  const reason = update.reason ?? existing?.reason ?? "";
  const score = update.score !== undefined ? update.score : (existing?.score ?? null);
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
      score,
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
  memberId?: string | null;
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

  const memberIds = new Set((members ?? []).map((m) => m.id));
  const byChiefId = new Map((members ?? []).filter((m) => m.chief_id).map((m) => [m.chief_id!, m.id]));
  const byName = new Map((members ?? []).map((m) => [m.name.toLowerCase(), m.id]));

  const upserts = [];
  const unmatchedNames: string[] = [];

  for (const row of rows) {
    let memberId: string | null | undefined = row.memberId && memberIds.has(row.memberId) ? row.memberId : null;
    if (!memberId) {
      const key = row.nameOrChiefId.trim();
      memberId =
        byChiefId.get(key) ?? byName.get(key.toLowerCase()) ?? byName.get(stripTag(key).toLowerCase());
    }
    if (!memberId) {
      unmatchedNames.push(row.nameOrChiefId);
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
  return { imported: upserts.length, unmatched: unmatchedNames.length, unmatchedNames };
}
