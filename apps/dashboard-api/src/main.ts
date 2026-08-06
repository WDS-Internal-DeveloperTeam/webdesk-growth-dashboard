import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { baseEnvSchema, loadEnv } from "@webdesk/configuration";
import { Logger } from "nestjs-pino";
import { AppModule } from "./app.module.js";
import { AllExceptionsFilter } from "./common/all-exceptions.filter.js";

/**
 * Bootstrapped inside a Vercel Function handler at Phase 1C+ (ADR-0003) —
 * this NestFactory.create()/listen() form is the local-dev/CI entry point.
 * No permanent process assumption: every request is treated as
 * independent, no in-memory state relied on across requests.
 */
async function bootstrap(): Promise<void> {
  const env = loadEnv(baseEnvSchema);
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.useLogger(app.get(Logger));
  app.useGlobalFilters(new AllExceptionsFilter());

  const swaggerConfig = new DocumentBuilder()
    .setTitle("WebDesk Growth Dashboard API")
    .setDescription(
      "Phase 1A foundation — health/readiness endpoints only. Business-module " +
        "endpoints are added as each module is separately authorized and implemented.",
    )
    .setVersion("0.1.0")
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("api-docs", app, document);

  const port = env.PORT ?? 3001;
  await app.listen(port);
}

bootstrap().catch((error: unknown) => {
  console.error("dashboard-api failed to start:", error);
  process.exitCode = 1;
});
