import { Module } from "@nestjs/common";
import { HealthController } from "./health.controller.js";
import { BusProvider } from "./bus.provider.js";
import { ProcessorWorker } from "./worker.js";

@Module({
  controllers: [HealthController],
  providers: [BusProvider, ProcessorWorker],
})
export class AppModule {}
