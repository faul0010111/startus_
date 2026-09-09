import "reflect-metadata";
import { startTracing } from "@stratus/observability";

startTracing("stratus-api");

const { NestFactory } = await import("@nestjs/core");
const { SwaggerModule, DocumentBuilder } = await import("@nestjs/swagger");
const { AppModule } = await import("./app.module.js");
const { loadConfig } = await import("@stratus/config");

const config = loadConfig("stratus-api", 4000);
const app = await NestFactory.create(AppModule);
app.enableCors({ origin: true });
app.setGlobalPrefix("v1", { exclude: ["healthz", "readyz", "metrics"] });

const document = SwaggerModule.createDocument(
  app,
  new DocumentBuilder()
    .setTitle("STRATUS API")
    .setDescription("Read model and live stream for the STRATUS Console")
    .setVersion("1.0")
    .build(),
);
SwaggerModule.setup("docs", app, document);

app.enableShutdownHooks();
await app.listen(config.port, "0.0.0.0");
