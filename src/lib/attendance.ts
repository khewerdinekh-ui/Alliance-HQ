import type { SupabaseClient } from "@supabase/supabase-js";

function formatDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

// Rolling 3-month overall attendance % per member (same window as the Percentages page).
export async function computeOverallPercents(
  supabase: SupabaseClient,
  orgId: string
): Promise<Map<string, number>> {
  const rangeEnd = new Date();
  const rangeStart = new Date();
  rangeStart.setMonth(rangeStart.getMonth() - 3);

  const { data: events } = await supabase
    .from("events")
    .select("id")
    .eq("org_id", orgId)
    .gte("event_date", formatDate(rangeStart))
    .lte("event_date", formatDate(rangeEnd));

  const totalEvents = events?.length ?? 0;
  const eventIds = events?.map((e) => e.id) ?? [];

  const result = new Map<string, number>();
  if (!eventIds.length) return result;

  const { data: attendance } = await supabase
    .from("attendance")
    .select("member_id, status")
    .in("event_id", eventIds);

  const attendedByMember = new Map<string, number>();
  for (const row of attendance ?? []) {
    if (row.status === "attended") {
      attendedByMember.set(row.member_id, (attendedByMember.get(row.member_id) ?? 0) + 1);
    }
  }

  for (const [memberId, attended] of attendedByMember) {
    result.set(memberId, Math.round((attended / totalEvents) * 1000) / 10);
  }

  return result;
}
