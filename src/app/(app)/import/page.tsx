import { redirect } from "next/navigation";
import { requireMembership } from "@/lib/membership";
import ImportClient from "@/components/ImportClient";

export default async function ImportPage() {
  const membership = await requireMembership();
  if (!membership.isAdmin) {
    redirect("/members");
  }

  return (
    <>
      <h2 className="text-xs font-semibold uppercase tracking-wide text-teal-700">Import</h2>
      <h1 className="mt-1 text-2xl font-semibold text-slate-900">Bulk-add members.</h1>
      <p className="mt-1 text-sm text-slate-500">
        Import a member list from a spreadsheet export or CSV file.
      </p>
      <div className="mt-6">
        <ImportClient />
      </div>
    </>
  );
}
