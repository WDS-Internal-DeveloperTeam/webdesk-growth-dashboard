import type { Provider } from "@nestjs/common";
import { NotificationRepository } from "@webdesk/database";
import {
  NOTIFICATION_DELIVERY_ADAPTER,
  NOTIFICATION_REPOSITORY,
} from "./notifications.constants.js";
import { UnconfiguredNotificationDeliveryAdapter } from "./delivery-adapter.js";

/** DI wiring — same `useFactory` pattern as ../audit/database.providers.ts and ../jobs/database.providers.ts. */
export const notificationsRepositoryProviders: Provider[] = [
  { provide: NOTIFICATION_REPOSITORY, useFactory: () => new NotificationRepository() },
  {
    provide: NOTIFICATION_DELIVERY_ADAPTER,
    useFactory: () => new UnconfiguredNotificationDeliveryAdapter(),
  },
];
