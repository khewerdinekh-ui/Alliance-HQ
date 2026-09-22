import Link from "next/link";

export default function OnboardingChoicePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm text-center">
        <h1 className="text-xl font-semibold text-slate-900">Welcome to Alliance HQ</h1>
        <p className="mt-1 text-sm text-slate-500">Join your alliance or start a new one.</p>

        <div className="mt-6 space-y-3">
          <Link
            href="/onboarding/join"
            className="block w-full rounded-lg bg-teal-600 py-2.5 text-sm font-medium text-white transition hover:bg-teal-700"
          >
            Join an alliance
          </Link>
          <Link
            href="/onboarding/create"
            className="block w-full rounded-lg border border-slate-300 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Create an alliance
          </Link>
        </div>
      </div>
    </div>
  );
}
