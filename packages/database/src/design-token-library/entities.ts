/**
 * The Design Token Library module foundation — persistence-layer shapes for `design_tokens`
 * (migration `00074`). Organization-wide, not project-scoped — a catalog of literal design-token
 * values for the **WordPress website** deliverable, deliberately isolated from this dashboard's
 * own `packages/ui` design tokens (an unrelated system) — see this module's own scope doc
 * (`docs/implementation/module-design-token-library.md`).
 *
 * File-for-file mirrors `website-strategy-center/entities.ts` — this module implements the same
 * REAL version history (design decision 1): every version of a record is its own physical row,
 * sharing the same `recordId` (the stable logical-record identity — NOT the same as `id`, which
 * is unique per physical row/version). `publicId` is also stable across every version of the same
 * record. Uniqueness for both `recordId`'s "current version" and `publicId` is enforced via a
 * partial unique index `WHERE is_current = true` (migration `00074`), not a bare column
 * constraint — see that migration's own doc comment for why.
 */

/** The spec's own token-group taxonomy
 *  (`03_Detailed_Module_Specifications.md §13`), collapsed into one flat enum — the spec lists a
 *  finer-grained set (font family/size/weight/line-height/letter-spacing; gutters/margins/
 *  containers; radii; icon sizes/strokes; focus/form/interactive states, etc.) with no fixed
 *  vocabulary of its own, so this groups closely-related spec items under one value rather than
 *  inventing dozens of near-duplicate enum members (`typography` covers font family/size/weight/
 *  line-height/letter-spacing; `spacing` covers spacing/gutters/margins/containers; `borders`
 *  covers borders/radii; `opacity_and_z_index` covers opacity/z-index; `media_ratios` covers
 *  image/video ratios; `interactive_states` covers focus/form/interactive states). Immutable
 *  across a record's own version chain (set once at creation; a real group change is a different
 *  record, not a new version of this one — enforced server-side, never accepted through
 *  `update()`), mirroring `WebsiteStrategyRecordType`'s own immutability discipline.
 */
export type DesignTokenGroup =
  | "colors"
  | "semantic_statuses"
  | "theme"
  | "typography"
  | "spacing"
  | "grids"
  | "breakpoints"
  | "borders"
  | "shadows"
  | "opacity_and_z_index"
  | "icon_sizes"
  | "media_ratios"
  | "component_sizes"
  | "motion"
  | "interactive_states";

/** Which theme(s) a token's value applies to — the spec's own "theme variation" field. `null`
 *  means the token is theme-independent (most tokens). */
export type DesignTokenThemeVariation = "light" | "dark" | "both";

/** The shared generic artifact-lifecycle vocabulary, reused verbatim from Website Strategy
 *  Center's/Service Library's/Persona Library's/Proof and Claims Library's own identical
 *  `ApprovalStatus` union (design decision 2) — deliberately not extracted into a shared type,
 *  already-accepted, out-of-scope debt in this codebase. */
export type DesignTokenApprovalStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "approved"
  | "revision_requested"
  | "rejected"
  | "superseded"
  | "archived";

/**
 * One row per VERSION — `id` is unique per row; `recordId` groups every version of the same
 * logical token record together (the history/comparison key). `isCurrent` is true for exactly one
 * row per `recordId` at any time (flipped atomically in the same transaction that creates a new
 * version — see `DesignTokenRepository.createNewVersion()`/`updateInPlace()`).
 * `usageReferences` is a plain, unvalidated string array (design decision 3) — no
 * `component_library`/`page_workspace` module exists yet to link it to for real.
 */
export interface DesignTokenEntity {
  readonly id: string;
  readonly recordId: string;
  readonly publicId: string;
  readonly group: DesignTokenGroup;
  readonly versionNumber: number;
  readonly isCurrent: boolean;
  readonly name: string;
  readonly value: string;
  readonly unit: string | null;
  readonly semanticPurpose: string | null;
  readonly responsiveVariation: string | null;
  readonly themeVariation: DesignTokenThemeVariation | null;
  readonly usageReferences: readonly string[];
  readonly approvalStatus: DesignTokenApprovalStatus;
  readonly createdBy: string | null;
  readonly updatedBy: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}
