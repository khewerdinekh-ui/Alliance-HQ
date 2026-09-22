"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/(app)/actions";
import type { Membership } from "@/lib/membership";

const LINKS = [
  { href: "/members", label: "Members" },
  { href: "/percentages", label: "Percentages" },
  { href: "/foundry", label: "Foundry" },
  { href: "/canyon", label: "Canyon" },
  { href: "/bear", label: "Bear" },
  { href: "/import", label: "Import" },
  { href: "/admin", label: "Admin" },
];

export default function TopNav({ membership }: { membership: Membership }) {
  const pathname = usePathname();

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto max-w-5xl px-4 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">
              {membership.orgName}
              {membership.orgState ? ` · STATE ${membership.orgState}` : ""}
            </h1>
            <p className="text-xs text-slate-500">Command Centre</p>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-slate-600">
              {membership.displayName} — {membership.allianceRank}
            </span>
            <form action={signOut}>
              <button className="rounded-lg border border-slate-300 px-3 py-1.5 text-slate-600 transition hover:bg-slate-100">
                Sign out
              </button>
            </form>
          </div>
        </div>

        <nav className="mt-4 flex flex-wrap gap-1 text-sm">
          {LINKS.filter((l) => l.href !== "/admin" || membership.isAdmin).map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-full px-3 py-1.5 font-medium transition ${
                  active
                    ? "bg-teal-600 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
