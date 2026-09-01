"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import type { WorkflowTaskTemplate } from "@webdesk/shared-types";
import { postMutation } from "@/lib/api-errors";
import { getApiBaseUrl } from "@/lib/auth";
import { plainTextFieldValue } from "@/lib/form-field-value";
import { findOverLongRichTextField, richTextFieldValue } from "@/lib/rich-text";
import {
  TEMPLATE_TYPE_LABEL,
  TEMPLATE_TYPE_VALUES,
} from "@/lib/workflow-and-task-template-library-query";
import { RichTextEditor } from "./rich-text-editor";
import styles from "./workflow-task-template-form.module.css";

// Mirrors apps/dashboard-api/src/workflow-and-task-template-library/workflow-and-task-template-library.dto.ts
// — kept in sync by hand, same approach BrandLibraryForm/ContentTemplateLibraryForm/
// PersonaLibraryForm/ServiceLibraryForm all use.
const PUBLIC_ID_MAX_LENGTH = 64;
const TITLE_MAX_LENGTH = 255;
const AUTHORIZED_STAGE_MAX_LENGTH = 255;
const AGENT_ASSIGNMENT_MAX_LENGTH = 255;
const REQUIRED_APPROVALS_MAX_LENGTH = 500;
const LONG_TEXT_MAX_LENGTH = 8000;

export type WorkflowTaskTemplateFormProps =
  | { readonly mode: "create" }
  | { readonly mode: "edit"; readonly templateId: string; readonly initial: WorkflowTaskTemplate };

/**
 * Create/edit form for a workflow/task template (`03_Detailed_Module_Specifications.md §29`'s own
 * field list — no approved wireframe/screen spec exists for this module, matching the Brand/
 * Content Template/Persona/Service Library form pages' own "smallest honest reading" precedent for
 * an unsourced screen). `approvalStatus`/`version` are deliberately never fields here —
 * `approvalStatus` only changes via the dedicated `POST .../:id/status` route
 * (`WorkflowTaskTemplateStatusActions`), and `version` is server-managed. `publicId` and
 * `templateType` are both create-only (shown read-only on edit, matching
 * `updateWorkflowTaskTemplateSchema`'s own `.omit({publicId, templateType})` contract, mirroring
 * `BrandLibraryForm`/`ServiceLibraryForm`/`PersonaLibraryForm`'s own precedent for a create-only
 * field).
 *
 * `requiredInputs`/`expectedOutputs`/`restrictions`/`validationCriteria` use `RichTextEditor`
 * (Tiptap), per the 2026-08-22 standing rule requiring every dashboard-web long-text field to use
 * the rich-text editor going forward. The resulting HTML is sanitized server-side before it's ever
 * stored (`workflow-and-task-template-library.service.ts`'s `sanitizeNullableRichText()`/
 * `sanitizeNullableRichTextIfChanged()`) and again at render time on the detail page, the same
 * double-sanitization pattern every sibling module's own rich-text fields already establish.
 * `authorizedStage`/`agentAssignment`/`requiredApprovals` stay plain text — short descriptive
 * fields, matching how `title`/`name` never convert anywhere in this codebase.
 *
 * Submits via a direct browser `fetch()` with `credentials: "include"` — required for
 * `dashboard-api`'s `OriginCheckGuard` to see a real browser `Origin` header, the same pattern
 * `ProjectForm`/`PersonaLibraryForm`/`ServiceLibraryForm`/`BrandLibraryForm` already use.
 */
