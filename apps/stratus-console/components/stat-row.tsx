import clsx from "clsx";
import { number } from "@/lib/format";

export interface Stat {
  label: string;
  value: number;
  tone?: "default" | "healthy" | "warn" | "danger";
}

/** Dense counter strip. One border, no per-card shadows. */
export function StatRow({ title, stats }: { title: string; stats: Stat[] }) {
  return (
    <section className="panel">
      <h2 className="border-b border-hairline px-4 py-2 font-mono text-xs tracking-[0.18em] text-muted">{title}</h2>
      <dl className="grid grid-cols-2 divide-hairline sm:grid-cols-4 sm:divide-x">
        {stats.map((stat) => (
          <div key={stat.label} className="px-4 py-4">
            <dd
              className={clsx(
                "font-mono text-2xl",
                stat.tone === "danger" && "text-danger",
                stat.tone === "warn" && "text-warn",
                stat.tone === "healthy" && "text-healthy",
              )}
            >
              {number(stat.value)}
            </dd>
            <dt className="mt-1 text-xs text-muted">{stat.label}</dt>
          </div>
        ))}
      </dl>
    </section>
  );
}
