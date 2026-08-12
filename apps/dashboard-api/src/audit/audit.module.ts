import { Module } from "@nestjs/common";
import { auditRepositoryProviders } from "./database.providers.js";
import { AuditService } from "./audit.service.js";

/**
 * Phase 1E — audit foundation slice
 * (docs/task-packages/phase-1e-audit-foundation.md). Deliberately has no
 * controllers of its own yet — no HTTP surface for querying audit events was
 * requested by this slice, only the write path other services call into.
 * Depends on nothing from `AuthModule`/`AuthzModule`, so both of those can
 * import this module directly without any circular-dependency risk.
 */
@Module({
  providers: [...auditRepositoryProviders, AuditService],
  exports: [AuditService],
})
export class AuditModule {}
