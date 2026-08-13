import type { Provider } from "@nestjs/common";
import { IncidentSeverityPolicyRepository, OperationalContactRepository } from "@webdesk/database";
import {
  INCIDENT_SEVERITY_POLICY_REPOSITORY,
  OPERATIONAL_CONTACT_REPOSITORY,
} from "./operational-contacts.constants.js";

/** DI wiring — same `useFactory` pattern as ../audit/database.providers.ts and ../jobs/database.providers.ts. */
export const operationalContactsRepositoryProviders: Provider[] = [
  { provide: OPERATIONAL_CONTACT_REPOSITORY, useFactory: () => new OperationalContactRepository() },
  {
    provide: INCIDENT_SEVERITY_POLICY_REPOSITORY,
    useFactory: () => new IncidentSeverityPolicyRepository(),
  },
];
