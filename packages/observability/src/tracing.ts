import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { ATTR_SERVICE_NAME, ATTR_SERVICE_NAMESPACE } from "@opentelemetry/semantic-conventions";

let sdk: NodeSDK | undefined;

/**
 * Call before any other import that opens a socket, otherwise the
 * auto-instrumentation cannot patch the client libraries.
 */
export function startTracing(serviceName: string): void {
  if (sdk) return;
  sdk = new NodeSDK({
    // OpenTelemetry JS 2.x dropped the `Resource` class in favour of the
    // `resourceFromAttributes` factory, and the SEMRESATTRS_* constants were
    // replaced by the ATTR_* ones.
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: serviceName,
      [ATTR_SERVICE_NAMESPACE]: process.env.OTEL_SERVICE_NAMESPACE ?? "stratus",
    }),
    traceExporter: new OTLPTraceExporter({
      url: `${process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? "http://localhost:4318"}/v1/traces`,
    }),
    instrumentations: [getNodeAutoInstrumentations({ "@opentelemetry/instrumentation-fs": { enabled: false } })],
  });
  sdk.start();
  process.once("SIGTERM", () => void sdk?.shutdown());
}
