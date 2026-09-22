import type { SupabaseClient } from "@supabase/supabase-js";

function formatDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

// Rolling 3-month overall attendance % per member (same window as the Percentages page).
// Bear runs 4 slots per date but the alliance treats all 4 as ONE event, so every
// Bear event id on the same date is folded into a single "unit" for both the
// denominator (event count) and the numerator (attended if any slot was attended).
export async function computeOverallPercents(
  supabase: SupabaseClient,
  orgId: string
): Promise<Map<string, number>> {
  const rangeEnd = new Date();
  const rangeStart = new Date();
  rangeStart.setMonth(rangeStart.getMonth() - 3);

  const { data: events } = await supabase
    .from("events")
    .select("id, event_type, event_date")
    .eq("org_id", orgId)
    .gte("event_date", formatDate(rangeStart))
    .lte("event_date", formatDate(rangeEnd));

  const unitByEventId = new Map(
    (events ?? []).map((e) => [
      e.id,
      e.event_type === "bear" ? `bear-${e.event_date}` : e.id,
    ])
  );
  const totalEvents = new Set(unitByEventId.values()).size;
  const eventIds = events?.map((e) => e.id) ?? [];

  const result = new Map<string, number>();
  if (!eventIds.length) return result;

  const { data: attendance } = await supabase
    .from("attendance")
    .select("member_id, status, event_id")
    .in("event_id", eventIds);

  const attendedUnitsByMember = new Map<string, Set<string>>();
  for (const row of attendance ?? []) {
    if (row.status !== "attended") continue;
    const unit = unitByEventId.get(row.event_id);
    if (!unit) continue;
    if (!attendedUnitsByMember.has(row.member_id)) attendedUnitsByMember.set(row.member_id, new Set());
    attendedUnitsByMember.get(row.member_id)!.add(unit);
  }

  for (const [memberId, units] of attendedUnitsByMember) {
    result.set(memberId, Math.round((units.size / totalEvents) * 1000) / 10);
  }

  return result;
}
