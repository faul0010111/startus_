import { pino, type Logger } from "pino";
import { trace } from "@opentelemetry/api";

/**
 * Structured logs carry the active trace/span ids so a log line found in Loki
 * or stdout can be pivoted straight into the matching trace in Grafana.
 */
export function createLogger(serviceName: string, level = process.env.LOG_LEVEL ?? "info"): Logger {
  return pino({
    level,
    base: { service: serviceName },
    formatters: { level: (label) => ({ level: label }) },
    mixin() {
      const span = trace.getActiveSpan();
      if (!span) return {};
      const ctx = span.spanContext();
      return { traceId: ctx.traceId, spanId: ctx.spanId };
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  });
}
