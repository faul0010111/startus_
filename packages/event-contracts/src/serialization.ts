import type { z } from "zod";
import { stratusEventSchema, type StratusEvent } from "./envelope.js";

export class ContractViolationError extends Error {
  constructor(
    readonly topic: string,
    readonly issues: z.ZodIssue[],
  ) {
    super(`Event rejected on ${topic}: ${issues.map((i) => i.path.join(".") + " " + i.message).join("; ")}`);
    this.name = "ContractViolationError";
  }
}

export function encode<T>(event: StratusEvent<T>): Buffer {
  return Buffer.from(JSON.stringify(event), "utf8");
}

/**
 * Validates on the way in rather than trusting producers. Invalid messages are
 * surfaced as ContractViolationError so consumers can route them to a DLQ
 * instead of poisoning the partition.
 */
export function decode<S extends z.ZodTypeAny>(
  topic: string,
  raw: Buffer | string | null,
  payloadSchema: S,
): StratusEvent<z.infer<S>> {
  if (!raw) throw new ContractViolationError(topic, []);
  const parsed = stratusEventSchema(payloadSchema).safeParse(
    JSON.parse(typeof raw === "string" ? raw : raw.toString("utf8")),
  );
  if (!parsed.success) throw new ContractViolationError(topic, parsed.error.issues);
  return parsed.data as StratusEvent<z.infer<S>>;
}

/** Partition key: keeps every event about one resource on the same partition. */
export const partitionKey = (resourceId: string): string => resourceId;
