import { Injectable } from "@nestjs/common";
import { Redis } from "ioredis";
import { loadConfig } from "@stratus/config";
import type { RuleContext } from "@stratus/security-rules";

type CachedAsset = RuleContext["asset"];

/**
 * Rules need asset context (criticality, exposure) that the raw signal does not
 * carry. Redis holds the last known state per resource id so evaluation stays a
 * single-digit-millisecond lookup instead of a database round trip per event.
 */
@Injectable()
export class AssetCatalog {
  private readonly redis = new Redis(loadConfig("security-engine", 4030).REDIS_URL, {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  });

  private static key(resourceId: string): string {
    return `stratus:asset:${resourceId}`;
  }

  async get(resourceId: string, fallbackEnvironment: string): Promise<CachedAsset> {
    const raw = await this.redis.get(AssetCatalog.key(resourceId)).catch(() => null);
    if (raw) return JSON.parse(raw) as CachedAsset;
    return {
      id: resourceId,
      name: resourceId.split("/").pop() ?? resourceId,
      kind: inferKind(resourceId),
      internetExposed: false,
      criticality: "tier-2",
      environment: fallbackEnvironment,
      tags: {},
    };
  }

  async put(asset: CachedAsset): Promise<void> {
    await this.redis.set(AssetCatalog.key(asset.id), JSON.stringify(asset), "EX", 60 * 60 * 24 * 7);
  }
}

/** Best-effort classification when the asset has not been discovered yet. */
export function inferKind(resourceId: string): string {
  if (resourceId.startsWith("k8s:")) return "kubernetes-workload";
  if (resourceId.includes(":s3:") || resourceId.includes("bucket")) return "cloud-storage";
  if (resourceId.includes(":rds:") || resourceId.includes("db-")) return "database";
  if (resourceId.includes(":security-group") || resourceId.includes("sg-")) return "security-group";
  if (resourceId.includes(":role/")) return "iam-role";
  if (resourceId.startsWith("image:")) return "container-image";
  if (resourceId.startsWith("pipeline:")) return "ci-pipeline";
  if (resourceId.startsWith("service:")) return "api-service";
  return "virtual-machine";
}
