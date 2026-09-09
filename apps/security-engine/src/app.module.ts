import { Module } from "@nestjs/common";
import { HealthController } from "./health.controller.js";
import { BusProvider } from "./bus.provider.js";
import { AssetCatalog } from "./asset-catalog.js";
import { SecurityEngineWorker } from "./worker.js";

@Module({
  controllers: [HealthController],
  providers: [BusProvider, AssetCatalog, SecurityEngineWorker],
})
export class AppModule {}
