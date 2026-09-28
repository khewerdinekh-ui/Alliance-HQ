import { redirect } from "next/navigation";
import { requireMembership } from "@/lib/membership";
import { createClient } from "@/lib/supabase/server";
import ImportClient from "@/components/ImportClient";

export default async function ImportPage() {
  const membership = await requireMembership();
  if (!membership.isAdmin) {
    redirect("/members");
  }

  const supabase = await createClient();
  const { data: subAlliances } = await supabase
    .from("sub_alliances")
    .select("id, name")
    .eq("org_id", membership.orgId)
    .order("name");

  return (
    <>
      <h2 className="text-xs font-semibold uppercase tracking-wide text-teal-700">Import</h2>
      <h1 className="mt-1 text-2xl font-semibold text-slate-900">Bulk-add members.</h1>
      <p className="mt-1 text-sm text-slate-500">
        Import a member list from a spreadsheet, CSV file, or a roster screenshot/video.
      </p>
      <div className="mt-6">
        <ImportClient subAlliances={subAlliances ?? []} />
      </div>
    </>
  );
}
