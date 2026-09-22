import { requireMembership } from "@/lib/membership";
import TopNav from "@/components/TopNav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const membership = await requireMembership();

  return (
    <div className="min-h-screen bg-slate-50">
      <TopNav membership={membership} />
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}
