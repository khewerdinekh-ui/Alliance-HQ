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

  // SvS prep imports count as events too — making the top 200 is "attending",
  // matching the Percentages page.
  const { data: prepEvents } = await supabase
    .from("svs_prep_events")
    .select("id, event_date")
    .eq("org_id", orgId)
    .gte("event_date", rangeStartStr)
    .lte("event_date", formatDate(rangeEnd));
  const prepDateById = new Map((prepEvents ?? []).map((e) => [e.id as string, e.event_date as string]));
  const prepIds = [...prepDateById.keys()];
  const prepResults = prepIds.length
    ? await fetchAll<{ event_id: string; member_id: string }>((from, to) =>
        supabase
          .from("svs_prep_results")
          .select("event_id, member_id")
          .in("event_id", prepIds)
          .order("id")
          .range(from, to)
      )
    : [];
  const prepDatesByMember = new Map<string, string[]>();
  for (const r of prepResults) {
    const d = prepDateById.get(r.event_id);
    if (d) prepDatesByMember.set(r.member_id, [...(prepDatesByMember.get(r.member_id) ?? []), d]);
  }
  const prepSince = (start: string) => [...prepDateById.values()].filter((d) => d >= start).length;

  const result = new Map<string, number>();
  if (!eventIds.length && !prepIds.length) return result;

  const attendance = eventIds.length
    ? await fetchAll<{ member_id: string; status: string; event_id: string }>((from, to) =>
        supabase
          .from("attendance")
          .select("member_id, status, event_id")
          .in("event_id", eventIds)
          .order("id")
          .range(from, to)
      )
    : [];

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

  const memberIds = new Set([...attendedUnitsByMember.keys(), ...prepDatesByMember.keys()]);
  for (const memberId of memberIds) {
    const start = startByMember.get(memberId) ?? rangeStartStr;
    const attended = attendedUnitsByMember.get(memberId)?.size ?? 0;
    const prepIn = (prepDatesByMember.get(memberId) ?? []).filter((d) => d >= start).length;
    const total = unitsSince(start) + prepSince(start);
    result.set(memberId, total > 0 ? Math.round(((attended + prepIn) / total) * 1000) / 10 : 0);
  }

  return result;
}