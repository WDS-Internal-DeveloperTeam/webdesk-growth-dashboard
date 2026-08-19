import type { Provider } from "@nestjs/common";
import {
  AuthEventRepository,
  AuthLockoutStateRepository,
  EmergencyAdminCredentialRepository,
  ExternalAuthIdentityRepository,
  RecoveryRequestRepository,
  SessionExchangeCodeRepository,
  SessionRepository,
  UserRepository,
} from "@webdesk/database";
import {
  AUTH_EVENT_REPOSITORY,
  AUTH_LOCKOUT_STATE_REPOSITORY,
  EMERGENCY_ADMIN_CREDENTIAL_REPOSITORY,
  EXTERNAL_AUTH_IDENTITY_REPOSITORY,
  RECOVERY_REQUEST_REPOSITORY,
  SESSION_EXCHANGE_CODE_REPOSITORY,
  SESSION_REPOSITORY,
  USER_REPOSITORY,
} from "./config/auth.constants.js";

/**
 * DI wiring for `packages/database`'s Phase 1C repositories. `useFactory`
 * rather than `useClass` — the repository constructors call
 * `getAuthModels()` themselves (no constructor dependencies to resolve),
 * so a plain factory is simplest and keeps the provider tokens decoupled
 * from the concrete class shape.
 */
export const authRepositoryProviders: Provider[] = [
  { provide: USER_REPOSITORY, useFactory: () => new UserRepository() },
  {
    provide: EXTERNAL_AUTH_IDENTITY_REPOSITORY,
    useFactory: () => new ExternalAuthIdentityRepository(),
  },
  {
    provide: EMERGENCY_ADMIN_CREDENTIAL_REPOSITORY,
    useFactory: () => new EmergencyAdminCredentialRepository(),
  },
  { provide: SESSION_REPOSITORY, useFactory: () => new SessionRepository() },
  { provide: AUTH_LOCKOUT_STATE_REPOSITORY, useFactory: () => new AuthLockoutStateRepository() },
  { provide: RECOVERY_REQUEST_REPOSITORY, useFactory: () => new RecoveryRequestRepository() },
  { provide: AUTH_EVENT_REPOSITORY, useFactory: () => new AuthEventRepository() },
  {
    provide: SESSION_EXCHANGE_CODE_REPOSITORY,
    useFactory: () => new SessionExchangeCodeRepository(),
  },
];
