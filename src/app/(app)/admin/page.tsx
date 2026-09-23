import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireMembership } from "@/lib/membership";
import ChangeAlliancePasswordForm from "@/components/ChangeAlliancePasswordForm";
import {
  addSubAlliance,
  deleteSubAlliance,
  removeOrgMember,
  setMemberAdmin,
  updateMemberRank,
  updateOrgDetails,
} from "./actions";

const RANKS = ["R1", "R2", "R3", "R4", "R5"];

export default async function AdminPage() {
  const membership = await requireMembership();
  if (!membership.isAdmin) {
    redirect("/members");
  }

  const supabase = await createClient();
  const orgId = membership.orgId;

  const [{ data: orgMembers }, { data: subAlliances }, { data: org }] = await Promise.all([
    supabase
      .from("org_members")
      .select("id, chief_id, display_name, alliance_rank, is_admin")
      .eq("org_id", orgId)
      .order("display_name"),
    supabase.from("sub_alliances").select("id, name").eq("org_id", orgId).order("name"),
    supabase.from("orgs").select("name, state").eq("id", orgId).single(),
  ]);

  const adminCount = orgMembers?.filter((m) => m.is_admin).length ?? 0;

  return (
    <>
      <h2 className="text-xs font-semibold uppercase tracking-wide text-teal-700">Admin</h2>
      <h1 className="mt-1 text-2xl font-semibold text-slate-900">Alliance settings.</h1>
      <p className="mt-1 text-sm text-slate-500">
        Manage sub-alliances and member roles. There must always be at least one admin.
      </p>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900">Alliance details</h3>
        <form action={updateOrgDetails} className="mt-3 flex flex-wrap items-end gap-2">
          <label className="text-xs font-medium text-slate-500">
            Alliance name
            <input
              name="orgName"
              defaultValue={org?.name ?? ""}
              required
              className="mt-1 block rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-xs font-medium text-slate-500">
            State
            <input
              name="orgState"
              defaultValue={org?.state ?? ""}
              required
              className="mt-1 block w-28 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <button
            type="submit"
            className="rounded-lg bg-teal-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-teal-700"
          >
            Save
          </button>
        </form>

        <div className="mt-5 border-t border-slate-100 pt-5">
          <h3 className="text-sm font-semibold text-slate-900">Alliance password</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Everyone signs in with this shared password — changing it doesn't affect Chief IDs or ranks.
          </p>
          <ChangeAlliancePasswordForm />
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900">Sub-alliances</h3>
        <form action={addSubAlliance} className="mt-3 flex gap-2">
          <input
            name="name"
            placeholder="e.g. ICZ"
            required
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="rounded-lg bg-teal-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-teal-700"
          >
            Add
          </button>
        </form>
        <div className="mt-4 flex flex-wrap gap-2">
          {subAlliances?.map((a) => (
            <div
              key={a.id}
              className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm"
            >
              {a.name}
              <form action={deleteSubAlliance}>
                <input type="hidden" name="id" value={a.id} />
                <button className="text-slate-400 hover:text-red-600">×</button>
              </form>
            </div>
          ))}
          {!subAlliances?.length && (
            <p className="text-sm text-slate-400">No sub-alliances yet.</p>
          )}
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-900">Members with access</h3>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Chief ID</th>
              <th className="px-4 py-2">Rank</th>
              <th className="px-4 py-2">Admin</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {orgMembers?.map((m) => {
              const isLastAdmin = m.is_admin && adminCount <= 1;
              return (
                <tr key={m.id}>
                  <td className="px-4 py-2 font-medium text-slate-900">{m.display_name}</td>
                  <td className="px-4 py-2 text-slate-600">{m.chief_id}</td>
                  <td className="px-4 py-2">
                    <form action={updateMemberRank} className="flex items-center gap-1">
                      <input type="hidden" name="id" value={m.id} />
                      <select
                        name="rank"
                        defaultValue={m.alliance_rank}
                        className="rounded-lg border border-slate-300 px-2 py-1 text-sm"
                      >
                        {RANKS.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                      <button className="text-xs text-teal-700 hover:underline">Save</button>
                    </form>
                  </td>
                  <td className="px-4 py-2">
                    {m.is_admin ? (
                      <span className="rounded-full bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-700">
                        Admin
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">Member</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex justify-end gap-2">
                      {m.is_admin ? (
                        <form action={setMemberAdmin}>
                          <input type="hidden" name="id" value={m.id} />
                          <input type="hidden" name="isAdmin" value="false" />
                          <button
                            disabled={isLastAdmin}
                            title={isLastAdmin ? "At least one admin is required" : undefined}
                            className="text-xs text-slate-500 hover:underline disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            Remove admin
                          </button>
                        </form>
                      ) : (
                        <form action={setMemberAdmin}>
                          <input type="hidden" name="id" value={m.id} />
                          <input type="hidden" name="isAdmin" value="true" />
                          <button className="text-xs text-teal-700 hover:underline">
                            Make admin
                          </button>
                        </form>
                      )}
                      <form action={removeOrgMember}>
                        <input type="hidden" name="id" value={m.id} />
                        <button
                          disabled={isLastAdmin}
                          title={isLastAdmin ? "At least one admin is required" : undefined}
                          className="text-xs text-red-600 hover:underline disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Remove
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
