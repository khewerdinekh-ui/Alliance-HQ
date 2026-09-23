import Link from "next/link";
import { redirect } from "next/navigation";
import { hasOwnerSession, getMembersSeenAt } from "@/lib/ownerAuth";
import { createServiceClient } from "@/lib/supabase/service";
import { ICX_ORG_ID } from "@/lib/icxOrg";
import { markAllMembersSeen } from "./actions";
import { ownerLogout } from "../messages/actions";

export default async function OwnerMembersPage() {
  if (!(await hasOwnerSession())) {
    redirect("/owner/login");
  }

  const seenAt = await getMembersSeenAt();

  const supabase = createServiceClient();
  const { data: members } = await supabase
    .from("org_members")
    .select("id, chief_id, display_name, alliance_rank, is_admin, created_at")
    .eq("org_id", ICX_ORG_ID)
    .order("created_at", { ascending: false });

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/members"
          className="inline-flex items-center gap-1 text-sm font-medium text-teal-700 hover:underline"
        >
          ← Back to ICX
        </Link>

        <div className="mt-3 flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">Site owner</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">ICX members.</h1>
            <p className="mt-1 text-sm text-slate-500">
              Everyone who has ever joined ICX, newest first. Only you can see this page.
            </p>
          </div>
          <form action={ownerLogout}>
            <button className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50">
              Sign out
            </button>
          </form>
        </div>

        <form action={markAllMembersSeen} className="mt-4">
          <button className="rounded-full border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-medium text-teal-700 hover:bg-teal-100">
            Mark all seen
          </button>
        </form>

        <div className="mt-4 space-y-2">
          {members?.map((m) => {
            const isNew = m.created_at > seenAt;
            return (
              <div
                key={m.id}
                className={`flex items-center justify-between rounded-2xl border bg-white px-5 py-3 shadow-sm ${
                  isNew ? "border-teal-200" : "border-slate-200"
                }`}
              >
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {m.display_name}
                    {isNew && (
                      <span className="ml-2 rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-teal-700">
                        New
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Chief ID {m.chief_id} · {m.alliance_rank}
                    {m.is_admin ? " · Admin" : ""}
                  </p>
                </div>
                <span className="text-xs text-slate-400">
                  {new Date(m.created_at).toLocaleDateString()}
                </span>
              </div>
            );
          })}
          {!members?.length && (
            <p className="rounded-2xl border border-slate-200 bg-white px-5 py-8 text-center text-sm text-slate-400 shadow-sm">
              No members yet.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
