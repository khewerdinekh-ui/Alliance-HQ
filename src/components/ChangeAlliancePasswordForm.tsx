"use client";

import { useActionState, useEffect, useState } from "react";
import { updateOrgPassword } from "@/app/(app)/admin/actions";

export default function ChangeAlliancePasswordForm() {
  const [result, action, pending] = useActionState(updateOrgPassword, undefined);
  const [key, setKey] = useState(0);

  const success = result === "updated";

  useEffect(() => {
    if (success) setKey((k) => k + 1);
  }, [success]);

  return (
    <form key={key} action={action} className="mt-3 flex flex-wrap items-end gap-2">
      <label className="text-xs font-medium text-slate-500">
        New alliance password
        <input
          type="password"
          name="newPassword"
          required
          minLength={8}
          className="mt-1 block rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </label>
      <label className="text-xs font-medium text-slate-500">
        Confirm password
        <input
          type="password"
          name="confirmPassword"
          required
          minLength={8}
          className="mt-1 block rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-teal-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-teal-700 disabled:opacity-60"
      >
        {pending ? "Saving…" : "Change password"}
      </button>
      {result && !success && <p className="w-full text-sm text-red-600">{result}</p>}
      {success && <p className="w-full text-sm text-teal-700">Alliance password updated.</p>}
    </form>
  );
}
