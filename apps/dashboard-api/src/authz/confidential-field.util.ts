/**
 * Confidential-field redaction primitive (task package §11): "confidential
 * data must be excluded server-side before the response is returned" — not
 * sent to the browser and merely hidden with CSS. No business entity with
 * real confidential fields exists yet (Task 8+, out of this phase's
 * scope), so this is the reusable enforcement mechanism a future module
 * calls once one does — proven by unit test against representative
 * fixture data, the same "prove the framework, not a business module"
 * pattern PR #8 used for `PermissionGuard` against the "Users/roles"
 * surface only.
 *
 * Callers must resolve `canViewConfidential` via
 * `AuthorizationService.canViewConfidential(userId, moduleKey, projectId)`
 * — a real deny-by-default permission check — before calling this
 * function; it does not perform authorization itself, only the mechanical
 * redaction once a decision is already made.
 */
export function redactConfidentialFields<T extends Record<string, unknown>>(
  record: T,
  confidentialFields: readonly (keyof T)[],
  canViewConfidential: boolean,
): T {
  if (canViewConfidential || confidentialFields.length === 0) {
    return record;
  }
  const redacted = { ...record };
  for (const field of confidentialFields) {
    delete redacted[field];
  }
  return redacted;
}

/** Same redaction, applied to every record in a list — the shape an export or a list endpoint needs. */
export function redactConfidentialFieldsFromList<T extends Record<string, unknown>>(
  records: readonly T[],
  confidentialFields: readonly (keyof T)[],
  canViewConfidential: boolean,
): readonly T[] {
  if (canViewConfidential || confidentialFields.length === 0) {
    return records;
  }
  return records.map((record) =>
    redactConfidentialFields(record, confidentialFields, canViewConfidential),
  );
}
