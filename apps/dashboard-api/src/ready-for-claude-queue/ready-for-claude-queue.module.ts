import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module.js";
import { AuthModule } from "../auth/auth.module.js";
import { AuthzModule } from "../authz/authz.module.js";
import { ProjectsModule } from "../projects/projects.module.js";
import { UsersModule } from "../users/users.module.js";
import { readyForClaudeQueueRepositoryProviders } from "./database.providers.js";
import { ReadyForClaudeTasksService } from "./ready-for-claude-tasks.service.js";
import { ReadyForClaudeTasksController } from "./ready-for-claude-tasks.controller.js";

/**
 * The Ready for Claude Queue module (module #30,
 * `docs/implementation/module-ready-for-claude-queue.md`) — the operational work queue that hands
 * a defined unit of work to Claude Code for MANUAL execution
 * (`canonical-inputs/Recommended_Module_Roadmap.md` row 30's own "**Critical rule: V1 is manual
 * Claude Code execution.** No Anthropic API automation"). Nothing in this module calls any
 * Anthropic API, schedules a job, or dispatches work automatically — it records and governs the
 * state of work a human drives.
 *
 * Organization-wide (D5), not project-scoped — a task's `projectId` is an OPTIONAL context field,
 * so unlike Page Inventory/Keyword & Entity Library/Internal Linking Library there is no
 * `:projectId` route segment and no project-scoped RBAC. Matches Review and Approval Center's own
 * precedent for a cross-cutting engine.
 *
 * Imports:
 * - `AuthModule` for `SessionGuard`/`OriginCheckGuard`, plus `SeparationOfDutiesService`
 *   (code-review finding — `ReadyForClaudeTasksService.changeStatus()` now calls
 *   `assertDistinctActors()` before honoring a `review`/`approve` transition, the same check
 *   `ReviewsService.decide()` performs, closing a real self-approval gap for any user who holds
 *   both a submit-capable role and an approve-capable role simultaneously).
 * - `AuthzModule` for `PermissionGuard`, plus `AuthorizationService` — used twice here: the
 *   dynamic per-transition permission check in `ReadyForClaudeTasksService.changeStatus()` (the
 *   four workflow actions map to genuinely different role tiers, so no single static
 *   `@RequirePermission` could express the real gate), and `isValidModuleKey()` for the
 *   polymorphic `targetModuleKey` validation (D1), the same narrow delegating method Review and
 *   Approval Center already uses rather than exporting the module registry repository itself.
 * - `AuditModule` for `AuditService` — every create/update/status transition is audited.
 * - `ProjectsModule` for its exported `ProjectService` (validating an optional `projectId`
 *   actually exists, a clean 404 rather than a raw FK-violation 500).
 * - `UsersModule` for its exported `UsersService` (`assertUserExists()` on the four nullable
 *   user-reference fields).
 *
 * No `AuthorizationService.canViewConfidential()` usage — no confidential-field mechanism exists
 * here (D6): the module registry's own seeded `confidentialityLevel` for `ready_for_claude_queue`
 * is `null`, matching every module built without one.
 */
@Module({
  imports: [AuthModule, AuthzModule, AuditModule, ProjectsModule, UsersModule],
  controllers: [ReadyForClaudeTasksController],
  providers: [...readyForClaudeQueueRepositoryProviders, ReadyForClaudeTasksService],
  exports: [ReadyForClaudeTasksService],
})
export class ReadyForClaudeQueueModule {}
