import { Module, type MiddlewareConsumer, type NestModule } from "@nestjs/common";
import {
  buildLoggerOptions,
  getBuildMetadata,
  loadEnv,
  baseEnvSchema,
} from "@webdesk/configuration";
import { LoggerModule } from "nestjs-pino";
import { AuthModule } from "./auth/auth.module.js";
import { AuthzModule } from "./authz/authz.module.js";
import { BusinessKnowledgeModule } from "./business-knowledge/business-knowledge.module.js";
import { CorrelationIdMiddleware } from "./common/correlation-id.middleware.js";
import { HealthModule } from "./health/health.module.js";
import { InternalLinkingLibraryModule } from "./internal-linking-library/internal-linking-library.module.js";
import { JobsModule } from "./jobs/jobs.module.js";
import { KeywordAndEntityLibraryModule } from "./keyword-and-entity-library/keyword-and-entity-library.module.js";
import { NotificationsModule } from "./notifications/notifications.module.js";
import { OperationalContactsModule } from "./operational-contacts/operational-contacts.module.js";
import { PageInventoryModule } from "./page-inventory/page-inventory.module.js";
import { PersonaLibraryModule } from "./persona-library/persona-library.module.js";
import { ProjectsModule } from "./projects/projects.module.js";
import { ProofAndClaimsLibraryModule } from "./proof-and-claims-library/proof-and-claims-library.module.js";
import { RetentionModule } from "./retention/retention.module.js";
import { ServiceLibraryModule } from "./service-library/service-library.module.js";
import { SystemOperationsModule } from "./system-operations/system-operations.module.js";
import { UsersModule } from "./users/users.module.js";
import { WebsiteStrategyCenterModule } from "./website-strategy-center/website-strategy-center.module.js";
import { API_VERSION } from "./version.js";

const env = loadEnv(baseEnvSchema);
const loggerOptions = buildLoggerOptions(env, "dashboard-api");
const buildMetadata = getBuildMetadata(API_VERSION);

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        ...loggerOptions,
        base: {
          ...loggerOptions.base,
          environment: buildMetadata.environment,
          version: buildMetadata.version,
          commitSha: buildMetadata.commitShaShort,
        },
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
    BusinessKnowledgeModule,
    InternalLinkingLibraryModule,
    JobsModule,
    KeywordAndEntityLibraryModule,
    NotificationsModule,
    OperationalContactsModule,
    PageInventoryModule,
    PersonaLibraryModule,
    ProjectsModule,
    ProofAndClaimsLibraryModule,
    RetentionModule,
    ServiceLibraryModule,
    SystemOperationsModule,
    UsersModule,
    WebsiteStrategyCenterModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes("*");
  }
}
