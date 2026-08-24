"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import type { Keyword, KeywordConfidence } from "@webdesk/shared-types";
import { parseApiErrorMessage } from "@/lib/api-errors";
import { getApiBaseUrl } from "@/lib/auth";
import { plainTextFieldValue } from "@/lib/form-field-value";
import {
  CONFIDENCE_LABEL,
  CONFIDENCE_VALUES,
  withProjectId,
} from "@/lib/keyword-and-entity-library-query";
import { findOverLongRichTextField, richTextFieldValue } from "@/lib/rich-text";
import { RichTextEditor } from "./rich-text-editor";
import styles from "./keyword-form.module.css";

// Mirrors apps/dashboard-api/src/keyword-and-entity-library/keyword-and-entity-library.dto.ts —
// kept in sync by hand, same approach every sibling form in this app uses.
const PUBLIC_ID_MAX_LENGTH = 64;
const QUERY_TEXT_MAX_LENGTH = 500;
const SHORT_TEXT_MAX_LENGTH = 100;
const SOURCE_MAX_LENGTH = 200;
const LONG_TEXT_MAX_LENGTH = 40_000;

export type KeywordFormProps =
  | { readonly mode: "create"; readonly projectId: string }
  | {
      readonly mode: "edit";
      readonly projectId: string;
      readonly keywordId: string;
      readonly initial: Keyword;
    };

/**
 * Create/edit form for a Keyword & Entity Library keyword record. No approved wireframe field-level
 * spec exists for this screen — `04_Data_Model_and_Ownership.md`'s own field list plus the backend's
 * actual `createKeywordSchema`/`updateKeywordSchema`
 * (`apps/dashboard-api/src/keyword-and-entity-library/keyword-and-entity-library.dto.ts`) is the
 * only source, matching every sibling module's own "smallest honest reading" precedent for an
 * unsourced screen.
 *
 * `publicId` is create-only (shown read-only on edit, matching every sibling form's own
 * `publicId`/`recordType` convention). `approvalStatus` is deliberately never a field here — only
 * the dedicated `POST .../status` route (`KeywordStatusActions`) may change it, matching
 * `updateKeywordSchema`'s own contract.
 *
 * `cannibalizationNotes` uses `RichTextEditor`, per the 2026-08-22 standing rule — sanitized
 * server-side before storage (`KeywordsService.create()`/`update()`) and again at render time via
 * `SanitizedRichText`, the same double-sanitization pattern every other rich-text field in this app
 * already establishes.
 *
 * `searchVolume`/`difficultyScore` are real HTML `<input type="number">` fields, but the browser's
 * own numeric-input constraint isn't sufficient on its own (it still allows an empty string, and a
 * pasted or spinner-nudged value can end up non-integer in some browsers) — `parseIntegerField()`
 * (defined locally, not extracted — only 2 call sites in this one file, matching
 * `project-roadmap-section.tsx`'s own local, unextracted `parseSequence()` precedent for the
 * identical reasoning) validates on submit and surfaces a clear, specific error rather than letting
 * an invalid value round-trip to the backend's own Zod rejection.
 *
 * Submits via a direct browser `fetch()` with `credentials: "include"` — required for
 * `dashboard-api`'s `OriginCheckGuard` to see a real browser `Origin` header, the same pattern every
 * mutation form in this app already uses. `projectId` is always a prop (never a form field) —
 * keywords are project-scoped, and the project id is threaded into both the submit URL and the
 * post-submit redirect, never derived from the form's own fields.
 */
