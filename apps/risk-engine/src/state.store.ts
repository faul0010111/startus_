import { Injectable } from "@nestjs/common";
import { Redis } from "ioredis";
import { loadConfig } from "@stratus/config";

export interface AssetRiskState {
  assetId: string;
  score: number;
  findingIds: string[];
  historicalIncidents: number;
  updatedAt: string;
}

/**
 * Risk needs the neighbourhood of a finding, not just the finding. Redis keeps
 * the per-asset roll-up hot so scoring stays a streaming operation.
 */
@Injectable()
export class RiskStateStore {
  private readonly redis = new Redis(loadConfig("risk-engine", 4040).REDIS_URL, { lazyConnect: true });

  private key(assetId: string): string {
    return `stratus:risk:asset:${assetId}`;
  }

  async load(assetId: string): Promise<AssetRiskState> {
    const raw = await this.redis.get(this.key(assetId)).catch(() => null);
    return raw
      ? (JSON.parse(raw) as AssetRiskState)
      : { assetId, score: 0, findingIds: [], historicalIncidents: 0, updatedAt: new Date().toISOString() };
  }

  async recordFinding(assetId: string, findingId: string, score: number): Promise<AssetRiskState> {
    const state = await this.load(assetId);
    const findingIds = state.findingIds.includes(findingId) ? state.findingIds : [...state.findingIds, findingId];
    const next: AssetRiskState = {
      ...state,
      findingIds,
      score: Math.max(state.score, score),
      updatedAt: new Date().toISOString(),
    };
    await this.redis.set(this.key(assetId), JSON.stringify(next), "EX", 60 * 60 * 24 * 30);
    await this.redis.zadd("stratus:risk:leaderboard", next.score, assetId);
    return next;
  }

  /** Top assets by risk, used by the console's prioritized queue. */
  async topAssets(limit = 20): Promise<Array<{ assetId: string; score: number }>> {
    const rows = await this.redis.zrevrange("stratus:risk:leaderboard", 0, limit - 1, "WITHSCORES");
    const out: Array<{ assetId: string; score: number }> = [];
    for (let i = 0; i < rows.length; i += 2) {
      out.push({ assetId: rows[i] as string, score: Number(rows[i + 1]) });
    }
    return out;
  }
}
