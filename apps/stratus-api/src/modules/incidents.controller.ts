import { Controller, Get, NotFoundException, Param, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { ReadModel } from "./read-model.service.js";

@ApiTags("incidents")
@Controller("incidents")
export class IncidentsController {
  constructor(private readonly read: ReadModel) {}

  @Get()
  list(@Query("status") status?: string) {
    return this.read.incidents(status);
  }

  @Get("summary")
  summary() {
    return this.read.incidentSummary();
  }

  @Get(":id")
  async detail(@Param("id") id: string) {
    const incident = await this.read.incident(id);
    if (!incident) throw new NotFoundException(`No incident with id ${id}`);
    return incident;
  }
}
