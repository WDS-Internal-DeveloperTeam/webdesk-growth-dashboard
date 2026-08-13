/** NestJS DI tokens for the Phase 1E system-events-health slice — kept in one file, same pattern as ../audit/audit.constants.ts. */
export const SYSTEM_EVENT_REPOSITORY = Symbol("SYSTEM_EVENT_REPOSITORY");
export const SYSTEM_COMPONENT_REPOSITORY = Symbol("SYSTEM_COMPONENT_REPOSITORY");
export const SYSTEM_HEALTH_CHECK_REPOSITORY = Symbol("SYSTEM_HEALTH_CHECK_REPOSITORY");
