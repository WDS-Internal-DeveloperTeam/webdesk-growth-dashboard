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
import { BrandLibraryModule } from "./brand-library/brand-library.module.js";
import { AssetLibraryModule } from "./asset-library/asset-library.module.js";
import { BusinessKnowledgeModule } from "./business-knowledge/business-knowledge.module.js";
import { CaseStudyLibraryModule } from "./case-study-library/case-study-library.module.js";
import { CaseStudyStudioModule } from "./case-study-studio/case-study-studio.module.js";
import { ChangeCenterModule } from "./change-center/change-center.module.js";
import { ComponentLibraryModule } from "./component-library/component-library.module.js";
import { ContentTemplateLibraryModule } from "./content-template-library/content-template-library.module.js";
import { CorrelationIdMiddleware } from "./common/correlation-id.middleware.js";
import { DesignReferenceLibraryModule } from "./design-reference-library/design-reference-library.module.js";
import { DesignReviewCenterModule } from "./design-review-center/design-review-center.module.js";
import { DesignTokenLibraryModule } from "./design-token-library/design-token-library.module.js";
import { HealthModule } from "./health/health.module.js";
import { ImportAndExportCenterModule } from "./import-and-export-center/import-and-export-center.module.js";
import { InternalLinkingLibraryModule } from "./internal-linking-library/internal-linking-library.module.js";
import { JobsModule } from "./jobs/jobs.module.js";
import { KeywordAndEntityLibraryModule } from "./keyword-and-entity-library/keyword-and-entity-library.module.js";
import { KnowledgeLibraryModule } from "./knowledge-library/knowledge-library.module.js";
import { MotionAndInteractionLibraryModule } from "./motion-and-interaction-library/motion-and-interaction-library.module.js";
import { NotificationsModule } from "./notifications/notifications.module.js";
import { OperationalContactsModule } from "./operational-contacts/operational-contacts.module.js";
import { PageInventoryModule } from "./page-inventory/page-inventory.module.js";
import { PageTemplateLibraryModule } from "./page-template-library/page-template-library.module.js";
import { PageWorkspaceModule } from "./page-workspace/page-workspace.module.js";
import { PersonaLibraryModule } from "./persona-library/persona-library.module.js";
import { PortfolioLibraryModule } from "./portfolio-library/portfolio-library.module.js";
import { ProjectsModule } from "./projects/projects.module.js";
import { ProofAndClaimsLibraryModule } from "./proof-and-claims-library/proof-and-claims-library.module.js";
import { ReadyForClaudeQueueModule } from "./ready-for-claude-queue/ready-for-claude-queue.module.js";
import { RetentionModule } from "./retention/retention.module.js";
import { ReviewAndApprovalCenterModule } from "./review-and-approval-center/review-and-approval-center.module.js";
import { ScanCenterModule } from "./scan-center/scan-center.module.js";
import { TechnicalCenterModule } from "./technical-center/technical-center.module.js";
import { SectionAndPatternLibraryModule } from "./section-and-pattern-library/section-and-pattern-library.module.js";
import { WireframeLibraryModule } from "./wireframe-library/wireframe-library.module.js";
import { ServiceLibraryModule } from "./service-library/service-library.module.js";
import { SystemOperationsModule } from "./system-operations/system-operations.module.js";
import { UsersModule } from "./users/users.module.js";
import { WebsiteStrategyCenterModule } from "./website-strategy-center/website-strategy-center.module.js";
import { WorkflowAndTaskTemplateLibraryModule } from "./workflow-and-task-template-library/workflow-and-task-template-library.module.js";
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
    BrandLibraryModule,
    AssetLibraryModule,
    BusinessKnowledgeModule,
    CaseStudyLibraryModule,
    CaseStudyStudioModule,
    ChangeCenterModule,
    ComponentLibraryModule,
    ContentTemplateLibraryModule,
    DesignReferenceLibraryModule,
    DesignReviewCenterModule,
    DesignTokenLibraryModule,
    ImportAndExportCenterModule,
    InternalLinkingLibraryModule,
    JobsModule,
    KeywordAndEntityLibraryModule,
    KnowledgeLibraryModule,
    MotionAndInteractionLibraryModule,
    NotificationsModule,
    OperationalContactsModule,
    PageInventoryModule,
    PageTemplateLibraryModule,
    PageWorkspaceModule,
    PersonaLibraryModule,
    PortfolioLibraryModule,
    ProjectsModule,
    ProofAndClaimsLibraryModule,
    ReadyForClaudeQueueModule,
    RetentionModule,
    ReviewAndApprovalCenterModule,
    ScanCenterModule,
    TechnicalCenterModule,
    SectionAndPatternLibraryModule,
    WireframeLibraryModule,
    ServiceLibraryModule,
    SystemOperationsModule,
    UsersModule,
    WebsiteStrategyCenterModule,
    WorkflowAndTaskTemplateLibraryModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes("*");
  }
}
