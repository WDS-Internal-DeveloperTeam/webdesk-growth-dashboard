import { Module, type MiddlewareConsumer, type NestModule } from "@nestjs/common";
import { buildLoggerOptions, loadEnv, baseEnvSchema } from "@webdesk/configuration";
import { LoggerModule } from "nestjs-pino";
import { AuthModule } from "./auth/auth.module.js";
import { AuthzModule } from "./authz/authz.module.js";
import { CorrelationIdMiddleware } from "./common/correlation-id.middleware.js";
import { HealthModule } from "./health/health.module.js";

const env = loadEnv(baseEnvSchema);
const loggerOptions = buildLoggerOptions(env, "dashboard-api");

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        ...loggerOptions,
        redact: {
          // Session/OIDC cookies and auth request bodies must never reach
          // general logs in plaintext (docs/security/data-classification.md
          // "Handling rules") — extends Phase 1A's existing redaction list.
          paths: [
            ...loggerOptions.redact.paths,
            "req.headers.cookie",
            'res.headers["set-cookie"]',
            "req.body.password",
            "req.body.code",
          ],
          censor: loggerOptions.redact.censor,
        },
      },
    }),
    HealthModule,
    AuthModule,
    AuthzModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes("*");
  }
}
