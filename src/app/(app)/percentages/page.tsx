import { createClient } from "@/lib/supabase/server";
import { requireMembership } from "@/lib/membership";
import StatCard from "@/components/StatCard";
import PercentagesTable from "@/components/PercentagesTable";
import type { AttendanceEntry } from "@/components/AttendanceDetailModal";

const TYPES = ["foundry", "canyon", "bear"] as const;

function formatDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default async function PercentagesPage() {
  const membership = await requireMembership();
  const supabase = await createClient();
  const orgId = membership.orgId;

  const rangeEnd = new Date();
  const rangeStart = new Date();
  rangeStart.setMonth(rangeStart.getMonth() - 3);

  const [{ data: members }, { data: subAlliances }, { data: events }] = await Promise.all([
    supabase
      .from("members")
      .select("id, name, chief_id, alliance_rank, sub_alliances(name)")
      .eq("org_id", orgId)
      .eq("status", "current")
      .order("name"),
    supabase.from("sub_alliances").select("id, name").eq("org_id", orgId).order("name"),
    supabase
      .from("events")
      .select("id, event_type, event_date")
      .eq("org_id", orgId)
      .gte("event_date", formatDate(rangeStart))
      .lte("event_date", formatDate(rangeEnd)),
  ]);

  const eventIds = events?.map((e) => e.id) ?? [];
  const { data: attendance } = eventIds.length
    ? await supabase
        .from("attendance")
        .select("event_id, member_id, status")
        .in("event_id", eventIds)
    : { data: [] as { event_id: string; member_id: string; status: string }[] };

  const eventsByType = {
    foundry: events?.filter((e) => e.event_type === "foundry").length ?? 0,
    canyon: events?.filter((e) => e.event_type === "canyon").length ?? 0,
    bear: events?.filter((e) => e.event_type === "bear").length ?? 0,
  };
  const totalEvents = eventsByType.foundry + eventsByType.canyon + eventsByType.bear;

  const eventById = new Map(events?.map((e) => [e.id, e]));

  const stats = new Map(
    members?.map((m) => [
      m.id,
      {
        foundry: { attended: 0, excused: 0, noShow: 0 },
        canyon: { attended: 0, excused: 0, noShow: 0 },
        bear: { attended: 0, excused: 0, noShow: 0 },
        events: [] as AttendanceEntry[],
      },
    ])
  );

  for (const row of attendance ?? []) {
    const ev = eventById.get(row.event_id);
    const memberStats = stats.get(row.member_id);
    if (!ev || !memberStats) continue;
    const type = ev.event_type as (typeof TYPES)[number];
    memberStats[type].attended += row.status === "attended" ? 1 : 0;
    if (row.status === "excused") memberStats[type].excused += 1;
    if (row.status === "no_show") memberStats[type].noShow += 1;
    memberStats.events.push({
      eventType: type,
      eventDate: ev.event_date,
      status: row.status as AttendanceEntry["status"],
    });
  }

  function pct(numerator: number, denominator: number) {
    if (denominator <= 0) return 0;
    return Math.round((numerator / denominator) * 1000) / 10;
  }

  const tableRows = (members ?? []).map((m) => {
    const s = stats.get(m.id)!;
    const foundryPct = pct(s.foundry.attended, eventsByType.foundry);
    const canyonPct = pct(s.canyon.attended, eventsByType.canyon);
    const bearPct = pct(s.bear.attended, eventsByType.bear);
    const totalAttended = s.foundry.attended + s.canyon.attended + s.bear.attended;
    const overallPct = pct(totalAttended, totalEvents);
    const totalExcused = s.foundry.excused + s.canyon.excused + s.bear.excused;
    const totalNoShow = s.foundry.noShow + s.canyon.noShow + s.bear.noShow;
    const noShowPct = pct(totalNoShow, totalEvents - totalExcused);

    return {
      id: m.id,
      name: m.name,
      chiefId: m.chief_id,
      allianceRank: m.alliance_rank,
      allianceName: (m.sub_alliances as unknown as { name: string } | null)?.name ?? "",
      foundryPct,
      canyonPct,
      bearPct,
      overallPct,
      noShowPct,
      events: s.events,
    };
  });

  return (
    <>
      <h2 className="text-xs font-semibold uppercase tracking-wide text-teal-700">
        Rolling three-month attendance
      </h2>
      <h1 className="mt-1 text-2xl font-semibold text-slate-900">Participation percentages.</h1>
      <p className="mt-1 text-sm text-slate-500">
        {formatDate(rangeStart)} to {formatDate(rangeEnd)}
      </p>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-5">
        <StatCard label="Members" value={members?.length ?? 0} accent="violet" />
        <StatCard label="Total events" value={totalEvents} accent="teal" />
        <StatCard label="Foundry" value={eventsByType.foundry} accent="amber" />
        <StatCard label="Canyon" value={eventsByType.canyon} accent="amber" />
        <StatCard label="Bear" value={eventsByType.bear} accent="amber" />
      </div>

      <p className="mt-6 text-xs text-slate-500">
        Overall attendance combines Foundry, Canyon and Bear. Tap any percentage for details.
        Excuses are excluded from no-show %.
      </p>

      <div className="mt-4">
        <PercentagesTable
          members={tableRows}
          allianceNames={subAlliances?.map((a) => a.name) ?? []}
        />
      </div>
    </>
  );
}
