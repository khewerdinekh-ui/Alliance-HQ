import Link from "next/link";

export default function SubscriptionPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Alliance HQ for your alliance</h1>
        <p className="mt-2 text-sm text-slate-600">
          Already running Alliance HQ for your own group? Every alliance gets its own private
          Command Centre — member roster, Foundry/Canyon/Bear attendance tracking, and
          participation percentages — free to create right now.
        </p>

        <div className="mt-6 rounded-xl border border-teal-100 bg-teal-50 p-4">
          <h2 className="text-sm font-semibold text-teal-900">Want it for a different alliance?</h2>
          <p className="mt-1 text-sm text-teal-800">
            If you&apos;re not part of this alliance and want your own group set up, get in
            touch and we&apos;ll walk you through subscription options.
          </p>
        </div>

        <div className="mt-6 flex flex-col gap-3">
          <Link
            href="/contact"
            className="rounded-lg bg-teal-600 py-2.5 text-center text-sm font-medium text-white transition hover:bg-teal-700"
          >
            Contact us
          </Link>
          <Link
            href="/onboarding"
            className="rounded-lg border border-slate-300 py-2.5 text-center text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Create or join an alliance
          </Link>
        </div>
      </div>
    </div>
  );
}
