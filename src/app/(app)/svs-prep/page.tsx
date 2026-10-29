import { requireMembership } from "@/lib/membership";
import { createClient } from "@/lib/supabase/server";
import { fetchAll } from "@/lib/fetchAll";
import SvsPrepClient from "@/components/SvsPrepClient";

export default async function SvsPrepPage() {
  const membership = await requireMembership();
  const supabase = await createClient();
  const orgId = membership.orgId;

  const [{ data: members }, { data: events }] = await Promise.all([
    supabase
      .from("members")
      .select("id, name, chief_id, aliases")
      .eq("org_id", orgId)
      .eq("status", "current")
      .order("name"),
    supabase
      .from("svs_prep_events")
      .select("id, event_date, label")
      .eq("org_id", orgId)
      .order("event_date", { ascending: false })
      .limit(60),
  ]);

  const eventIds = (events ?? []).map((e) => e.id);
  const results = eventIds.length
    ? await fetchAll<{ event_id: string; member_id: string; rank: number | null; points: number | null }>(
        (from, to) =>
          supabase
            .from("svs_prep_results")
            .select("event_id, member_id, rank, points")
            .in("event_id", eventIds)
            .order("id")
            .range(from, to)
      )
    : [];

  const nameById = new Map((members ?? []).map((m) => [m.id, m.name]));
  const resultsByEvent = new Map<string, { name: string; rank: number | null; points: number | null }[]>();
  for (const r of results) {
    const name = nameById.get(r.member_id);
    if (!name) continue; // members who've since left
    resultsByEvent.set(r.event_id, [
      ...(resultsByEvent.get(r.event_id) ?? []),
      { name, rank: r.rank, points: r.points },
    ]);
  }

  return (
    <>
      <h2 className="text-xs font-semibold uppercase tracking-wide text-teal-700">SvS prep</h2>
      <h1 className="mt-1 text-2xl font-semibold text-slate-900">Top 100 prep points.</h1>
      <p className="mt-1 text-sm text-slate-500">
        Import the prep-points leaderboard to record who made the top 100. The Percentages page shows how
        often each member gets in.
      </p>
      <div className="mt-6">
        <SvsPrepClient
          isAdmin={membership.isAdmin}
          members={(members ?? []).map((m) => ({
            id: m.id,
            name: m.name,
            chiefId: m.chief_id,
            aliases: m.aliases ?? [],
          }))}
          events={(events ?? []).map((e) => ({
            id: e.id,
            date: e.event_date as string,
            label: e.label as string,
            results: (resultsByEvent.get(e.id) ?? []).sort(
              (a, b) => (a.rank ?? 999) - (b.rank ?? 999) || a.name.localeCompare(b.name)
            ),
          }))}
        />
      </div>
    </>
  );
}
