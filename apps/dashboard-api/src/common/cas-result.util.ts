import { ConflictException, NotFoundException } from "@nestjs/common";

/**
 * The shape every module's own atomic compare-and-swap repository method returns
 * (`ReviewRepository.updateStatus()`, `InternalLinkRepository.updateStatus()`,
 * `ReadyForClaudeTaskRepository.updateStatus()`, ...). Purely structural — a module's own
 * `XyzCasResult<T>` type alias (each declared independently, per this codebase's own established
 * precedent of not coupling one module's repository types to another's) is assignable here without
 * an import, since TypeScript compares by shape.
 */
export type CasOutcome<T> =
  | { readonly outcome: "updated"; readonly entity: T }
  | { readonly outcome: "not_found" }
  | { readonly outcome: "conflict"; readonly entity: T };

/**
 * Resolves a `CasOutcome` into its entity or throws the matching HTTP exception. Extracted
 * (code-review finding on `module-ready-for-claude-queue`) after `ReviewsService`,
 * `DesignReviewsService`, and `ReadyForClaudeTasksService` had each independently hand-copied an
 * identical private `unwrapCasResult()` method — three structurally-identical copies, past this
 * project's own established "extract after the 2nd occurrence" threshold. Only
 * `ReadyForClaudeTasksService` is switched to call this shared helper; the two pre-existing
 * copies are deliberately left as-is, matching this codebase's own repeated practice of not
 * retrofitting an extraction onto already-shipped, already-reviewed siblings in the same pass
 * that introduces the shared helper.
 *
 * `notFoundMessage`/`conflictMessage` are thunks so each caller reports its own wording without
 * re-deriving the outcome branching itself.
 */
export function unwrapCasResult<T>(
  result: CasOutcome<T>,
  notFoundMessage: () => string,
  conflictMessage: (entity: T) => string,
): T {
  if (result.outcome === "not_found") {
    throw new NotFoundException(notFoundMessage());
  }
  if (result.outcome === "conflict") {
    throw new ConflictException(conflictMessage(result.entity));
  }
  return result.entity;
}
