import { redirect } from "next/navigation";
import { hasOwnerSession } from "@/lib/ownerAuth";
import { createServiceClient } from "@/lib/supabase/service";
import { resolveContactMessage, ownerLogout } from "./actions";

export default async function OwnerMessagesPage() {
  if (!(await hasOwnerSession())) {
    redirect("/owner/login");
  }

  const supabase = createServiceClient();
  const { data: messages } = await supabase
    .from("contact_messages")
    .select("id, name, alliance_name, contact_info, message, resolved, created_at")
    .order("created_at", { ascending: false });

  const unresolved = messages?.filter((m) => !m.resolved) ?? [];
  const resolved = messages?.filter((m) => m.resolved) ?? [];

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">Site owner</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">Contact messages.</h1>
            <p className="mt-1 text-sm text-slate-500">
              Submissions from the public "Contact us" form. Only you can see this page.
            </p>
          </div>
          <form action={ownerLogout}>
            <button className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50">
              Sign out
            </button>
          </form>
        </div>

        <div className="mt-6 space-y-3">
          {unresolved.map((m) => (
            <MessageCard key={m.id} message={m} />
          ))}
          {unresolved.length === 0 && (
            <p className="rounded-2xl border border-slate-200 bg-white px-5 py-8 text-center text-sm text-slate-400 shadow-sm">
              No new messages.
            </p>
          )}
        </div>

        {resolved.length > 0 && (
          <details className="mt-6">
            <summary className="cursor-pointer text-xs font-medium text-slate-500 hover:underline">
              Handled ({resolved.length})
            </summary>
            <div className="mt-3 space-y-3">
              {resolved.map((m) => (
                <MessageCard key={m.id} message={m} />
              ))}
            </div>
          </details>
        )}
      </div>
    </div>
  );
}

type Message = {
  id: string;
  name: string;
  alliance_name: string | null;
  contact_info: string;
  message: string;
  resolved: boolean;
  created_at: string;
};

function MessageCard({ message: m }: { message: Message }) {
  return (
    <div
      className={`rounded-2xl border bg-white p-5 shadow-sm ${
        m.resolved ? "border-slate-200" : "border-teal-200"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">
            {m.name}
            {m.alliance_name ? <span className="text-slate-400"> · {m.alliance_name}</span> : null}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">{m.contact_info}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">
            {new Date(m.created_at).toLocaleString()}
          </span>
          {!m.resolved && (
            <form action={resolveContactMessage}>
              <input type="hidden" name="id" value={m.id} />
              <button className="rounded-full border border-teal-200 px-3 py-1 text-xs font-medium text-teal-700 hover:bg-teal-50">
                Mark handled
              </button>
            </form>
          )}
        </div>
      </div>
      <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{m.message}</p>
    </div>
  );
}
