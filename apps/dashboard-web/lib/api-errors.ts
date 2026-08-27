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

export type PostMutationResult<T> =
  { readonly ok: true; readonly data: T } | { readonly ok: false; readonly message: string };

/**
 * `fetch()` a mutating `dashboard-api` route with the standard shape every mutation in this app
 * already uses (`credentials: "include"`, JSON body, `parseApiErrorMessage()` on failure) —
 * extracted (code-review finding) after the identical fetch-then-check-`response.ok` block was
 * hand-copied 3 times in the same PR that introduced `ContentTemplateStatusActions`/
 * `ContentTemplatePublishActions`/`ContentTemplateLibraryForm`. Only covers the network call
 * itself; each caller still owns its own local-state update and `router.refresh()` timing, since
 * those differ per component (a status transition vs. a create/edit redirect).
 *
 * `method` defaults to `"POST"` (every existing caller) — added rather than hand-duplicated a
 * 4th time for Page Workspace's one real `PATCH` route (code-review finding, `dashboard-web-page-
 * workspace`).
 */
export async function postMutation<T = unknown>(
  url: string,
  body?: unknown,
  options?: { readonly method?: "POST" | "PATCH" },
): Promise<PostMutationResult<T>> {
  const response = await fetch(url, {
    method: options?.method ?? "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    return { ok: false, message: await parseApiErrorMessage(response) };
  }
  // Tolerant on success: not every caller needs the parsed body (status/publish-actions only care
  // that the request succeeded, and update their own local state from a value they already know,
  // never from the response), so a missing/non-JSON success body degrades to `undefined` rather
  // than throwing — a plain `.catch()` isn't enough here, since a genuinely missing `.json` method
  // throws synchronously before returning a promise to catch.
  let json: { data: T } | null;
  try {
    json = (await response.json()) as { data: T };
  } catch {
    json = null;
  }
  return { ok: true, data: (json?.data ?? undefined) as T };
}
