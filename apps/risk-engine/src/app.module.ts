import { Module } from "@nestjs/common";
import { HealthController } from "./health.controller.js";
import { BusProvider } from "./bus.provider.js";
import { RiskWorker } from "./worker.js";
import { RiskStateStore } from "./state.store.js";

@Module({
  controllers: [HealthController],
  providers: [BusProvider, RiskWorker, RiskStateStore],
})
export class AppModule {}
