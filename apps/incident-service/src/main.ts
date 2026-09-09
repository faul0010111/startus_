import "reflect-metadata";
import { startTracing } from "@stratus/observability";

startTracing("incident-service");

const { NestFactory } = await import("@nestjs/core");
const { AppModule } = await import("./app.module.js");
const { loadConfig } = await import("@stratus/config");

const config = loadConfig("incident-service", 4050);
const app = await NestFactory.create(AppModule, { bufferLogs: false });
app.enableShutdownHooks();
await app.listen(config.port, "0.0.0.0");
