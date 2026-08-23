"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import type {
  Page,
  PageClassification,
  PageExistingOrProposed,
  PageIndexStatus,
} from "@webdesk/shared-types";
import { parseApiErrorMessage } from "@/lib/api-errors";
import { getApiBaseUrl } from "@/lib/auth";
import { plainTextFieldValue } from "@/lib/form-field-value";
import {
  CLASSIFICATION_LABEL,
  CLASSIFICATION_VALUES,
  EXISTING_OR_PROPOSED_LABEL,
  EXISTING_OR_PROPOSED_VALUES,
  INDEX_STATUS_LABEL,
  INDEX_STATUS_VALUES,
  // `withProjectId` deliberately imported from THIS zero-non-type-import file, not
  // `@/lib/page-inventory` (which re-exports it but pulls in `next/headers` via its own
  // `getPages`/`getPage`/`getPageUrls` — the exact client-bundle trap this codebase's own
  // Cautions section already documents once, for `formatTimestamp`).
  withProjectId,
} from "@/lib/page-inventory-query";
import styles from "./page-form.module.css";

// Mirrors apps/dashboard-api/src/page-inventory/page-inventory.dto.ts — kept in sync by hand, same
// approach ProjectForm/ServiceLibraryForm/PersonaLibraryForm/WebsiteStrategyCenterForm all use.
const PUBLIC_ID_MAX_LENGTH = 64;
const PAGE_NAME_MAX_LENGTH = 20_000;
const SHORT_TEXT_MAX_LENGTH = 255;
const REPOSITORY_FILES_MAX_LENGTH = 20_000;

export type PageFormProps =
  | { readonly mode: "create"; readonly projectId: string }
  | {
      readonly mode: "edit";
      readonly projectId: string;
      readonly pageId: string;
      readonly initial: Page;
    };

/**
 * Create/edit form for a Page Inventory record. No approved wireframe field-level spec exists for
 * this screen beyond `07_Low_Fidelity_Wireframes.md §2`'s own column list — this is the smallest
 * honest reading of the backend's actual field set
 * (`apps/dashboard-api/src/page-inventory/page-inventory.dto.ts`), matching every sibling module's
 * own precedent for an unsourced screen.
 *
 * `publicId` is create-only (shown read-only on edit, matching every sibling form's own
 * `publicId`/`recordType` convention). `workflowStage` is deliberately never a field here — only the
 * dedicated `POST .../workflow-stage` route (`PageStatusActions`) may change it, matching
 * `updatePageSchema`'s own contract.
 *
 * `roadmapPhaseId` is a plain text (raw UUID) input, not a picker — no roadmap-item picker/search
 * capability exists anywhere in this app yet (the same constraint that already kept Projects' own
 * `ownerUserId`/Service Library's own `parentServiceId` out of their forms until a picker existed).
 * The backend validates it against the same project's own `roadmap_items` on submit
 * (`PagesService.assertRoadmapPhaseExists()`), so an invalid id surfaces as a real, visible error
 * rather than a silent no-op.
 *
 * `repositoryFiles` is a PLAIN `<textarea>`, deliberately NOT `RichTextEditor` — the one field on
 * this form that diverges from the 2026-08-22 standing "every dashboard-web long-text field uses the
 * rich-text editor" rule. This is almost certainly a list of file paths/references (the field's own
 * name and `04_Data_Model_and_Ownership.md`'s "repo files" label), not narrative prose meant to carry
 * bold/italic/link formatting, and the backend's own `updatePageSchema`/`createPageSchema` store it
 * as unsanitized plain text with no HTML-sanitization pass on either side — treating it as rich text
 * here would mean silently storing raw Tiptap-generated HTML markup around what a reader expects to
 * be literal file paths. A deliberate, reasoned scoping decision, not an oversight.
 *
 * Submits via a direct browser `fetch()` with `credentials: "include"` — required for
 * `dashboard-api`'s `OriginCheckGuard` to see a real browser `Origin` header, the same pattern every
 * mutation form in this app already uses. `projectId` is always a prop (never a form field) — pages
 * are project-scoped, and the project id is threaded into both the submit URL and the post-submit
 * redirect, never derived from the form's own fields.
 */
