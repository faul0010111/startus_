import { Module } from "@nestjs/common";
import { HealthController } from "./health.controller.js";
import { BusProvider } from "./bus.provider.js";
import { IncidentWorker } from "./worker.js";
import { IncidentRepository } from "./incident.repository.js";

@Module({
  controllers: [HealthController],
  providers: [BusProvider, IncidentWorker, IncidentRepository],
})
export class AppModule {}
