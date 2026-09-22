"use client";

import Link from "next/link";
import { useActionState } from "react";
import { sendContactMessage } from "./actions";

export default function ContactPage() {
  const [result, formAction, pending] = useActionState(sendContactMessage, undefined);
  const sent = result === "sent";

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Contact us</h1>
        <p className="mt-1 text-sm text-slate-500">
          Want Alliance HQ for your own alliance? Tell us a bit about you and we&apos;ll be in
          touch about subscription options.
        </p>

        {sent ? (
          <div className="mt-6 rounded-lg bg-teal-50 p-4 text-sm text-teal-800">
            Thanks — we&apos;ve got your message and will get back to you soon.
          </div>
        ) : (
          <form action={formAction} className="mt-6 space-y-4">
            <Field label="Your name" name="name" required />
            <Field label="Alliance name (optional)" name="allianceName" />
            <Field
              label="Email or Discord"
              name="contactInfo"
              required
              placeholder="How should we reach you?"
            />
            <div>
              <label className="block text-sm font-medium text-slate-700">Message</label>
              <textarea
                name="message"
                required
                rows={4}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
            </div>

            {result && !sent && <p className="text-sm text-red-600">{result}</p>}

            <button
              type="submit"
              disabled={pending}
              className="w-full rounded-lg bg-teal-600 py-2.5 text-sm font-medium text-white transition hover:bg-teal-700 disabled:opacity-60"
            >
              {pending ? "Sending…" : "Send message"}
            </button>
          </form>
        )}

        <p className="mt-4 text-xs text-slate-400">
          <Link href="/onboarding" className="text-teal-600 hover:underline">
            ← Back to Alliance HQ
          </Link>
        </p>
      </div>
    </div>
  );
}

function Field({
  label,
  name,
  required = false,
  placeholder,
}: {
  label: string;
  name: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700">{label}</label>
      <input
        name={name}
        required={required}
        placeholder={placeholder}
        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
      />
    </div>
  );
}
