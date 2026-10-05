import { requireMembership } from "@/lib/membership";
import { createClient } from "@/lib/supabase/server";
import TroopsGrid from "@/components/TroopsGrid";

export default async function TroopsPage() {
  const membership = await requireMembership();
  const supabase = await createClient();

  const [{ data: members }, { data: troops }] = await Promise.all([
    supabase
      .from("members")
      .select("id, name")
      .eq("org_id", membership.orgId)
      .eq("status", "current")
      .order("name"),
    supabase
      .from("troops")
      .select("member_id, infantry, lancers, marksmen, slot_1, slot_2, slot_3, status")
      .eq("org_id", membership.orgId),
  ]);

  const byMember = new Map((troops ?? []).map((t) => [t.member_id, t]));

  return (
    <>
      <h2 className="text-xs font-semibold uppercase tracking-wide text-teal-700">Troops</h2>
      <h1 className="mt-1 text-2xl font-semibold text-slate-900">Dealer troops and SvS availability.</h1>
      <p className="mt-1 text-sm text-slate-500">
        Each member&apos;s troop tiers and which SvS time slots they can make.
        {membership.isAdmin ? " Changes save as you make them." : ""}
      </p>
      <div className="mt-6">
        <TroopsGrid
          isAdmin={membership.isAdmin}
          rows={(members ?? []).map((m) => {
            const t = byMember.get(m.id);
            return {
              memberId: m.id,
              name: m.name,
              infantry: t?.infantry ?? "",
              lancers: t?.lancers ?? "",
              marksmen: t?.marksmen ?? "",
              slot1: t?.slot_1 ?? false,
              slot2: t?.slot_2 ?? false,
              slot3: t?.slot_3 ?? false,
              status: t?.status ?? "",
            };
          })}
        />
      </div>
    </>
  );
}
