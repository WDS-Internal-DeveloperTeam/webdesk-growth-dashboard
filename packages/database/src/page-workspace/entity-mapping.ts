/** `approvedAt` is included alongside the usual two because `PageArtifactVersionEntity` types it
 *  as an ISO string, not a `Date` — same per-module local helper pattern every
 *  `packages/database` module owns independently (`page-inventory/entity-mapping.ts`,
 *  `persona-library/entity-mapping.ts`, etc.); no shared cross-module version exists in this
 *  codebase, by established precedent. */
const DATE_FIELDS = ["createdAt", "updatedAt", "approvedAt"] as const;

export function toEntityWithIsoDates<TEntity>(instance: {
  toJSON(): Record<string, unknown>;
}): TEntity {
  const json = instance.toJSON();
  for (const field of DATE_FIELDS) {
    const value = json[field];
    if (value instanceof Date) {
      json[field] = value.toISOString();
    }
  }
  return json as TEntity;
}
