import { createClient } from "@/lib/supabase/server";
import { requireMembership } from "@/lib/membership";
import StatCard from "@/components/StatCard";

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

  const [{ data: members }, { data: events }] = await Promise.all([
    supabase
      .from("members")
      .select("id, name, alliance_rank")
      .eq("org_id", orgId)
      .eq("status", "current")
      .order("name"),
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

  const eventTypeById = new Map(events?.map((e) => [e.id, e.event_type]));

  const stats = new Map(
    members?.map((m) => [
      m.id,
      {
        foundry: { attended: 0, excused: 0, noShow: 0, marked: 0 },
        canyon: { attended: 0, excused: 0, noShow: 0, marked: 0 },
        bear: { attended: 0, excused: 0, noShow: 0, marked: 0 },
      },
    ])
  );

  for (const row of attendance ?? []) {
    const type = eventTypeById.get(row.event_id) as (typeof TYPES)[number] | undefined;
    const memberStats = stats.get(row.member_id);
    if (!type || !memberStats) continue;
    memberStats[type].marked += 1;
    if (row.status === "attended") memberStats[type].attended += 1;
    else if (row.status === "excused") memberStats[type].excused += 1;
    else memberStats[type].noShow += 1;
  }

  function pct(numerator: number, denominator: number) {
    if (denominator <= 0) return 0;
    return Math.round((numerator / denominator) * 1000) / 10;
  }

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
        Overall attendance combines Foundry, Canyon and Bear. Excuses are excluded from
        no-show %.
      </p>

      <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Member</th>
              <th className="px-4 py-3">Rank</th>
              <th className="px-4 py-3">Foundry %</th>
              <th className="px-4 py-3">Canyon %</th>
              <th className="px-4 py-3">Bear %</th>
              <th className="px-4 py-3">Overall %</th>
              <th className="px-4 py-3">No-show %</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {members?.map((m) => {
              const s = stats.get(m.id)!;
              const foundryPct = pct(s.foundry.attended, eventsByType.foundry);
              const canyonPct = pct(s.canyon.attended, eventsByType.canyon);
              const bearPct = pct(s.bear.attended, eventsByType.bear);

              const totalAttended = s.foundry.attended + s.canyon.attended + s.bear.attended;
              const overallPct = pct(totalAttended, totalEvents);

              const totalExcused = s.foundry.excused + s.canyon.excused + s.bear.excused;
              const totalNoShow = s.foundry.noShow + s.canyon.noShow + s.bear.noShow;
              const noShowDenominator = totalEvents - totalExcused;
              const noShowPct = pct(totalNoShow, noShowDenominator);

              return (
                <tr key={m.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">{m.name}</td>
                  <td className="px-4 py-3 text-slate-600">{m.alliance_rank}</td>
                  <td className="px-4 py-3 text-slate-600">{foundryPct.toFixed(1)}%</td>
                  <td className="px-4 py-3 text-slate-600">{canyonPct.toFixed(1)}%</td>
                  <td className="px-4 py-3 text-slate-600">{bearPct.toFixed(1)}%</td>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {overallPct.toFixed(1)}%
                  </td>
                  <td className="px-4 py-3 text-red-600">{noShowPct.toFixed(1)}%</td>
                </tr>
              );
            })}
            {!members?.length && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                  No members yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
