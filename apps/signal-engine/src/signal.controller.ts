import { BadRequestException, Body, Controller, HttpCode, Param, Post } from "@nestjs/common";
import type { SignalService } from "./signal.service.js";
import { SUPPORTED_SOURCES, type CollectorSource } from "./normalizers/index.js";

@Controller("/v1/signals")
export class SignalController {
  constructor(private readonly signals: SignalService) {}

  /**
   * Collector webhook. The raw provider payload is accepted as-is and
   * normalized here, so adding a source never changes downstream services.
   */
  @Post("/:source")
  @HttpCode(202)
  async ingest(@Param("source") source: string, @Body() body: unknown) {
    if (!SUPPORTED_SOURCES.includes(source as CollectorSource)) {
      throw new BadRequestException(`Unknown collector source: ${source}`);
    }
    const accepted = await this.signals.ingest(source as CollectorSource, body);
    return { accepted: accepted.length, signalIds: accepted };
  }

  @Post("/:source/batch")
  @HttpCode(202)
  async ingestBatch(@Param("source") source: string, @Body() body: unknown[]) {
    if (!Array.isArray(body)) throw new BadRequestException("Batch endpoint expects an array");
    const ids: string[] = [];
    for (const item of body) ids.push(...(await this.signals.ingest(source as CollectorSource, item)));
    return { accepted: ids.length, signalIds: ids };
  }
}
