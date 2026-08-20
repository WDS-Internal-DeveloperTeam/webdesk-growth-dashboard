import type { ApiErrorResponse } from "@webdesk/shared-types";

/**
 * Error codes `dashboard-api`'s service layers deliberately throw with safe, user-facing text
 * (`"publicId already in use: X"`, `"Project not found: X"`) — everything else (e.g.
 * `PermissionGuard`'s `InternalServerErrorException` on a dropped `@RequirePermission` decorator,
 * or any other unanticipated `HttpException`) falls back to a generic message instead.
 * `AllExceptionsFilter` only redacts non-`HttpException` errors, so without this allowlist a future
 * backend bug could leak internal wiring detail straight into this form. `ConflictException` was
 * added for the Business Knowledge status-transition action (its message, `"...status changed
 * concurrently...reload and retry"`, is safe, user-facing text from
 * `BusinessKnowledgeRecordRepository.updateStatus()`'s atomic compare-and-swap losing a race) — but
 * this Set is shared by every consumer of `parseApiErrorMessage()`, so the change also applies to
 * every other existing `ConflictException` throw site, notably
 * `RoleAssignmentService.assignRole()`'s `"User already holds role: X"` message, reachable from the
 * already-shipped Project Approvers flow (`components/project-approvers-section.tsx`). Verified
 * safe: `role.key` carries no PII/secrets and is already visible via other authenticated endpoints,
 * so this is a real (if minor) user-facing improvement there too, not a new exposure — see
 * `project-approvers-section.test.tsx`'s dedicated regression test for that path.
 */
const SAFE_MESSAGE_CODES = new Set([
  "BadRequestException",
  "NotFoundException",
  "ConflictException",
]);

const GENERIC_MESSAGE = "Something went wrong. Please try again.";

/**
 * Parses a failed `fetch()` `Response` into a display-ready error message: field-level Zod
 * `issues` first (when `ZodValidationPipe` rejected the request), then an allowlisted plain
 * service message, then a generic fallback for anything else.
 */
export async function parseApiErrorMessage(response: Response): Promise<string> {
  const body = (await response.json().catch(() => null)) as ApiErrorResponse | null;
  if (!body) {
    return GENERIC_MESSAGE;
  }
  if (body.error.issues && body.error.issues.length > 0) {
    return body.error.issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ");
  }
  if (SAFE_MESSAGE_CODES.has(body.error.code)) {
    return body.error.message;
  }
  return GENERIC_MESSAGE;
}
