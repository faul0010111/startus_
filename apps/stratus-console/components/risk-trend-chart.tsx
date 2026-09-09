"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { RiskTrend, TimeWindow } from "@stratus/shared-types";

const WINDOWS: TimeWindow[] = ["24h", "7d", "30d", "90d"];

export function RiskTrendChart({
  trend,
  window,
  onWindowChange,
}: {
  trend: RiskTrend;
  window: TimeWindow;
  onWindowChange: (w: TimeWindow) => void;
}) {
  const data = trend.points.map((p) => ({
    label: new Date(p.bucket).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
    score: p.score,
  }));

  return (
    <section className="panel">
      <header className="flex items-center justify-between border-b border-hairline px-4 py-2">
        <h2 className="font-mono text-xs tracking-[0.18em] text-muted">RISK TREND</h2>
        <div className="flex gap-1">
          {WINDOWS.map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => onWindowChange(w)}
              className={`px-2 py-0.5 font-mono text-xs ${w === window ? "bg-raised text-ink" : "text-muted hover:text-ink"}`}
            >
              {w}
            </button>
          ))}
        </div>
      </header>
      <div className="h-52 p-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -18 }}>
            <defs>
              <linearGradient id="riskFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--danger)" stopOpacity={0.35} />
                <stop offset="100%" stopColor="var(--danger)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--hairline)" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: "var(--muted)", fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={24} />
            <YAxis domain={[0, 100]} tick={{ fill: "var(--muted)", fontSize: 11 }} tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={{ background: "var(--raised)", border: "1px solid var(--hairline)", borderRadius: 2 }}
              labelStyle={{ color: "var(--muted)" }}
              itemStyle={{ color: "var(--ink)" }}
            />
            <Area type="monotone" dataKey="score" stroke="var(--danger)" strokeWidth={1.5} fill="url(#riskFill)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <p className="border-t border-hairline px-4 py-2 text-xs text-muted">
        Posture is {trend.direction} — {trend.changePercent > 0 ? "+" : ""}
        {trend.changePercent}% over {window}
      </p>
    </section>
  );
}
