import "reflect-metadata";
import { startTracing } from "@stratus/observability";

startTracing("event-processor");

const { NestFactory } = await import("@nestjs/core");
const { AppModule } = await import("./app.module.js");
const { loadConfig } = await import("@stratus/config");

const config = loadConfig("event-processor", 4020);
const app = await NestFactory.create(AppModule, { bufferLogs: false });
app.enableShutdownHooks();
await app.listen(config.port, "0.0.0.0");
