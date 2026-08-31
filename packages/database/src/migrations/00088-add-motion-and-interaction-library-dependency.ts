import type { QueryInterface } from "sequelize";

/**
 * Code-review finding (CONFIRMED) against `module-motion-and-interaction-library`: migration
 * `00035-populate-module-registry-fields.ts` seeded `motion_and_interaction_library.dependencies`
 * as `null`, but `MotionAndInteractionLibraryModule` (built on this same branch) gives it a real,
 * hard, synchronous runtime dependency on Component Library —
 * `ComponentsService.existingComponentIds()` is called on every `create()`/`update()` to validate
 * `relatedComponentIds` — the identical class of coupling `page_template_library`'s own seeded
 * `dependencies` row already correctly lists `component_library` for. Left unfixed, this stays
 * silently inconsistent with `docs/phase-plans/module-implementation-roadmap.md`, which computes
 * its build-order "waves" by mechanically transcribing this exact field — a future maintainer
 * sequencing work off the roadmap could deprioritize or decouple Component Library from Motion and
 * Interaction Library's build order without ever seeing the real coupling this branch introduced.
 *
 * A separate, additive migration rather than editing `00035` in place — `00035` already ran
 * against production long before this branch existed; editing an already-applied migration file
 * would silently diverge from what production actually executed.
 */
export async function up({ context }: { context: QueryInterface }): Promise<void> {
  await context.sequelize.query(
    `UPDATE module_registry SET dependencies = '["component_library"]'::jsonb, last_reviewed_at = now() WHERE key = 'motion_and_interaction_library';`,
  );
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
  await context.sequelize.query(
    `UPDATE module_registry SET dependencies = NULL WHERE key = 'motion_and_interaction_library';`,
  );
}
