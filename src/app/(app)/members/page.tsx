import { createClient } from "@/lib/supabase/server";
import { requireMembership } from "@/lib/membership";
import { addMember, deleteMember, toggleMemberStatus } from "./actions";

const RANKS = ["R1", "R2", "R3", "R4", "R5"];

export default async function MembersPage() {
  const membership = await requireMembership();
  const supabase = await createClient();
  const orgId = membership.orgId;
  const isAdmin = membership.isAdmin;

  const [{ data: subAlliances }, { data: members }] = await Promise.all([
    supabase.from("sub_alliances").select("id, name").eq("org_id", orgId).order("name"),
    supabase
      .from("members")
      .select("id, name, chief_id, power, level, alliance_rank, status, sub_alliances(name)")
      .eq("org_id", orgId)
      .order("name"),
  ]);

  const currentMembers = members?.filter((m) => m.status === "current") ?? [];
  const oldMembers = members?.filter((m) => m.status === "old") ?? [];

  return (
    <>
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total members" value={members?.length ?? 0} />
        <StatCard label="Current" value={currentMembers.length} />
        <StatCard label="Old members" value={oldMembers.length} />
        <StatCard label="Alliances" value={subAlliances?.length ?? 0} />
      </div>

      {isAdmin && (
        <div className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Add member</h2>
          <form action={addMember} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-6">
            <input type="hidden" name="orgId" value={orgId} />
            <input
              name="name"
              placeholder="Name"
              required
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm sm:col-span-2"
            />
            <input
              name="chiefId"
              placeholder="Chief ID"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <select
              name="subAllianceId"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              defaultValue=""
            >
              <option value="">No alliance</option>
              {subAlliances?.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            <select
              name="allianceRank"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              defaultValue="R1"
            >
              {RANKS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="rounded-lg bg-teal-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-teal-700"
            >
              Add member
            </button>
            <input
              name="power"
              placeholder="Power"
              type="number"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              name="level"
              placeholder="Level"
              type="number"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </form>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Member</th>
              <th className="px-4 py-3">Alliance</th>
              <th className="px-4 py-3">Chief ID</th>
              <th className="px-4 py-3">Power</th>
              <th className="px-4 py-3">Level</th>
              <th className="px-4 py-3">Rank</th>
              {isAdmin && <th className="px-4 py-3" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {currentMembers.map((m) => (
              <tr key={m.id}>
                <td className="px-4 py-3 font-medium text-slate-900">{m.name}</td>
                <td className="px-4 py-3 text-slate-600">
                  {(m.sub_alliances as unknown as { name: string } | null)?.name ?? "—"}
                </td>
                <td className="px-4 py-3 text-slate-600">{m.chief_id ?? "—"}</td>
                <td className="px-4 py-3 text-slate-600">{m.power ?? "—"}</td>
                <td className="px-4 py-3 text-slate-600">{m.level ?? "—"}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-700">
                    {m.alliance_rank}
                  </span>
                </td>
                {isAdmin && (
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <form action={toggleMemberStatus}>
                        <input type="hidden" name="id" value={m.id} />
                        <input type="hidden" name="nextStatus" value="old" />
                        <button className="text-xs text-slate-500 hover:underline">
                          Mark old
                        </button>
                      </form>
                      <form action={deleteMember}>
                        <input type="hidden" name="id" value={m.id} />
                        <button className="text-xs text-red-600 hover:underline">Delete</button>
                      </form>
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {currentMembers.length === 0 && (
              <tr>
                <td colSpan={isAdmin ? 7 : 6} className="px-4 py-8 text-center text-slate-400">
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

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}
