import { Controller, Get, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { ReadModel } from "./read-model.service.js";

@ApiTags("assets")
@Controller("assets")
export class AssetsController {
  constructor(private readonly read: ReadModel) {}

  @Get()
  list(@Query("limit") limit = "50", @Query("offset") offset = "0") {
    return this.read.assets(Number(limit), Number(offset));
  }

  @Get("summary")
  summary() {
    return this.read.assetSummary();
  }
}
