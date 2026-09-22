import { createClient } from "@/lib/supabase/server";
import { requireMembership } from "@/lib/membership";
import { getTranslations } from "@/lib/i18n/getLocale";
import { computeOverallPercents } from "@/lib/attendance";
import StatCard from "@/components/StatCard";
import MembersTable from "@/components/MembersTable";

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
      .select(
        "id, name, chief_id, power, level, alliance_rank, status, sub_alliance_id, aliases, sub_alliances(name)"
      )
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
    sub_alliance_id: m.sub_alliance_id,
    aliases: m.aliases ?? [],
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

      <MembersTable
        orgId={orgId}
        members={tableRows}
        subAlliances={subAlliances ?? []}
        isAdmin={isAdmin}
      />
    </>
  );
}