export function WorkflowTaskTemplateForm(props: WorkflowTaskTemplateFormProps): ReactNode {
  const router = useRouter();
  const initial = props.mode === "edit" ? props.initial : null;

  const [publicId, setPublicId] = useState(initial?.publicId ?? "");
  const [templateType, setTemplateType] = useState(initial?.templateType ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [authorizedStage, setAuthorizedStage] = useState(initial?.authorizedStage ?? "");
  const [requiredInputs, setRequiredInputs] = useState(initial?.requiredInputs ?? "");
  const [expectedOutputs, setExpectedOutputs] = useState(initial?.expectedOutputs ?? "");
  const [restrictions, setRestrictions] = useState(initial?.restrictions ?? "");
  const [agentAssignment, setAgentAssignment] = useState(initial?.agentAssignment ?? "");
  const [validationCriteria, setValidationCriteria] = useState(initial?.validationCriteria ?? "");
  const [requiredApprovals, setRequiredApprovals] = useState(initial?.requiredApprovals ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      // title/authorizedStage/templateType are real HTML `required` fields — the browser's own
      // constraint validation blocks a submit event from ever firing while any is empty, so no
      // redundant JS-level check is needed for them here, matching ProjectForm/
      // PersonaLibraryForm's own precedent.
      const trimmedTitle = title.trim();
      const trimmedAuthorizedStage = authorizedStage.trim();

      // richTextFieldValue()/plainTextFieldValue() carry the actual nullish-contract logic, shared
      // with brand-library-form.tsx/content-template-library-form.tsx/persona-library-form.tsx/
      // service-library-form.tsx.
      function richTextField(value: string): string | null | undefined {
        return richTextFieldValue(value, props.mode);
      }
      function plainField(value: string): string | null | undefined {
        return plainTextFieldValue(value, props.mode);
      }

      const richTextFields: ReadonlyArray<readonly [string, string]> = [
        ["Required inputs", requiredInputs],
        ["Expected outputs", expectedOutputs],
        ["Restrictions", restrictions],
        ["Validation criteria", validationCriteria],
      ];
      const lengthError = findOverLongRichTextField(richTextFields, LONG_TEXT_MAX_LENGTH);
      if (lengthError) {
        setError(lengthError);
        return;
      }

      const sharedFields = {
        title: trimmedTitle,
        authorizedStage: trimmedAuthorizedStage,
        requiredInputs: richTextField(requiredInputs),
        expectedOutputs: richTextField(expectedOutputs),
        restrictions: richTextField(restrictions),
        agentAssignment: plainField(agentAssignment),
        validationCriteria: richTextField(validationCriteria),
        requiredApprovals: plainField(requiredApprovals),
      };

      const payload =
        props.mode === "create"
          ? { ...sharedFields, publicId: publicId.trim(), templateType }
          : sharedFields;

      const url =
        props.mode === "create"
          ? `${getApiBaseUrl()}/workflow-and-task-template-library/templates`
          : `${getApiBaseUrl()}/workflow-and-task-template-library/templates/${props.templateId}/update`;

      const result = await postMutation<{ id: string }>(url, payload);
      if (!result.ok) {
        setError(result.message);
        return;
      }

      router.push(`/workflow-and-task-template-library/${result.data.id}`);
    } catch (err) {
      console.error("Failed to save workflow task template", err);
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

        {props.mode === "create" ? (
          <div className={styles.field}>
            <label htmlFor="templateType" className={styles.label}>
              Template type
            </label>
            <select
              id="templateType"
              required
              value={templateType}
              onChange={(event) => setTemplateType(event.target.value)}
              className={styles.select}
            >
              <option value="" disabled>
                Select a template type…
              </option>
              {TEMPLATE_TYPE_VALUES.map((value) => (
                <option key={value} value={value}>
                  {TEMPLATE_TYPE_LABEL[value]}
                </option>
              ))}
            </select>
            <span className={styles.helperText}>
              Immutable once created — changing it would be a different record.
            </span>
          </div>
        ) : (
          <div className={styles.field}>
            <span className={styles.label}>Template type</span>
            <span className={styles.readonlyValue}>
              {TEMPLATE_TYPE_LABEL[props.initial.templateType]}
            </span>
          </div>
        )}

        <div className={styles.field}>
          <label htmlFor="title" className={styles.label}>
            Title
          </label>
          <input
            id="title"
            type="text"
            required
            maxLength={TITLE_MAX_LENGTH}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className={styles.input}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="authorizedStage" className={styles.label}>
            Authorized stage
          </label>
          <input
            id="authorizedStage"
            type="text"
            required
            maxLength={AUTHORIZED_STAGE_MAX_LENGTH}
            value={authorizedStage}
            onChange={(event) => setAuthorizedStage(event.target.value)}
            className={styles.input}
          />
          <span className={styles.helperText}>
            The workflow stage this template is authorized to be used at.
          </span>
        </div>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend className={styles.fieldsetLegend}>Task details</legend>

        <div className={styles.field}>
          <label htmlFor="requiredInputs" className={styles.label}>
            Required inputs
          </label>
          <RichTextEditor id="requiredInputs" value={requiredInputs} onChange={setRequiredInputs} />
        </div>

        <div className={styles.field}>
          <label htmlFor="expectedOutputs" className={styles.label}>
            Expected outputs
          </label>
          <RichTextEditor
            id="expectedOutputs"
            value={expectedOutputs}
            onChange={setExpectedOutputs}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="restrictions" className={styles.label}>
            Restrictions
          </label>
          <RichTextEditor id="restrictions" value={restrictions} onChange={setRestrictions} />
          <span className={styles.helperText}>
            Descriptive only — never read by any status-transition or execution gate. A template
            cannot authorize execution by itself.
          </span>
        </div>

        <div className={styles.field}>
          <label htmlFor="validationCriteria" className={styles.label}>
            Validation criteria
          </label>
          <RichTextEditor
            id="validationCriteria"
            value={validationCriteria}
            onChange={setValidationCriteria}
          />
        </div>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend className={styles.fieldsetLegend}>Governance</legend>

        <div className={styles.field}>
          <label htmlFor="agentAssignment" className={styles.label}>
            Agent assignment
          </label>
          <input
            id="agentAssignment"
            type="text"
            maxLength={AGENT_ASSIGNMENT_MAX_LENGTH}
            value={agentAssignment}
            onChange={(event) => setAgentAssignment(event.target.value)}
            className={styles.input}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="requiredApprovals" className={styles.label}>
            Required approvals
          </label>
          <input
            id="requiredApprovals"
            type="text"
            maxLength={REQUIRED_APPROVALS_MAX_LENGTH}
            value={requiredApprovals}
            onChange={(event) => setRequiredApprovals(event.target.value)}
            className={styles.input}
          />
          <span className={styles.helperText}>
            Plain descriptive text (e.g. &quot;requires QA sign-off before release&quot;) — never
            wired to any automatic status transition.
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
          {submitting ? "Saving…" : props.mode === "create" ? "Create template" : "Save changes"}
        </button>
        <a
          href={
            props.mode === "create"
              ? "/workflow-and-task-template-library"
              : `/workflow-and-task-template-library/${props.templateId}`
          }
          className={styles.cancelLink}
        >
          Cancel
        </a>
      </div>
    </form>
  );
}
