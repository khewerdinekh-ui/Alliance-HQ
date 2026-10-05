import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAll } from "@/lib/fetchAll";

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
  // Date of each unit, so a member who joined inside the window is measured
  // only from their join date — exactly like the Percentages page.
  const dateByUnit = new Map<string, string>();
  for (const e of events ?? []) {
    const unit = e.event_type === "bear" ? `bear-${e.event_date}` : e.id;
    dateByUnit.set(unit, e.event_date);
  }
  const rangeStartStr = formatDate(rangeStart);
  const { data: memberDates } = await supabase.from("members").select("id, joined_at").eq("org_id", orgId);
  const startByMember = new Map(
    (memberDates ?? []).map((m) => [
      m.id as string,
      m.joined_at && (m.joined_at as string) > rangeStartStr ? (m.joined_at as string) : rangeStartStr,
    ])
  );
  const unitsSince = (start: string) => [...dateByUnit.values()].filter((d) => d >= start).length;
  const eventIds = events?.map((e) => e.id) ?? [];

  const result = new Map<string, number>();
  if (!eventIds.length) return result;

  const attendance = await fetchAll<{ member_id: string; status: string; event_id: string }>((from, to) =>
    supabase
      .from("attendance")
      .select("member_id, status, event_id")
      .in("event_id", eventIds)
      .order("id")
      .range(from, to)
  );

  const attendedUnitsByMember = new Map<string, Set<string>>();
  for (const row of attendance) {
    if (row.status !== "attended") continue;
    const unit = unitByEventId.get(row.event_id);
    if (!unit) continue;
    const start = startByMember.get(row.member_id) ?? rangeStartStr;
    if ((dateByUnit.get(unit) ?? "") < start) continue;
    if (!attendedUnitsByMember.has(row.member_id)) attendedUnitsByMember.set(row.member_id, new Set());
    attendedUnitsByMember.get(row.member_id)!.add(unit);
  }

  for (const [memberId, units] of attendedUnitsByMember) {
    const total = unitsSince(startByMember.get(memberId) ?? rangeStartStr);
    result.set(memberId, total > 0 ? Math.round((units.size / total) * 1000) / 10 : 0);
  }

  return result;
}
