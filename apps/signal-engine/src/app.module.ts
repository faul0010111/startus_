import { Module } from "@nestjs/common";
import { SignalController } from "./signal.controller.js";
import { SignalService } from "./signal.service.js";
import { HealthController } from "./health.controller.js";
import { BusProvider } from "./bus.provider.js";

@Module({
  controllers: [SignalController, HealthController],
  providers: [SignalService, BusProvider],
})
export class AppModule {}
