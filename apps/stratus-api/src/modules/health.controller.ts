import { Controller, Get, Header } from "@nestjs/common";
import { metricsHandler } from "@stratus/observability";
import type { Database } from "../db/database.js";

@Controller()
export class HealthController {
  constructor(private readonly db: Database) {}

  @Get("/healthz")
  healthz() {
    return { status: "ok", service: "stratus-api" };
  }

  /** Readiness depends on the database: no data, no useful responses. */
  @Get("/readyz")
  async readyz() {
    await this.db.query("SELECT 1");
    return { status: "ready" };
  }

  @Get("/metrics")
  @Header("Content-Type", "text/plain")
  async metrics() {
    const { body } = await metricsHandler();
    return body;
  }
}
