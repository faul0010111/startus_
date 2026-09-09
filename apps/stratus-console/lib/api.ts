import type {
  Asset,
  AssetSummary,
  FindingSummary,
  Incident,
  IncidentSummary,
  RiskTrend,
  SecurityFinding,
  SecurityScore,
  TimeWindow,
} from "@stratus/shared-types";
import { demoOverview, demoIncidents, demoFindings, demoAssets } from "./demo-data";

export interface Overview {
  score: SecurityScore;
  assets: AssetSummary;
  findings: FindingSummary;
  incidents: IncidentSummary;
  trend: RiskTrend;
}

const BASE = process.env.NEXT_PUBLIC_STRATUS_API_URL ?? "http://localhost:4000";

/**
 * The console degrades to the bundled demo dataset when the API is unreachable,
 * so a fresh clone renders something meaningful before the stack is running.
 * Every fallback is flagged so nobody mistakes sample data for live data.
 */
async function get<T>(path: string, fallback: T): Promise<{ data: T; live: boolean }> {
  try {
    const response = await fetch(`${BASE}/v1${path}`, { cache: "no-store" });
    if (!response.ok) throw new Error(String(response.status));
    return { data: (await response.json()) as T, live: true };
  } catch {
    return { data: fallback, live: false };
  }
}

export const fetchOverview = (window: TimeWindow = "7d") =>
  get<Overview>(`/dashboard?window=${window}`, demoOverview(window));

export const fetchIncidents = (status?: string) =>
  get<Incident[]>(`/incidents${status ? `?status=${status}` : ""}`, demoIncidents());

export const fetchIncident = async (id: string) => {
  const { data, live } = await get<Incident[]>("/incidents", demoIncidents());
  const direct = await get<Incident | null>(`/incidents/${id}`, null);
  return { data: direct.data ?? data.find((i) => i.id === id) ?? null, live: direct.live || live };
};

export const fetchFindings = (severity?: string) =>
  get<SecurityFinding[]>(`/findings${severity ? `?severity=${severity}` : ""}`, demoFindings());

export const fetchAssets = () => get<Asset[]>("/assets?limit=50", demoAssets());

export const streamUrl = `${BASE}/v1/stream`;
