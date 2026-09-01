import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module.js";
import { AuthModule } from "../auth/auth.module.js";
import { AuthzModule } from "../authz/authz.module.js";
import { workflowTaskTemplateRepositoryProviders } from "./database.providers.js";
import { WorkflowAndTaskTemplateLibraryService } from "./workflow-and-task-template-library.service.js";
import { WorkflowAndTaskTemplateLibraryController } from "./workflow-and-task-template-library.controller.js";

/**
 * The Workflow and Task Template Library module — module #`workflow_and_task_template_library`
 * on the canonical module registry, a real business-module backend on the Phase 1F application
 * shell. Imports `AuthModule` for `SessionGuard`/`OriginCheckGuard`, `AuthzModule` for
 * `PermissionGuard`/`AuthorizationService` (the dynamic per-transition permission check in
 * `WorkflowAndTaskTemplateLibraryService.changeApprovalStatus()`), and `AuditModule` for
 * `AuditService` (create/update/status-transition are all audited). No other module import — no
 * cross-module relationship fields exist on this module's schema. No
 * `AuthorizationService.canViewConfidential()` usage — no confidential-field mechanism exists here
 * (the module registry's own seeded `confidentialityLevel` for
 * `workflow_and_task_template_library` is `null`). No publish/unpublish mechanism — the seeded
 * `ready_for_claude` RBAC group has no `P` grant.
 */
@Module({
  imports: [AuthModule, AuthzModule, AuditModule],
  controllers: [WorkflowAndTaskTemplateLibraryController],
  providers: [...workflowTaskTemplateRepositoryProviders, WorkflowAndTaskTemplateLibraryService],
  exports: [WorkflowAndTaskTemplateLibraryService],
})
export class WorkflowAndTaskTemplateLibraryModule {}
