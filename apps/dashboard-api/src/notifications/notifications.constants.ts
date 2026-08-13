/** NestJS DI tokens for the Phase 1E notification-foundation slice — kept in one file, same pattern as ../audit/audit.constants.ts. */
export const NOTIFICATION_REPOSITORY = Symbol("NOTIFICATION_REPOSITORY");
export const NOTIFICATION_DELIVERY_ADAPTER = Symbol("NOTIFICATION_DELIVERY_ADAPTER");

/** Max delivery attempts before a retryable rejection becomes permanent — matches the same "bounded, not infinite" retry discipline `JobService` uses. */
export const MAX_DELIVERY_ATTEMPTS = 5;
