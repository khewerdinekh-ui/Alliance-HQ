"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireMembership } from "@/lib/membership";
import { extractPrepFromImages, type ExtractedPrepRow } from "@/lib/screenshotImport";

export async function extractPrepScreenshot(
  dataUrls: string[]
): Promise<{ rows: ExtractedPrepRow[]; error: string | null }> {
  try {
    return { rows: await extractPrepFromImages(dataUrls), error: null };
  } catch (err) {
    return { rows: [], error: err instanceof Error ? err.message : "Extraction failed." };
  }
}

// One prep event per (date, label). Saving the same date + label again
// replaces that event's results, so re-reading a video never double counts.
export async function savePrepResults(
  eventDate: string,
  label: string,
  rows: { memberId: string; rank: number | null; points: number | null }[]
): Promise<{ saved: number; error: string | null }> {
  const membership = await requireMembership();
  if (!membership.isAdmin) return { saved: 0, error: "Only admins can import SvS prep." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) return { saved: 0, error: "Pick a date." };

  const supabase = await createClient();
  const cleanLabel = label.trim();

  const { data: existing } = await supabase
    .from("svs_prep_events")
    .select("id")
    .eq("org_id", membership.orgId)
    .eq("event_date", eventDate)
    .eq("label", cleanLabel)
    .maybeSingle();

  let eventId = existing?.id as string | undefined;
  if (!eventId) {
    const { data: created, error } = await supabase
      .from("svs_prep_events")
      .insert({ org_id: membership.orgId, event_date: eventDate, label: cleanLabel })
      .select("id")
      .single();
    if (error || !created) return { saved: 0, error: error?.message ?? "Couldn't create the prep event." };
    eventId = created.id;
  } else {
    await supabase.from("svs_prep_results").delete().eq("event_id", eventId);
  }

  const byMember = new Map<string, { rank: number | null; points: number | null }>();
  for (const r of rows) if (!byMember.has(r.memberId)) byMember.set(r.memberId, { rank: r.rank, points: r.points });

  const inserts = [...byMember.entries()].map(([memberId, v]) => ({
    org_id: membership.orgId,
    event_id: eventId,
    member_id: memberId,
    rank: v.rank,
    points: v.points,
  }));
  for (let i = 0; i < inserts.length; i += 200) {
    const { error } = await supabase.from("svs_prep_results").insert(inserts.slice(i, i + 200));
    if (error) return { saved: 0, error: error.message };
  }

  revalidatePath("/svs-prep");
  revalidatePath("/percentages");
  return { saved: inserts.length, error: null };
}

export async function deletePrepEvent(eventId: string): Promise<{ error: string | null }> {
  const membership = await requireMembership();
  if (!membership.isAdmin) return { error: "Only admins can delete SvS prep." };
  const supabase = await createClient();
  const { error } = await supabase.from("svs_prep_events").delete().eq("id", eventId).eq("org_id", membership.orgId);
  if (error) return { error: error.message };
  revalidatePath("/svs-prep");
  revalidatePath("/percentages");
  return { error: null };
}
