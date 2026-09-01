import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module.js";
import { AuthModule } from "../auth/auth.module.js";
import { AuthzModule } from "../authz/authz.module.js";
import { CaseStudyStudioModule } from "../case-study-studio/case-study-studio.module.js";
import { PageInventoryModule } from "../page-inventory/page-inventory.module.js";
import { caseStudyLibraryRepositoryProviders } from "./database.providers.js";
import { CaseStudyLibraryService } from "./case-study-library.service.js";
import { CaseStudyLibraryController } from "./case-study-library.controller.js";

/**
 * Case Study Library — module #24 on the Recommended Module Roadmap
 * (`docs/implementation/module-case-study-library.md`). An EXTENSION over the already-live Case
 * Study Studio (D1) — imports `AuthModule` for `SessionGuard`/`OriginCheckGuard`, `AuthzModule` for
 * `PermissionGuard`, `AuditModule` for `AuditService` (create/update are both audited),
 * `CaseStudyStudioModule` for its exported `CaseStudiesService` (resolving/validating the parent
 * case study — status gate on create, D5 — and joining it into every read), and
 * `PageInventoryModule` for its exported `PagesService` (`relatedPageIds` existence validation,
 * org-wide, via `PagesService.existingPageIds()`, D2).
 *
 * Declares its own `CASE_STUDY_LIBRARY_MODULE_KEY` with the real, seeded `case_studies` RBAC
 * permission-group value — no new RBAC migration, since `case_study_library`'s own module-registry
 * entry already shares that same permission group with `case_study_studio` (a coincidental value
 * match, not a real coupling — see `case-study-library.constants.ts`'s own doc comment).
 *
 * No `AuthorizationService.canViewConfidential()` usage — no confidential-field mechanism exists
 * here (D6), matching Case Study Studio's own D9 precedent: the module registry's own
 * `confidentiality_level` text for `case_study_library` describes the joined parent's `visibility`
 * workflow vocabulary, not a new redaction axis this module introduces or enforces on read.
 */
@Module({
  imports: [AuthModule, AuthzModule, AuditModule, CaseStudyStudioModule, PageInventoryModule],
  controllers: [CaseStudyLibraryController],
  providers: [...caseStudyLibraryRepositoryProviders, CaseStudyLibraryService],
  exports: [CaseStudyLibraryService],
})
export class CaseStudyLibraryModule {}
