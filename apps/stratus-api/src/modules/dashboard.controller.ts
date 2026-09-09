import { Controller, Get, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { TimeWindow } from "@stratus/shared-types";
import type { ReadModel } from "./read-model.service.js";

@ApiTags("dashboard")
@Controller("dashboard")
export class DashboardController {
  constructor(private readonly read: ReadModel) {}

  /** Everything the Command Center renders above the fold, in one round trip. */
  @Get()
  async overview(@Query("window") window: TimeWindow = "7d") {
    const [score, assets, findings, incidents, trend] = await Promise.all([
      this.read.securityScore(),
      this.read.assetSummary(),
      this.read.findingSummary(),
      this.read.incidentSummary(),
      this.read.riskTrend(window),
    ]);
    return { score, assets, findings, incidents, trend };
  }

  @Get("risk-trend")
  riskTrend(@Query("window") window: TimeWindow = "7d") {
    return this.read.riskTrend(window);
  }
}
