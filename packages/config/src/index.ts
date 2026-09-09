import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  KAFKA_BROKERS: z.string().default("localhost:19092"),
  KAFKA_CLIENT_ID: z.string().default("stratus"),
  POSTGRES_URL: z.string().default("postgres://stratus:stratus@localhost:5432/stratus"),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().default("http://localhost:4318"),
  OTEL_SERVICE_NAMESPACE: z.string().default("stratus"),
  STRATUS_ORG_ID: z.string().default("org_demo"),
  STRATUS_PROJECT_ID: z.string().default("proj_demo"),
});

export type StratusConfig = z.infer<typeof schema> & {
  serviceName: string;
  port: number;
  brokers: string[];
  isProduction: boolean;
};

/**
 * Fails fast at boot instead of at the first request: a service with a broken
 * environment should never report itself healthy.
 */
export function loadConfig(serviceName: string, defaultPort: number): StratusConfig {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const detail = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment for ${serviceName}\n${detail}`);
  }
  const env = parsed.data;
  const portVar = `${serviceName.toUpperCase().replace(/-/g, "_")}_PORT`;
  return {
    ...env,
    serviceName,
    port: Number(process.env[portVar] ?? defaultPort),
    brokers: env.KAFKA_BROKERS.split(",").map((b) => b.trim()).filter(Boolean),
    isProduction: env.NODE_ENV === "production",
  };
}