export function KeywordForm(props: KeywordFormProps): ReactNode {
  const router = useRouter();
  const initial = props.mode === "edit" ? props.initial : null;

  const [publicId, setPublicId] = useState(initial?.publicId ?? "");
  const [queryText, setQueryText] = useState(initial?.queryText ?? "");
  const [keywordType, setKeywordType] = useState(initial?.keywordType ?? "");
  const [intent, setIntent] = useState(initial?.intent ?? "");
  const [funnelStage, setFunnelStage] = useState(initial?.funnelStage ?? "");
  const [country, setCountry] = useState(initial?.country ?? "");
  const [searchVolume, setSearchVolume] = useState(initial?.searchVolume?.toString() ?? "");
  const [difficultyScore, setDifficultyScore] = useState(
    initial?.difficultyScore?.toString() ?? "",
  );
  const [source, setSource] = useState(initial?.source ?? "");
  const [researchDate, setResearchDate] = useState(initial?.researchDate ?? "");
  const [cannibalizationNotes, setCannibalizationNotes] = useState(
    initial?.cannibalizationNotes ?? "",
  );
  const [confidence, setConfidence] = useState<KeywordConfidence | "">(initial?.confidence ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      // queryText is a real HTML `required` field — the browser's own constraint validation blocks
      // a submit event from ever firing while it's empty, so no redundant JS-level check is needed
      // here, matching PageForm/ProjectForm's own precedent.
      const trimmedQueryText = queryText.trim();

      const plainTextField = (value: string): string | null | undefined =>
        plainTextFieldValue(value, props.mode);

      function richTextField(value: string): string | null | undefined {
        return richTextFieldValue(value, props.mode);
      }

      const lengthError = findOverLongRichTextField(
        [["Cannibalization notes", cannibalizationNotes]],
        LONG_TEXT_MAX_LENGTH,
      );
      if (lengthError) {
        setError(lengthError);
        return;
      }

      function parseIntegerField(
        raw: string,
        label: string,
        min: number,
        max: number | null,
      ): { readonly value: number | null | undefined; readonly error: string | null } {
        const trimmed = raw.trim();
        if (!trimmed) {
          return { value: props.mode === "create" ? undefined : null, error: null };
        }
        const parsed = Number(trimmed);
        if (!Number.isInteger(parsed) || parsed < min || (max !== null && parsed > max)) {
          return {
            value: undefined,
            error:
              max !== null
                ? `${label} must be a whole number between ${min} and ${max}.`
                : `${label} must be a whole number of at least ${min}.`,
          };
        }
        return { value: parsed, error: null };
      }

      const searchVolumeResult = parseIntegerField(searchVolume, "Search volume", 0, null);
      if (searchVolumeResult.error) {
        setError(searchVolumeResult.error);
        return;
      }
      const difficultyScoreResult = parseIntegerField(difficultyScore, "Difficulty score", 0, 100);
      if (difficultyScoreResult.error) {
        setError(difficultyScoreResult.error);
        return;
      }

      const sharedFields = {
        queryText: trimmedQueryText,
        keywordType: plainTextField(keywordType),
        intent: plainTextField(intent),
        funnelStage: plainTextField(funnelStage),
        country: plainTextField(country),
        searchVolume: searchVolumeResult.value,
        difficultyScore: difficultyScoreResult.value,
        source: plainTextField(source),
        researchDate: plainTextField(researchDate),
        cannibalizationNotes: richTextField(cannibalizationNotes),
        confidence: confidence === "" ? (props.mode === "create" ? undefined : null) : confidence,
      };

      const payload =
        props.mode === "create" ? { ...sharedFields, publicId: publicId.trim() } : sharedFields;

      const url =
        props.mode === "create"
          ? `${getApiBaseUrl()}/keyword-and-entity-library/projects/${props.projectId}/keywords`
          : `${getApiBaseUrl()}/keyword-and-entity-library/projects/${props.projectId}/keywords/${props.keywordId}/update`;

      const response = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        setError(await parseApiErrorMessage(response));
        return;
      }

      const keywordId =
        props.mode === "create"
          ? ((await response.json()) as { data: { id: string } }).data.id
          : props.keywordId;
      router.push(withProjectId(`/keyword-and-entity-library/${keywordId}`, props.projectId));
    } catch (err) {
      console.error("Failed to save keyword", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <fieldset className={styles.fieldset}>
        <legend className={styles.fieldsetLegend}>Identity</legend>

        {props.mode === "create" ? (
          <div className={styles.field}>
            <label htmlFor="publicId" className={styles.label}>
              Public ID
            </label>
            <input
              id="publicId"
              type="text"
              required
              maxLength={PUBLIC_ID_MAX_LENGTH}
              value={publicId}
              onChange={(event) => setPublicId(event.target.value)}
              className={styles.input}
            />
            <span className={styles.helperText}>
              A stable, human-readable identifier — never regenerated once assigned.
            </span>
          </div>
        ) : (
          <div className={styles.field}>
            <span className={styles.label}>Public ID</span>
            <span className={styles.readonlyValue}>{props.initial.publicId}</span>
          </div>
        )}

        <div className={styles.field}>
          <label htmlFor="queryText" className={styles.label}>
            Query text
          </label>
          <input
            id="queryText"
            type="text"
            required
            maxLength={QUERY_TEXT_MAX_LENGTH}
            value={queryText}
            onChange={(event) => setQueryText(event.target.value)}
            className={styles.input}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="keywordType" className={styles.label}>
            Keyword type
          </label>
          <input
            id="keywordType"
            type="text"
            maxLength={SHORT_TEXT_MAX_LENGTH}
            value={keywordType}
            onChange={(event) => setKeywordType(event.target.value)}
            className={styles.input}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="intent" className={styles.label}>
            Intent
          </label>
          <input
            id="intent"
            type="text"
            maxLength={SHORT_TEXT_MAX_LENGTH}
            value={intent}
            onChange={(event) => setIntent(event.target.value)}
            className={styles.input}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="funnelStage" className={styles.label}>
            Funnel stage
          </label>
          <input
            id="funnelStage"
            type="text"
            maxLength={SHORT_TEXT_MAX_LENGTH}
            value={funnelStage}
            onChange={(event) => setFunnelStage(event.target.value)}
            className={styles.input}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="country" className={styles.label}>
            Country
          </label>
          <input
            id="country"
            type="text"
            maxLength={SHORT_TEXT_MAX_LENGTH}
            value={country}
            onChange={(event) => setCountry(event.target.value)}
            className={styles.input}
          />
        </div>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend className={styles.fieldsetLegend}>Metrics</legend>

        <div className={styles.field}>
          <label htmlFor="searchVolume" className={styles.label}>
            Search volume
          </label>
          <input
            id="searchVolume"
            type="number"
            min={0}
            step={1}
            value={searchVolume}
            onChange={(event) => setSearchVolume(event.target.value)}
            className={styles.input}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="difficultyScore" className={styles.label}>
            Difficulty score
          </label>
          <input
            id="difficultyScore"
            type="number"
            min={0}
            max={100}
            step={1}
            value={difficultyScore}
            onChange={(event) => setDifficultyScore(event.target.value)}
            className={styles.input}
          />
          <span className={styles.helperText}>A whole number from 0 to 100.</span>
        </div>

        <div className={styles.field}>
          <label htmlFor="source" className={styles.label}>
            Source
          </label>
          <input
            id="source"
            type="text"
            maxLength={SOURCE_MAX_LENGTH}
            value={source}
            onChange={(event) => setSource(event.target.value)}
            className={styles.input}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="researchDate" className={styles.label}>
            Research date
          </label>
          <input
            id="researchDate"
            type="date"
            value={researchDate}
            onChange={(event) => setResearchDate(event.target.value)}
            className={styles.input}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="confidence" className={styles.label}>
            Confidence
          </label>
          <select
            id="confidence"
            value={confidence}
            onChange={(event) => setConfidence(event.target.value as KeywordConfidence | "")}
            className={styles.select}
          >
            <option value="">Not set</option>
            {CONFIDENCE_VALUES.map((value) => (
              <option key={value} value={value}>
                {CONFIDENCE_LABEL[value]}
              </option>
            ))}
          </select>
        </div>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend className={styles.fieldsetLegend}>Cannibalization notes</legend>
        <div className={styles.field}>
          <label htmlFor="cannibalizationNotes" className={styles.label}>
            Notes
          </label>
          <RichTextEditor
            id="cannibalizationNotes"
            value={cannibalizationNotes}
            onChange={setCannibalizationNotes}
          />
        </div>
      </fieldset>

      {error ? (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      ) : null}

      <div className={styles.actions}>
        <button type="submit" disabled={submitting} className={styles.submitButton}>
          {submitting ? "Saving…" : props.mode === "create" ? "Create keyword" : "Save changes"}
        </button>
        <a
          href={
            props.mode === "create"
              ? withProjectId("/keyword-and-entity-library", props.projectId)
              : withProjectId(`/keyword-and-entity-library/${props.keywordId}`, props.projectId)
          }
          className={styles.cancelLink}
        >
          Cancel
        </a>
      </div>
    </form>
  );
}
