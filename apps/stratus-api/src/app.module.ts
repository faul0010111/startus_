import { Module } from "@nestjs/common";
import { DashboardController } from "./modules/dashboard.controller.js";
import { AssetsController } from "./modules/assets.controller.js";
import { FindingsController } from "./modules/findings.controller.js";
import { IncidentsController } from "./modules/incidents.controller.js";
import { StreamController } from "./modules/stream.controller.js";
import { HealthController } from "./modules/health.controller.js";
import { Database } from "./db/database.js";
import { ReadModel } from "./modules/read-model.service.js";
import { LiveStream } from "./modules/live-stream.service.js";

@Module({
  controllers: [
    DashboardController,
    AssetsController,
    FindingsController,
    IncidentsController,
    StreamController,
    HealthController,
  ],
  providers: [Database, ReadModel, LiveStream],
})
export class AppModule {}
