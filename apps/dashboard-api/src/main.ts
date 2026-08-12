import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { baseEnvSchema, loadEnv } from "@webdesk/configuration";
import cookieParser from "cookie-parser";
import { Logger } from "nestjs-pino";
import { AppModule } from "./app.module.js";
import { loadAuthEnv } from "./auth/config/auth-env.js";
import { AllExceptionsFilter } from "./common/all-exceptions.filter.js";

/**
 * Bootstrapped inside a Vercel Function handler at Phase 1C+ (ADR-0003) —
 * this NestFactory.create()/listen() form is the local-dev/CI entry point.
 * No permanent process assumption: every request is treated as
 * independent, no in-memory state relied on across requests.
 */
async function bootstrap(): Promise<void> {
  const env = loadEnv(baseEnvSchema);
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });

  // See api/index.ts's matching call for why this matters — harmless here
  // (no proxy in local dev) but keeps both entrypoints consistent in case
  // this ever runs behind a reverse proxy outside Vercel.
  app.set("trust proxy", true);
  app.useLogger(app.get(Logger));
  app.useGlobalFilters(new AllExceptionsFilter());
  // Required for every Phase 1C auth route: session/OIDC-transaction
  // cookies are read via `req.cookies`, which Express does not populate
  // without this middleware.
  app.use(cookieParser());
  // `dashboard-web` calls this API cross-origin with cookies
  // (docs/contracts/google-workspace-auth-contract.md's "Trust boundary").
  // Restricted to exactly the configured frontend origin, never a
  // wildcard, since credentials are involved.
  const authEnv = loadAuthEnv();
  app.enableCors({ origin: authEnv.WEB_APP_ORIGIN, credentials: true });

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
