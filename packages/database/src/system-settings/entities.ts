/**
 * The System Settings module foundation — persistence-layer shapes for `system_settings`
 * (migration `00120`, `docs/implementation/module-system-settings.md`, module #42). A single
 * table, matching Business Knowledge Center's/Persona Library's/Service Library's/Brand
 * Library's own single-generic-table precedent. Organization-wide, not project-scoped — no
 * `project_id` column.
 */

/** Mirrors Business Knowledge Center's/Brand Library's own discriminator-column shape (D1) —
 *  one table, 9 real in-scope setting kinds (see the implementation doc's own "Scope decision":
 *  retention, contacts, and scan schedules are explicitly OUT of scope, since they already have
 *  their own dedicated, already-live tables elsewhere in this codebase). */
export type SystemSettingType =
  | "status_definition"
  | "category_definition"
  | "taxonomy_definition"
  | "file_limit"
  | "git_rule"
  | "backup_rule"
  | "escalation_sla"
  | "documentation_rule"
  | "environment";

/** The primary entity. `value` is a bounded, otherwise-unstructured JSON object (D2) — each
 *  `settingType`'s real shape differs (a file limit is a byte count + allowed MIME list; a Git
 *  rule is a branch-naming pattern; an environment is a name + URL + type), validated at the DTO
 *  layer only (a 50,000-byte serialized-size cap), no per-`settingType` schema. */
export interface SystemSettingEntity {
  readonly id: string;
  readonly publicId: string;
  readonly settingType: SystemSettingType;
  readonly key: string;
  readonly value: Record<string, unknown>;
  readonly description: string | null;
  /** Orthogonal boolean (D4), governed via the dedicated `:id/active-state` route only — never
   *  accepted through `create()`/`update()`. */
  readonly isActive: boolean;
  readonly createdBy: string | null;
  readonly updatedBy: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}
