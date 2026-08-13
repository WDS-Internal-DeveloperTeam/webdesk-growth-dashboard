import type { Provider } from "@nestjs/common";
import {
  NotificationRepository,
  OperationalContactRepository,
  UserRepository,
} from "@webdesk/database";
import {
  NOTIFICATION_DELIVERY_ADAPTER,
  NOTIFICATION_REPOSITORY,
} from "./notifications.constants.js";
import { UnconfiguredNotificationDeliveryAdapter } from "./delivery-adapter.js";
import { USER_REPOSITORY } from "../auth/config/auth.constants.js";
import { OPERATIONAL_CONTACT_REPOSITORY } from "../operational-contacts/operational-contacts.constants.js";

/**
 * DI wiring — same `useFactory` pattern as ../audit/database.providers.ts and ../jobs/database.providers.ts.
 * `USER_REPOSITORY`/`OPERATIONAL_CONTACT_REPOSITORY` are re-declared here (a fresh `UserRepository`/
 * `OperationalContactRepository` instance under the same token), not imported by cross-importing
 * `AuthModule`/`OperationalContactsModule` — same "re-declare, don't cross-import" pattern
 * `AuthModule`'s own doc comment establishes for `USER_REPOSITORY`.
 */
export const notificationsRepositoryProviders: Provider[] = [
  { provide: NOTIFICATION_REPOSITORY, useFactory: () => new NotificationRepository() },
  {
    provide: NOTIFICATION_DELIVERY_ADAPTER,
    useFactory: () => new UnconfiguredNotificationDeliveryAdapter(),
  },
  { provide: USER_REPOSITORY, useFactory: () => new UserRepository() },
  {
    provide: OPERATIONAL_CONTACT_REPOSITORY,
    useFactory: () => new OperationalContactRepository(),
  },
];
