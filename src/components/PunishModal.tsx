"use client";

import { useState, useTransition } from "react";
import { createPunishment, type EventType } from "@/app/(app)/events/actions";

export default function PunishModal({
  orgId,
  eventType,
  memberId,
  memberName,
  defaultReason,
  onClose,
  onDone,
}: {
  orgId: string;
  eventType: EventType;
  memberId: string;
  memberName: string;
  defaultReason: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [requiredEvents, setRequiredEvents] = useState(1);
  const [reason, setReason] = useState(defaultReason);
  const [pending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      await createPunishment({ orgId, memberId, eventType, requiredEvents, reason });
      onDone();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <h2 className="text-lg font-semibold text-slate-900">Punish {memberName}</h2>
        <p className="mt-1 text-sm text-slate-500">
          They&apos;ll stay in Active punishments until this many completed events have passed.
        </p>

        <div className="mt-4">
          <label className="block text-sm font-medium text-slate-700">Number of events</label>
          <input
            type="number"
            min={1}
            value={requiredEvents}
            onChange={(e) => setRequiredEvents(Math.max(1, Number(e.target.value)))}
            className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
          />
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium text-slate-700">Reason</label>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
          />
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={pending}
            className="rounded-xl bg-red-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-800 disabled:opacity-60"
          >
            {pending ? "Applying…" : "Punish"}
          </button>
        </div>
      </div>
    </div>
  );
}
