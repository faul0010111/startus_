import type { TimeWindow, Trend } from "./common.js";

export type RiskBand = "low" | "moderate" | "elevated" | "high" | "severe";

export interface RiskFactor {
  name: string;
  contribution: number;
  detail: string;
}

/** Explainable output of the risk engine: the score plus why it is what it is. */
export interface RiskAssessment {
  subjectId: string;
  subjectType: "asset" | "finding" | "incident" | "organization";
  score: number;
  band: RiskBand;
  factors: RiskFactor[];
  computedAt: string;
}

export interface RiskTrendPoint {
  bucket: string;
  score: number;
  findings: number;
  incidents: number;
}

export interface RiskTrend {
  window: TimeWindow;
  direction: Trend;
  changePercent: number;
  points: RiskTrendPoint[];
}

export interface SecurityScore {
  score: number;
  band: RiskBand;
  changePercent: number;
  direction: Trend;
  computedAt: string;
}
