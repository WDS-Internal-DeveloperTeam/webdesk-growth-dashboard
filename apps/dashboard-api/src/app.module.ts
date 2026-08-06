import { Module, type MiddlewareConsumer, type NestModule } from "@nestjs/common";
import { buildLoggerOptions, loadEnv, baseEnvSchema } from "@webdesk/configuration";
import { LoggerModule } from "nestjs-pino";
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
          paths: [...loggerOptions.redact.paths],
          censor: loggerOptions.redact.censor,
        },
      },
    }),
    HealthModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes("*");
  }
}
