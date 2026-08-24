const DATE_FIELDS = ["createdAt", "updatedAt", "publishedAt"] as const;

/** Same per-module local helper pattern every `packages/database` module owns independently
 *  (`persona-library/entity-mapping.ts`, `service-library/entity-mapping.ts`,
 *  `business-knowledge/entity-mapping.ts`, `projects/entity-mapping.ts`, etc.) — no shared
 *  cross-module version exists in this codebase, by established precedent. Includes
 *  `publishedAt` alongside the usual `createdAt`/`updatedAt` — the one field this module has that
 *  no sibling module's identical helper needed to convert. */
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
