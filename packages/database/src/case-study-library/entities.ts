/**
 * Case Study Library — module #24 foundation, persistence-layer shapes for
 * `case_study_library_records` (migration `00093`). Organization-wide, not project-scoped. An
 * EXTENSION table over Case Study Studio's own `case_studies` (D1) — this entity deliberately does
 * NOT duplicate any of `CaseStudyEntity`'s own fields (status/visibility/client name/etc.); a
 * caller reads those by joining in the parent case study at the service layer.
 * See `docs/implementation/module-case-study-library.md` for the full design account.
 */

/** A short, structured plain-text testimonial — not rich-text/HTML (D4). */
export interface CaseStudyLibraryTestimonial {
  readonly quote: string;
  readonly author: string | null;
  readonly role: string | null;
}

export interface CaseStudyLibraryRecordEntity {
  readonly id: string;
  readonly publicId: string;
  /** The one parent case study this record extends — a real DB-level FK, enforced unique (one
   *  library record per case study, D1). */
  readonly caseStudyId: string;
  /** Existence-validated against the real `pages` table (D2) — NOT a DB-level FK. */
  readonly relatedPageIds: readonly string[];
  /** Plain, unvalidated (D3). */
  readonly technologies: readonly string[];
  readonly testimonials: readonly CaseStudyLibraryTestimonial[];
  readonly createdBy: string | null;
  readonly updatedBy: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}
