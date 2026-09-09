import { Controller, Get, Header } from "@nestjs/common";
import { metricsHandler } from "@stratus/observability";

@Controller()
export class HealthController {
  /** Liveness: the process is up. Kubernetes restarts the pod when this fails. */
  @Get("/healthz")
  healthz() {
    return { status: "ok", service: "security-engine", uptimeSeconds: Math.round(process.uptime()) };
  }

  /** Readiness: the process can accept traffic. */
  @Get("/readyz")
  readyz() {
    return { status: "ready" };
  }

  @Get("/metrics")
  @Header("Cache-Control", "no-store")
  async metrics() {
    const { body } = await metricsHandler();
    return body;
  }
}
