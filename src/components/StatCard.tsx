const ACCENTS = {
  teal: "from-teal-500 to-emerald-500",
  slate: "from-slate-500 to-slate-700",
  amber: "from-amber-400 to-orange-500",
  violet: "from-violet-500 to-purple-600",
} as const;

export default function StatCard({
  label,
  value,
  accent = "teal",
}: {
  label: string;
  value: number;
  accent?: keyof typeof ACCENTS;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${ACCENTS[accent]}`} />
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
    </div>
  );
}