export function PageForm(props: PageFormProps): ReactNode {
  const router = useRouter();
  const initial = props.mode === "edit" ? props.initial : null;

  const [publicId, setPublicId] = useState(initial?.publicId ?? "");
  const [pageName, setPageName] = useState(initial?.pageName ?? "");
  const [pageType, setPageType] = useState(initial?.pageType ?? "");
  const [existingOrProposed, setExistingOrProposed] = useState<PageExistingOrProposed>(
    initial?.existingOrProposed ?? "proposed",
  );
  const [indexStatus, setIndexStatus] = useState<PageIndexStatus>(
    initial?.indexStatus ?? "unknown",
  );
  const [template, setTemplate] = useState(initial?.template ?? "");
  const [roadmapPhaseId, setRoadmapPhaseId] = useState(initial?.roadmapPhaseId ?? "");
  const [targetKeyword, setTargetKeyword] = useState(initial?.targetKeyword ?? "");
  const [designVersion, setDesignVersion] = useState(initial?.designVersion ?? "");
  const [repositoryFiles, setRepositoryFiles] = useState(initial?.repositoryFiles ?? "");
  const [wordpressPageId, setWordpressPageId] = useState(initial?.wordpressPageId ?? "");
  const [wordpressPostId, setWordpressPostId] = useState(initial?.wordpressPostId ?? "");
  const [lastScanAt, setLastScanAt] = useState(initial?.lastScanAt ?? "");
  const [lastDeploymentAt, setLastDeploymentAt] = useState(initial?.lastDeploymentAt ?? "");
  const [classification, setClassification] = useState<PageClassification | "">(
    initial?.classification ?? "",
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      // pageName is a real HTML `required` field — the browser's own constraint validation blocks
      // a submit event from ever firing while it's empty, so no redundant JS-level check is needed
      // here, matching ProjectForm/ServiceLibraryForm/WebsiteStrategyCenterForm's own precedent.
      const trimmedPageName = pageName.trim();

      // Plain-text fields: omitted entirely (create) or sent as an explicit null (edit) when
      // empty — same nullish contract every sibling form's own plainTextField()/textField()
      // establishes, now shared via lib/form-field-value.ts (code-review finding: this was a
      // 4th independent hand-copy of the identical helper, past the 2-copy extraction threshold
      // already applied to the rich-text variant).
      const plainTextField = (value: string): string | null | undefined =>
        plainTextFieldValue(value, props.mode);

      const sharedFields = {
        pageName: trimmedPageName,
        pageType: plainTextField(pageType),
        existingOrProposed,
        indexStatus,
        template: plainTextField(template),
        roadmapPhaseId: plainTextField(roadmapPhaseId),
        targetKeyword: plainTextField(targetKeyword),
        designVersion: plainTextField(designVersion),
        repositoryFiles: plainTextField(repositoryFiles),
        wordpressPageId: plainTextField(wordpressPageId),
        wordpressPostId: plainTextField(wordpressPostId),
        // date-only <input type="date"> already yields "" or "YYYY-MM-DD" — the same nullish
        // contract applies, so this reuses the shared helper too rather than re-deriving it.
        lastScanAt: plainTextField(lastScanAt),
        lastDeploymentAt: plainTextField(lastDeploymentAt),
        classification: plainTextField(classification),
      };

      const payload =
        props.mode === "create" ? { ...sharedFields, publicId: publicId.trim() } : sharedFields;

      const url =
        props.mode === "create"
          ? `${getApiBaseUrl()}/page-inventory/projects/${props.projectId}/pages`
          : `${getApiBaseUrl()}/page-inventory/projects/${props.projectId}/pages/${props.pageId}/update`;

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

      const pageId =
        props.mode === "create"
          ? ((await response.json()) as { data: { id: string } }).data.id
          : props.pageId;
      router.push(withProjectId(`/page-inventory/${pageId}`, props.projectId));
    } catch (err) {
      console.error("Failed to save page", err);
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
          <label htmlFor="pageName" className={styles.label}>
            Page name
          </label>
          <input
            id="pageName"
            type="text"
            required
            maxLength={PAGE_NAME_MAX_LENGTH}
            value={pageName}
            onChange={(event) => setPageName(event.target.value)}
            className={styles.input}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="pageType" className={styles.label}>
            Page type
          </label>
          <input
            id="pageType"
            type="text"
            maxLength={SHORT_TEXT_MAX_LENGTH}
            value={pageType}
            onChange={(event) => setPageType(event.target.value)}
            className={styles.input}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="existingOrProposed" className={styles.label}>
            Existing / Proposed
          </label>
          <select
            id="existingOrProposed"
            value={existingOrProposed}
            onChange={(event) =>
              setExistingOrProposed(event.target.value as PageExistingOrProposed)
            }
            className={styles.select}
          >
            {EXISTING_OR_PROPOSED_VALUES.map((value) => (
              <option key={value} value={value}>
                {EXISTING_OR_PROPOSED_LABEL[value]}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label htmlFor="indexStatus" className={styles.label}>
            Index status
          </label>
          <select
            id="indexStatus"
            value={indexStatus}
            onChange={(event) => setIndexStatus(event.target.value as PageIndexStatus)}
            className={styles.select}
          >
            {INDEX_STATUS_VALUES.map((value) => (
              <option key={value} value={value}>
                {INDEX_STATUS_LABEL[value]}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label htmlFor="template" className={styles.label}>
            Template
          </label>
          <input
            id="template"
            type="text"
            maxLength={SHORT_TEXT_MAX_LENGTH}
            value={template}
            onChange={(event) => setTemplate(event.target.value)}
            className={styles.input}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="roadmapPhaseId" className={styles.label}>
            Roadmap phase ID
          </label>
          <input
            id="roadmapPhaseId"
            type="text"
            value={roadmapPhaseId}
            onChange={(event) => setRoadmapPhaseId(event.target.value)}
            className={styles.input}
          />
          <span className={styles.helperText}>
            The raw ID of a roadmap item on this same project — no picker exists yet. Validated on
            submit; an unknown or cross-project ID is rejected with a clear error.
          </span>
        </div>

        <div className={styles.field}>
          <label htmlFor="classification" className={styles.label}>
            Classification
          </label>
          <select
            id="classification"
            value={classification}
            onChange={(event) => setClassification(event.target.value as PageClassification | "")}
            className={styles.select}
          >
            <option value="">Not set</option>
            {CLASSIFICATION_VALUES.map((value) => (
              <option key={value} value={value}>
                {CLASSIFICATION_LABEL[value]}
              </option>
            ))}
          </select>
          <span className={styles.helperText}>
            Roadmap-sourced only, not spec-sourced — no governance/workflow attached.
          </span>
        </div>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend className={styles.fieldsetLegend}>SEO &amp; design</legend>

        <div className={styles.field}>
          <label htmlFor="targetKeyword" className={styles.label}>
            Target keyword
          </label>
          <input
            id="targetKeyword"
            type="text"
            maxLength={SHORT_TEXT_MAX_LENGTH}
            value={targetKeyword}
            onChange={(event) => setTargetKeyword(event.target.value)}
            className={styles.input}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="designVersion" className={styles.label}>
            Design version
          </label>
          <input
            id="designVersion"
            type="text"
            maxLength={SHORT_TEXT_MAX_LENGTH}
            value={designVersion}
            onChange={(event) => setDesignVersion(event.target.value)}
            className={styles.input}
          />
        </div>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend className={styles.fieldsetLegend}>Scan &amp; deployment</legend>

        <div className={styles.field}>
          <label htmlFor="lastScanAt" className={styles.label}>
            Last scan date
          </label>
          <input
            id="lastScanAt"
            type="date"
            value={lastScanAt}
            onChange={(event) => setLastScanAt(event.target.value)}
            className={styles.input}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="lastDeploymentAt" className={styles.label}>
            Last deployment date
          </label>
          <input
            id="lastDeploymentAt"
            type="date"
            value={lastDeploymentAt}
            onChange={(event) => setLastDeploymentAt(event.target.value)}
            className={styles.input}
          />
        </div>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend className={styles.fieldsetLegend}>WordPress references</legend>

        <div className={styles.field}>
          <label htmlFor="wordpressPageId" className={styles.label}>
            WordPress page ID
          </label>
          <input
            id="wordpressPageId"
            type="text"
            maxLength={SHORT_TEXT_MAX_LENGTH}
            value={wordpressPageId}
            onChange={(event) => setWordpressPageId(event.target.value)}
            className={styles.input}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="wordpressPostId" className={styles.label}>
            WordPress post ID
          </label>
          <input
            id="wordpressPostId"
            type="text"
            maxLength={SHORT_TEXT_MAX_LENGTH}
            value={wordpressPostId}
            onChange={(event) => setWordpressPostId(event.target.value)}
            className={styles.input}
          />
        </div>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend className={styles.fieldsetLegend}>Repository files</legend>
        <div className={styles.field}>
          <label htmlFor="repositoryFiles" className={styles.label}>
            Repository files
          </label>
          {/* Deliberately a plain <textarea>, not RichTextEditor — see this component's own top
              doc comment for the full reasoning. */}
          <textarea
            id="repositoryFiles"
            rows={6}
            maxLength={REPOSITORY_FILES_MAX_LENGTH}
            value={repositoryFiles}
            onChange={(event) => setRepositoryFiles(event.target.value)}
            className={styles.textarea}
          />
          <span className={styles.helperText}>
            Plain text (e.g. a list of file paths/references) — not rich text.
          </span>
        </div>
      </fieldset>

      {error ? (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      ) : null}

      <div className={styles.actions}>
        <button type="submit" disabled={submitting} className={styles.submitButton}>
          {submitting ? "Saving…" : props.mode === "create" ? "Create page" : "Save changes"}
        </button>
        <a
          href={
            props.mode === "create"
              ? withProjectId("/page-inventory", props.projectId)
              : withProjectId(`/page-inventory/${props.pageId}`, props.projectId)
          }
          className={styles.cancelLink}
        >
          Cancel
        </a>
      </div>
    </form>
  );
}
