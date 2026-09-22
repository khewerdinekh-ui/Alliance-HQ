import { createClient } from "@/lib/supabase/server";
import { requireMembership } from "@/lib/membership";
import { getTranslations } from "@/lib/i18n/getLocale";
import { computeOverallPercents } from "@/lib/attendance";
import StatCard from "@/components/StatCard";
import MembersTable from "@/components/MembersTable";
import { addMember } from "./actions";

const RANKS = ["R1", "R2", "R3", "R4", "R5"];

export default async function MembersPage() {
  const membership = await requireMembership();
  const supabase = await createClient();
  const { t } = await getTranslations();
  const orgId = membership.orgId;
  const isAdmin = membership.isAdmin;

  const [{ data: subAlliances }, { data: members }, overallPercents] = await Promise.all([
    supabase.from("sub_alliances").select("id, name").eq("org_id", orgId).order("name"),
    supabase
      .from("members")
      .select("id, name, chief_id, power, level, alliance_rank, status, sub_alliances(name)")
      .eq("org_id", orgId)
      .order("name"),
    computeOverallPercents(supabase, orgId),
  ]);

  const currentMembers = members?.filter((m) => m.status === "current") ?? [];
  const oldMembers = members?.filter((m) => m.status === "old") ?? [];

  const tableRows = (members ?? []).map((m) => ({
    id: m.id,
    name: m.name,
    chief_id: m.chief_id,
    power: m.power,
    level: m.level,
    alliance_rank: m.alliance_rank,
    status: m.status,
    allianceName: (m.sub_alliances as unknown as { name: string } | null)?.name ?? "",
    overallPct: overallPercents.get(m.id) ?? 0,
  }));

  return (
    <>
      <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">
        {t("members.eyebrow")}
      </p>
      <h1 className="mt-1 text-2xl font-semibold text-slate-900">{t("members.title")}</h1>
      <p className="mt-1 text-sm text-slate-500">{t("members.subtitle")}</p>

      <div className="mb-6 mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label={t("members.totalMembers")} value={members?.length ?? 0} accent="teal" />
        <StatCard label={t("members.current")} value={currentMembers.length} accent="violet" />
        <StatCard label={t("members.oldMembers")} value={oldMembers.length} accent="slate" />
        <StatCard
          label={t("members.alliances")}
          value={subAlliances?.length ?? 0}
          accent="amber"
        />
      </div>

      {isAdmin && (
        <div className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">{t("members.addMember")}</h2>
          </div>
          <form action={addMember} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-6">
            <input type="hidden" name="orgId" value={orgId} />
            <input
              name="name"
              placeholder={t("members.namePlaceholder")}
              required
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm sm:col-span-2"
            />
            <input
              name="chiefId"
              placeholder={t("members.tableChiefId")}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <select
              name="subAllianceId"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              defaultValue=""
            >
              <option value="">{t("members.noAlliance")}</option>
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
              {t("members.addMember")}
            </button>
            <input
              name="power"
              placeholder={t("members.tablePower")}
              type="number"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              name="level"
              placeholder={t("members.tableLevel")}
              type="number"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </form>
        </div>
      )}

      <MembersTable
        members={tableRows}
        allianceNames={subAlliances?.map((a) => a.name) ?? []}
        isAdmin={isAdmin}
      />
    </>
  );
}
