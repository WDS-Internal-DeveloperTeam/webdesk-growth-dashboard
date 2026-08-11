import "reflect-metadata";
import type { IncomingMessage, ServerResponse } from "node:http";
import { NestFactory } from "@nestjs/core";
import { ExpressAdapter } from "@nestjs/platform-express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { baseEnvSchema, loadEnv } from "@webdesk/configuration";
import cookieParser from "cookie-parser";
import express from "express";
import { Logger } from "nestjs-pino";
import { AppModule } from "../src/app.module.js";
import { loadAuthEnv } from "../src/auth/config/auth-env.js";
import { AllExceptionsFilter } from "../src/common/all-exceptions.filter.js";

/**
 * Vercel Function entrypoint (ADR-0003) — the Nest app is bootstrapped once
 * per warm execution context and reused across invocations
 * (knowledge/03-nestjs-on-vercel.md's cold-start mitigation #1), never
 * re-created per request. `main.ts` remains the local-dev/CI entry point
 * (`nest start` / `app.listen()`); this file never listens on a port —
 * Vercel owns the HTTP server.
 */
const expressApp = express();
let bootstrapped: Promise<void> | undefined;

async function bootstrap(): Promise<void> {
  loadEnv(baseEnvSchema);
  const app = await NestFactory.create(AppModule, new ExpressAdapter(expressApp), {
    bufferLogs: true,
  });

  app.useLogger(app.get(Logger));
  app.useGlobalFilters(new AllExceptionsFilter());
  app.use(cookieParser());
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

  await app.init();
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  bootstrapped ??= bootstrap();
  await bootstrapped;
  expressApp(req, res);
}
