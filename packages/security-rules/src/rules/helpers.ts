import type { RuleContext } from "../types.js";

export const cfg = <T>(ctx: RuleContext, key: string): T | undefined =>
  ctx.configuration[key] as T | undefined;

export const isKind = (ctx: RuleContext, ...kinds: string[]): boolean =>
  kinds.includes(ctx.asset.kind);

export const isProduction = (ctx: RuleContext): boolean => ctx.asset.environment === "production";
