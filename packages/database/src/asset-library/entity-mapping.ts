const DATE_FIELDS = ["createdAt", "updatedAt", "publishedAt"] as const;

/** Same per-module local helper pattern every `packages/database` module owns independently
 *  (`brand-library/entity-mapping.ts`, `content-template-library/entity-mapping.ts`,
 *  `service-library/entity-mapping.ts`, etc.) — no shared cross-module version exists in this
 *  codebase, by established precedent. Includes `publishedAt` alongside the usual
 *  `createdAt`/`updatedAt`, mirroring Brand Library's own identical helper. */
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
