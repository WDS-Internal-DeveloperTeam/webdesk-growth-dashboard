/**
 * "Build a `Map<id, name>` from a fetched list, then resolve a set of ids through it with a
 * raw-id fallback for anything outside the fetch window" — the pattern this codebase's detail
 * pages have now hand-copied inline 3 times (`ComponentLibraryDetailPage`'s `tokenNameById`/
 * `componentNameById`, `PageTemplateLibraryDetailPage`'s `sectionNameById`/`componentNameById`/
 * `pageTemplateNameById`, and `MotionAndInteractionLibraryDetailPage`'s `componentNameById`),
 * matching this project's own established "extract after the second occurrence" precedent
 * (`arrayFieldValue()`, `richTextFieldValue()`, `useSyncedState()`).
 *
 * The two pre-existing Component Library/Page Template Library call sites were left as inline
 * hand-copies at extraction time — retrofitting them was out of scope for a branch that didn't
 * otherwise touch either module, the same call this project made when `useSyncedState()` was
 * extracted. New detail-page id-resolution should use this instead of hand-rolling another copy.
 */
export function buildNameById<T>(
  items: readonly T[],
  getId: (item: T) => string,
  getName: (item: T) => string,
): ReadonlyMap<string, string> {
  return new Map(items.map((item) => [getId(item), getName(item)]));
}

/** An id outside `nameById`'s own fetch window falls back to the raw id itself — still real and
 *  honest, just unresolved, matching the accepted over-fetch/pagination-bound debt every prior
 *  inline copy of this pattern already carries. */
export function resolveIdsToNames(
  ids: readonly string[],
  nameById: ReadonlyMap<string, string>,
): readonly string[] {
  return ids.map((id) => nameById.get(id) ?? id);
}
