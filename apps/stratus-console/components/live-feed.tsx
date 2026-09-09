"use client";

import { useEffect, useState } from "react";
import { streamUrl } from "@/lib/api";
import { clockTime, severityClass } from "@/lib/format";

interface LiveEvent {
  kind: "finding" | "incident" | "risk";
  at: string;
  summary: string;
  severity?: string;
}

/** Tail of the bus. Trimmed to 40 rows so an idle tab cannot grow without bound. */
export function LiveFeed() {
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const source = new EventSource(streamUrl);
    source.onopen = () => setConnected(true);
    source.onerror = () => setConnected(false);
    source.onmessage = (message) => {
      const event = JSON.parse(message.data) as LiveEvent;
      setEvents((current) => [event, ...current].slice(0, 40));
    };
    return () => source.close();
  }, []);

  return (
    <section className="panel flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-hairline px-4 py-2">
        <h2 className="font-mono text-xs tracking-[0.18em] text-muted">SIGNAL FEED</h2>
        <span className={`font-mono text-xs ${connected ? "text-healthy" : "text-muted"}`}>
          {connected ? "connected" : "waiting for stream"}
        </span>
      </header>
      {events.length === 0 ? (
        <p className="p-4 text-sm text-muted">
          No signals yet. Start the stack and run <code className="font-mono text-ink">pnpm simulate</code> to generate traffic.
        </p>
      ) : (
        <ul className="divide-y divide-hairline overflow-y-auto">
          {events.map((event, i) => (
            <li key={`${event.at}-${i}`} className="flex gap-3 px-4 py-2 text-sm">
              <span className="font-mono text-xs text-muted">{clockTime(event.at)}</span>
              <span className={severityClass(event.severity ?? "info")}>{event.kind}</span>
              <span className="min-w-0 flex-1 truncate text-ink">{event.summary}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
