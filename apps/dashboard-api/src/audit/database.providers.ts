import type { Provider } from "@nestjs/common";
import { AuditEventRepository } from "@webdesk/database";
import { AUDIT_EVENT_REPOSITORY } from "./audit.constants.js";

/** DI wiring for `packages/database`'s Phase 1E `AuditEventRepository` — same `useFactory` pattern as ../auth/database.providers.ts (no constructor dependencies to resolve). */
export const auditRepositoryProviders: Provider[] = [
  { provide: AUDIT_EVENT_REPOSITORY, useFactory: () => new AuditEventRepository() },
];
