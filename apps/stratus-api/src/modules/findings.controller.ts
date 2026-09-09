import { Controller, Get, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { ReadModel } from "./read-model.service.js";

@ApiTags("findings")
@Controller("findings")
export class FindingsController {
  constructor(private readonly read: ReadModel) {}

  @Get()
  list(@Query("severity") severity?: string, @Query("status") status?: string, @Query("limit") limit = "100") {
    return this.read.findings({ severity, status, limit: Number(limit) });
  }

  @Get("summary")
  summary() {
    return this.read.findingSummary();
  }
}
