"use client";

import { useState } from "react";
import PunishModal from "@/components/PunishModal";
import type { EventType } from "@/app/(app)/events/actions";

export default function DoNotSignUpPanel({
  orgId,
  eventType,
  label,
  eventDate,
  members,
}: {
  orgId: string;
  eventType: EventType;
  label: string;
  eventDate: string;
  members: { memberId: string; name: string }[];
}) {
  const [target, setTarget] = useState<{ memberId: string; name: string } | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const visible = members.filter((m) => !dismissed.has(m.memberId));
  if (visible.length === 0) return null;

  return (
    <div className="mt-6 overflow-hidden rounded-2xl border border-red-100 bg-red-50/60">
      <div className="flex items-start justify-between px-5 py-4">
        <div>
          <h3 className="text-sm font-semibold text-red-900">Don&apos;t sign up next time</h3>
          <p className="mt-0.5 text-xs text-red-700">
            No reason given after missing {label} on {eventDate}. This list clears after the next{" "}
            {label} is completed.
          </p>
        </div>
        <span className="flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-red-100 px-1.5 text-xs font-semibold text-red-700">
          {visible.length}
        </span>
      </div>
      <div className="space-y-2 px-5 pb-5">
        {visible.map((m) => (
          <div
            key={m.memberId}
            className="flex items-center justify-between rounded-xl border border-red-100 bg-white px-4 py-3"
          >
            <div>
              <p className="text-sm font-medium text-slate-900">{m.name}</p>
              <p className="text-xs text-slate-400">No reason given</p>
            </div>
            <button
              onClick={() => setTarget(m)}
              className="rounded-full bg-red-700 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-red-800"
            >
              Punish
            </button>
          </div>
        ))}
      </div>

      {target && (
        <PunishModal
          orgId={orgId}
          eventType={eventType}
          memberId={target.memberId}
          memberName={target.name}
          defaultReason="No reason given"
          onClose={() => setTarget(null)}
          onDone={() => {
            setDismissed((prev) => new Set(prev).add(target.memberId));
            setTarget(null);
          }}
        />
      )}
    </div>
  );
}
