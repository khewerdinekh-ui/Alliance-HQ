"use client";

export type AttendanceEntry = {
  eventType: "foundry" | "canyon" | "bear";
  eventDate: string;
  status: "attended" | "excused" | "no_show";
};

const TYPE_LABELS: Record<AttendanceEntry["eventType"], string> = {
  foundry: "Foundry",
  canyon: "Canyon",
  bear: "Bear",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function AttendanceDetailModal({
  title,
  subtitle,
  entries,
  onClose,
}: {
  title: string;
  subtitle: string;
  entries: AttendanceEntry[];
  onClose: () => void;
}) {
  const sorted = [...entries].sort((a, b) => (a.eventDate < b.eventDate ? 1 : -1));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 py-8">
      <div className="w-full max-w-md max-h-[85vh] overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">{title}</h2>
            <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md border border-slate-200 p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto divide-y divide-slate-100 px-5 py-2">
          {sorted.map((e, i) => (
            <div key={i} className="flex items-center justify-between gap-2 py-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">{TYPE_LABELS[e.eventType]}</p>
                <p className="text-xs text-slate-400">{formatDate(e.eventDate)}</p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
                  e.status === "attended"
                    ? "bg-emerald-50 text-emerald-700"
                    : e.status === "excused"
                      ? "bg-amber-50 text-amber-700"
                      : "bg-red-50 text-red-700"
                }`}
              >
                {e.status === "attended"
                  ? "Arrived"
                  : e.status === "excused"
                    ? "Excused"
                    : "Did not arrive"}
              </span>
            </div>
          ))}
          {sorted.length === 0 && (
            <p className="py-8 text-center text-sm text-slate-400">No events to show.</p>
          )}
        </div>
      </div>
    </div>
  );
}
