"use client";

import { useState, type ReactNode } from "react";
import type { CaseStudyLibraryTestimonial } from "@webdesk/shared-types";
import styles from "./case-study-library-testimonials-field.module.css";

const QUOTE_MAX_LENGTH = 2000;
const NAME_MAX_LENGTH = 255;
const MAX_TESTIMONIALS = 20;

const EMPTY_DRAFT: CaseStudyLibraryTestimonial = { quote: "", author: null, role: null };

export interface CaseStudyLibraryTestimonialsFieldProps {
  readonly values: readonly CaseStudyLibraryTestimonial[];
  readonly onChange: (next: readonly CaseStudyLibraryTestimonial[]) => void;
}

/**
 * A repeatable-row editor for `testimonials` — a JSONB array of `{quote, author, role}` embedded
 * directly on the record, not a separate sub-resource with its own endpoints (unlike
 * `ClaimSourcesSection`/`CaseStudyConsentsSection`, which each own real per-row CRUD routes). No
 * existing dashboard-web module has an array-of-objects field editor to reuse — this is genuinely
 * novel — so it manages the array as local draft state inside the parent form, submitted as one
 * whole array on save, mirroring `TagListField`'s own "the whole list is the field value" shape
 * rather than `ClaimSourcesSection`'s own "each row is independently persisted" shape.
 *
 * `quote` is structured plain text, NOT rich-text/HTML (D4, `createCaseStudyLibraryRecordSchema`'s
 * own `testimonialSchema`) — a plain `<textarea>`, not `RichTextEditor`, matching
 * `ClaimSourcesSection`'s own reasoning for why its `source` field stays plain: this is a short
 * structured evidence field, not authored narrative content, so it isn't the kind of long-text
 * field the 2026-08-22 standing rich-text rule targets.
 */
export function CaseStudyLibraryTestimonialsField({
  values,
  onChange,
}: CaseStudyLibraryTestimonialsFieldProps): ReactNode {
  const [draft, setDraft] = useState<CaseStudyLibraryTestimonial>(EMPTY_DRAFT);

  function addTestimonial(): void {
    const trimmedQuote = draft.quote.trim();
    if (!trimmedQuote || values.length >= MAX_TESTIMONIALS) {
      return;
    }
    onChange([
      ...values,
      {
        quote: trimmedQuote,
        author: draft.author?.trim() || null,
        role: draft.role?.trim() || null,
      },
    ]);
    setDraft(EMPTY_DRAFT);
  }

  function removeTestimonial(index: number): void {
    onChange(values.filter((_, i) => i !== index));
  }

  return (
    <div className={styles.field}>
      <span className={styles.label}>Testimonials</span>
      <span className={styles.helperText}>
        Short client testimonials — plain text, not formatted content. Up to {MAX_TESTIMONIALS}.
      </span>

      {values.length > 0 ? (
        <ul className={styles.list}>
          {values.map((testimonial, index) => (
            // Rows have no stable id of their own (a plain embedded array, not persisted
            // sub-resource entities); index is stable for the lifetime of this render since
            // removal always rebuilds the whole array.
            <li key={index} className={styles.row}>
              <div className={styles.rowMain}>
                <p className={styles.quote}>&ldquo;{testimonial.quote}&rdquo;</p>
                {testimonial.author || testimonial.role ? (
                  <p className={styles.attribution}>
                    {[testimonial.author, testimonial.role].filter(Boolean).join(", ")}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => removeTestimonial(index)}
                className={styles.removeButton}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {values.length < MAX_TESTIMONIALS ? (
        <div className={styles.draftRow}>
          <textarea
            aria-label="New testimonial quote"
            placeholder="Quote"
            maxLength={QUOTE_MAX_LENGTH}
            value={draft.quote}
            onChange={(event) => setDraft((current) => ({ ...current, quote: event.target.value }))}
            className={styles.draftTextarea}
            rows={2}
          />
          <div className={styles.draftFieldRow}>
            <input
              type="text"
              aria-label="New testimonial author"
              placeholder="Author"
              maxLength={NAME_MAX_LENGTH}
              value={draft.author ?? ""}
              onChange={(event) =>
                setDraft((current) => ({ ...current, author: event.target.value }))
              }
              className={styles.draftInput}
            />
            <input
              type="text"
              aria-label="New testimonial role"
              placeholder="Role"
              maxLength={NAME_MAX_LENGTH}
              value={draft.role ?? ""}
              onChange={(event) =>
                setDraft((current) => ({ ...current, role: event.target.value }))
              }
              className={styles.draftInput}
            />
          </div>
          <button
            type="button"
            onClick={addTestimonial}
            disabled={!draft.quote.trim()}
            className={styles.addButton}
          >
            Add testimonial
          </button>
        </div>
      ) : null}
    </div>
  );
}
