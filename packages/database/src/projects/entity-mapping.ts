/**
 * Shared `Model` → entity mapper for the Projects module's repositories (code-review finding,
 * `module-projects-foundation` branch). Every repository's entity shape matches its Sequelize
 * model's camelCase attributes 1:1 (the model layer already does the DB→JS type conversion via
 * `DataTypes`), so the only real transformation needed anywhere is turning `Date` fields into ISO
 * strings — collapsing what were six near-identical hand-rolled `toEntity()` functions (each
 * re-casting every field individually) into one shared helper plus a per-repository list of which
 * fields are dates.
 */
export function toEntityWithIsoDates<TEntity>(
  instance: { toJSON(): Record<string, unknown> },
  dateFields: readonly string[],
): TEntity {
  const json = instance.toJSON();
  for (const field of dateFields) {
    const value = json[field];
    if (value instanceof Date) {
      json[field] = value.toISOString();
    }
  }
  return json as TEntity;
}
