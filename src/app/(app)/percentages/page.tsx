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
      .select("id, event_type, event_date, bear_slot")
      .eq("org_id", orgId)
      .gte("event_date", formatDate(rangeStart))
      .lte("event_date", formatDate(rangeEnd)),
  ]);

  const eventIds = events?.map((e) => e.id) ?? [];
  const { data: attendance } = eventIds.length
    ? await supabase
        .from("attendance")
        .select("event_id, member_id, status, signed_up")
        .in("event_id", eventIds)
    : {
        data: [] as { event_id: string; member_id: string; status: string; signed_up: boolean }[],
      };

  // Bear runs 4 slots per date, but all 4 count as ONE event: fold every Bear
  // event id on the same date into a single "unit" for both the denominators
  // (event counts) and the per-member tally below. Foundry/Canyon events are
  // each their own unit, same as before.
  type Unit = { type: (typeof TYPES)[number]; eventDate: string };
  const unitByEventId = new Map<string, string>();
  const unitInfo = new Map<string, Unit>();
  const eventInfoById = new Map<
    string,
    { type: (typeof TYPES)[number]; eventDate: string; bearSlot: number | null }
  >();
  for (const e of events ?? []) {
    const type = e.event_type as (typeof TYPES)[number];
    const unitKey = type === "bear" ? `bear-${e.event_date}` : e.id;
    unitByEventId.set(e.id, unitKey);
    if (!unitInfo.has(unitKey)) unitInfo.set(unitKey, { type, eventDate: e.event_date });
    eventInfoById.set(e.id, { type, eventDate: e.event_date, bearSlot: e.bear_slot ?? null });
  }

  const units = [...unitInfo.values()];
  const eventsByType = {
    foundry: units.filter((u) => u.type === "foundry").length,
    canyon: units.filter((u) => u.type === "canyon").length,
    bear: units.filter((u) => u.type === "bear").length,
  };
  const totalEvents = eventsByType.foundry + eventsByType.canyon + eventsByType.bear;

  // Per member per unit, keep the best status across that unit's slot(s):
  // attended beats excused beats a real (signed-up) no_show beats simply
  // never having signed up at all — so one attended Bear slot marks the
  // whole day attended, and someone who never signed up isn't counted as an
  // unexcused no-show (matching one signed_up=true attendance row).
  type EffectiveStatus = "attended" | "excused" | "no_show" | "not_signed_up";
  const statusPriority: Record<EffectiveStatus, number> = {
    attended: 4,
    excused: 3,
    no_show: 2,
    not_signed_up: 1,
  };
  function effectiveStatus(status: string, signedUp: boolean): EffectiveStatus {
    if (status === "no_show" && !signedUp) return "not_signed_up";
    return status as EffectiveStatus;
  }

  const memberUnitStatus = new Map<string, Map<string, EffectiveStatus>>();
  for (const row of attendance ?? []) {
    const unitKey = unitByEventId.get(row.event_id);
    if (!unitKey) continue;
    if (!memberUnitStatus.has(row.member_id)) memberUnitStatus.set(row.member_id, new Map());
    const memberUnits = memberUnitStatus.get(row.member_id)!;
    const status = effectiveStatus(row.status, row.signed_up);
    const existing = memberUnits.get(unitKey);
    if (!existing || statusPriority[status] > statusPriority[existing]) {
      memberUnits.set(unitKey, status);
    }
  }

  const stats = new Map(
    members?.map((m) => [
      m.id,
      {
        foundry: { attended: 0, excused: 0, noShow: 0, notSignedUp: 0 },
        canyon: { attended: 0, excused: 0, noShow: 0, notSignedUp: 0 },
        bear: { attended: 0, excused: 0, noShow: 0, notSignedUp: 0 },
        events: [] as AttendanceEntry[],
      },
    ])
  );

  for (const [memberId, memberUnits] of memberUnitStatus) {
    const memberStats = stats.get(memberId);
    if (!memberStats) continue;
    for (const [unitKey, status] of memberUnits) {
      const info = unitInfo.get(unitKey);
      if (!info) continue;
      const bucket = memberStats[info.type];
      if (status === "attended") bucket.attended += 1;
      else if (status === "excused") bucket.excused += 1;
      else if (status === "no_show") bucket.noShow += 1;
      else bucket.notSignedUp += 1;
    }
  }

  // Detail-view entries are per individual event (so a member's Bear history
  // shows which slot they attended, e.g. "Bear 2"), separate from the
  // unit-collapsed totals above used for the percentages themselves.
  for (const row of attendance ?? []) {
    const info = eventInfoById.get(row.event_id);
    const memberStats = stats.get(row.member_id);
    if (!info || !memberStats) continue;
    memberStats.events.push({
      eventType: info.type,
      eventDate: info.eventDate,
      status: row.status as AttendanceEntry["status"],
      bearSlot: info.bearSlot,
      signedUp: row.signed_up,
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
    const totalNotSignedUp = s.foundry.notSignedUp + s.canyon.notSignedUp + s.bear.notSignedUp;
    const noShowPct = pct(totalNoShow, totalEvents - totalExcused - totalNotSignedUp);

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
