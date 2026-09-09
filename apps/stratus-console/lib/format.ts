import type { Severity } from "@stratus/shared-types";

export const SEVERITY_COLOR: Record<string, string> = {
  critical: "var(--danger)",
  high: "#ff8a4c",
  medium: "var(--warn)",
  low: "var(--signal)",
  info: "var(--muted)",
};

export const severityClass = (severity: Severity | string): string =>
  ({
    critical: "text-danger",
    high: "text-[#ff8a4c]",
    medium: "text-warn",
    low: "text-signal",
    info: "text-muted",
  })[severity] ?? "text-muted";

export const bandLabel = (band: string): string =>
  ({ severe: "Severe risk", high: "High risk", elevated: "Elevated risk", moderate: "Moderate risk", low: "Low risk" })[
    band
  ] ?? band;

export const number = (n: number): string => new Intl.NumberFormat("en-US").format(n);

export const pad = (n: number): string => String(n).padStart(2, "0");

export function relativeTime(iso: string): string {
  const diff = Date.now() - Date.parse(iso);
  const minutes = Math.round(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export const clockTime = (iso: string): string =>
  new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
