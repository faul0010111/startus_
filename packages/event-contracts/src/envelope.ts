import { z } from "zod";

/**
 * Every message on the STRATUS bus is wrapped in this envelope. Consumers can
 * route, deduplicate and correlate without knowing the payload shape.
 */
export interface StratusEvent<T> {
  eventId: string;
  eventType: string;
  timestamp: string;
  source: string;
  organizationId: string;
  projectId: string;
  environment: string;
  correlationId: string;
  version: string;
  payload: T;
}

export const stratusEventSchema = <T extends z.ZodTypeAny>(payload: T) =>
  z.object({
    eventId: z.string().uuid(),
    eventType: z.string().min(3),
    timestamp: z.string().datetime(),
    source: z.string().min(1),
    organizationId: z.string().min(1),
    projectId: z.string().min(1),
    environment: z.enum(["production", "staging", "development", "sandbox"]),
    correlationId: z.string().min(1),
    version: z.string().regex(/^\d+\.\d+$/),
    payload,
  });

export const CONTRACT_VERSION = "1.0";

export interface EnvelopeOptions {
  eventType: string;
  source: string;
  organizationId: string;
  projectId: string;
  environment: string;
  correlationId?: string;
  timestamp?: string;
  version?: string;
}

export function createEvent<T>(payload: T, options: EnvelopeOptions): StratusEvent<T> {
  return {
    eventId: crypto.randomUUID(),
    eventType: options.eventType,
    timestamp: options.timestamp ?? new Date().toISOString(),
    source: options.source,
    organizationId: options.organizationId,
    projectId: options.projectId,
    environment: options.environment,
    correlationId: options.correlationId ?? crypto.randomUUID(),
    version: options.version ?? CONTRACT_VERSION,
    payload,
  };
}
