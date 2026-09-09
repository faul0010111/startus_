"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { Activity, Boxes, ShieldAlert, Siren } from "lucide-react";

const NAV = [
  { href: "/", label: "Command center", icon: Activity },
  { href: "/incidents", label: "Incidents", icon: Siren },
  { href: "/findings", label: "Findings", icon: ShieldAlert },
  { href: "/assets", label: "Assets", icon: Boxes },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen">
      <nav className="hidden w-56 shrink-0 border-r border-hairline bg-surface md:block">
        <div className="flex items-center gap-2 border-b border-hairline px-4 py-4">
          <span className="text-signal">⚡</span>
          <span className="font-mono text-sm tracking-[0.2em]">STRATUS</span>
        </div>
        <ul className="p-2">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={clsx(
                    "flex items-center gap-3 px-3 py-2 text-sm",
                    active ? "bg-raised text-ink" : "text-muted hover:text-ink",
                  )}
                >
                  <Icon size={15} strokeWidth={1.6} />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
        <p className="px-4 pt-6 text-xs leading-relaxed text-muted">
          Turning cloud signals into security intelligence.
        </p>
      </nav>
      <main className="flex-1 overflow-x-hidden">{children}</main>
    </div>
  );
}
