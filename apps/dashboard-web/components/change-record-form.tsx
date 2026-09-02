"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import type {
  ChangeRecord,
  ChangeRecordCategory,
  ChangeRecordSeverity,
  ModuleRegistrySummary,
  UserSummary,
} from "@webdesk/shared-types";
import { parseApiErrorMessage } from "@/lib/api-errors";
import { getApiBaseUrl } from "@/lib/auth";
import {
  CATEGORY_LABEL,
  CATEGORY_VALUES,
  SEVERITY_LABEL,
  SEVERITY_VALUES,
  withProjectId,
} from "@/lib/change-center-query";
import { plainTextFieldValue } from "@/lib/form-field-value";
import { isUuid } from "@/lib/uuid";
import { UserPicker } from "./user-picker";
import styles from "./change-record-form.module.css";

// Mirrors apps/dashboard-api/src/change-center/change-center.dto.ts — kept in sync by hand, same
// approach every sibling form in this app uses.
const PUBLIC_ID_MAX_LENGTH = 64;
const SOURCE_MAX_LENGTH = 255;
const RECORD_LABEL_MAX_LENGTH = 500;
const LONG_VALUE_MAX_LENGTH = 20_000;

export type ChangeRecordFormProps =
  | {
      readonly mode: "create";
      readonly projectId: string;
      readonly modules: readonly ModuleRegistrySummary[];
    }
  | {
      readonly mode: "edit";
      readonly projectId: string;
      readonly recordId: string;
      readonly initial: ChangeRecord;
      readonly modules: readonly ModuleRegistrySummary[];
      /** Already resolved to a display summary by the edit page's own server-side `getUser()`
       *  call — this form never resolves an id to a name itself, mirroring `ProjectForm`'s own
       *  `owner`/`ownerUserId` split. `null` covers both "not assigned" and "the assigned user id
       *  no longer resolves" (disabled/removed) identically. */
      readonly initialAssignee: UserSummary | null;
    };

/**
 * Create/edit form for a Change Center record. No approved wireframe/screen-level spec exists for
 * this module — `packages/database/src/change-center/entities.ts`'s own field list plus the
 * backend's actual `createChangeRecordSchema`/`updateChangeRecordSchema`
 * (`apps/dashboard-api/src/change-center/change-center.dto.ts`) is the only source, matching every
 * sibling module's own "smallest honest reading" precedent for an unsourced screen.
 *
 * `publicId`/`category` are create-only (shown read-only on edit, matching every sibling form's
 * own immutable-discriminator-field convention). `status`/`rollbackGuidance` are deliberately
 * never fields here — only the dedicated `POST .../status` route (`ChangeRecordStatusActions`)
 * may change either. `severity`, unlike `category`, IS editable — a triager may correct an
 * initially miscategorized severity before the record is decided (mirrors the backend's own DTO
 * doc comment).
 *
 * `beforeValue`/`afterValue`/`recommendation`/`decisionNotes` stay plain `<textarea>`s, NOT
 * `RichTextEditor` — this module was deliberately excluded from the 2026-08-22 rich-text-editor
 * standing rule, since the backend DTO stores these fields as raw detected/proposed data (a
 * version string, a config diff snippet, a URL), not prose, and the backend never sanitizes them.
 *
 * `targetModuleKey` is a `<select>` sourced from `session.navigation` (the create page's own
 * server-fetched `modules` prop) rather than a dedicated `GET /authz/module-registry` fetch —
 * mirrors `ReviewForm`'s own identical reasoning (that endpoint is gated on `users_roles:view`,
 * held by only 2 of 7 seeded roles). `targetId` is a plain, client-side UUID-format-checked text
 * input, not a picker — no generic cross-module record-lookup capability exists anywhere in this
 * app, matching `ReviewForm`'s own identical D6-style design. Both must be provided together, or
 * both omitted — checked client-side before submit; the backend independently re-validates the
 * same pairing invariant server-side.
 *
 * `scanFindingId` is likewise a plain, UUID-format-checked text input, not a picker — no
 * `dashboard-web` UI exists yet for Scan Center, so there is nothing to pick from.
 *
 * Submits via a direct browser `fetch()` with `credentials: "include"` — required for
 * `dashboard-api`'s `OriginCheckGuard` to see a real browser `Origin` header, the same pattern
 * every mutation form in this app already uses. `projectId` is always a prop (never a form
 * field) — change records are project-scoped, and the project id is threaded into both the submit
 * URL and the post-submit redirect, never derived from the form's own fields.
 */
export function ChangeRecordForm(props: ChangeRecordFormProps): ReactNode {
  const router = useRouter();
  const initial = props.mode === "edit" ? props.initial : null;

  const [publicId, setPublicId] = useState(initial?.publicId ?? "");
  const [category, setCategory] = useState<ChangeRecordCategory>(initial?.category ?? "theme");
  const [severity, setSeverity] = useState<ChangeRecordSeverity>(initial?.severity ?? "medium");
  const [scanFindingId, setScanFindingId] = useState(initial?.scanFindingId ?? "");
  const [source, setSource] = useState(initial?.source ?? "");
  const [targetModuleKey, setTargetModuleKey] = useState(initial?.targetModuleKey ?? "");
  const [targetId, setTargetId] = useState(initial?.targetId ?? "");
  const [recordLabel, setRecordLabel] = useState(initial?.recordLabel ?? "");
  const [beforeValue, setBeforeValue] = useState(initial?.beforeValue ?? "");
  const [afterValue, setAfterValue] = useState(initial?.afterValue ?? "");
  const [confidence, setConfidence] = useState(
    initial?.confidence != null ? String(initial.confidence) : "",
  );
  const [recommendation, setRecommendation] = useState(initial?.recommendation ?? "");
  const [assignee, setAssignee] = useState<UserSummary | null>(
    props.mode === "edit" ? props.initialAssignee : null,
  );
  // Tracks whether the user actually interacted with the assignee picker — as opposed to
  // `assignee` simply being `null` because the initial assignee id couldn't be resolved to a
  // display summary (disabled/removed account). Only an explicit interaction should ever change
  // what gets submitted for assignedToUserId, mirroring ProjectForm's own ownerTouched.
  const [assigneeTouched, setAssigneeTouched] = useState(false);
  const [decisionNotes, setDecisionNotes] = useState(initial?.decisionNotes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function handleAssigneeChange(next: UserSummary | null): void {
    setAssignee(next);
    setAssigneeTouched(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);

    const trimmedScanFindingId = scanFindingId.trim();
    if (trimmedScanFindingId && !isUuid(trimmedScanFindingId)) {
      setError("Scan finding ID must be a valid UUID.");
      return;
    }
    const trimmedTargetId = targetId.trim();
    if (trimmedTargetId && !isUuid(trimmedTargetId)) {
      setError("Target ID must be a valid UUID.");
      return;
    }
    if ((targetModuleKey !== "") !== (trimmedTargetId !== "")) {
      setError("Target module and target ID must both be provided, or both left blank.");
      return;
    }
    let confidenceValue: number | null | undefined;
    if (confidence.trim() === "") {
      confidenceValue = props.mode === "create" ? undefined : null;
    } else {
      const parsed = Number.parseInt(confidence, 10);
      if (!Number.isInteger(parsed) || parsed < 0 || parsed > 100) {
        setError("Confidence must be a whole number between 0 and 100.");
        return;
      }
      confidenceValue = parsed;
    }

    setSubmitting(true);
    try {
      const plainTextField = (value: string): string | null | undefined =>
        plainTextFieldValue(value, props.mode);

      const sharedFields = {
        severity,
        scanFindingId: trimmedScanFindingId
          ? trimmedScanFindingId
          : props.mode === "create"
            ? undefined
            : null,
        source: plainTextField(source),
        targetModuleKey: targetModuleKey || (props.mode === "create" ? undefined : null),
        targetId: trimmedTargetId ? trimmedTargetId : props.mode === "create" ? undefined : null,
        recordLabel: recordLabel.trim(),
        beforeValue: plainTextField(beforeValue),
        afterValue: plainTextField(afterValue),
        confidence: confidenceValue,
        recommendation: plainTextField(recommendation),
        assignedToUserId: assigneeTouched
          ? (assignee?.id ?? null)
          : props.mode === "edit"
            ? props.initial.assignedToUserId
            : undefined,
        decisionNotes: plainTextField(decisionNotes),
      };

      const payload =
        props.mode === "create"
          ? { ...sharedFields, publicId: publicId.trim(), category }
          : sharedFields;

      const url =
        props.mode === "create"
          ? `${getApiBaseUrl()}/change-center/projects/${props.projectId}/records`
          : `${getApiBaseUrl()}/change-center/projects/${props.projectId}/records/${props.recordId}/update`;

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

      const recordId =
        props.mode === "create"
          ? ((await response.json()) as { data: { id: string } }).data.id
          : props.recordId;
      router.push(withProjectId(`/change-center/${recordId}`, props.projectId));
    } catch (err) {
      console.error("Failed to save change record", err);
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
          <>
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
            <div className={styles.field}>
              <label htmlFor="category" className={styles.label}>
                Category
              </label>
              <select
                id="category"
                value={category}
                onChange={(event) => setCategory(event.target.value as ChangeRecordCategory)}
                className={styles.select}
              >
                {CATEGORY_VALUES.map((value) => (
                  <option key={value} value={value}>
                    {CATEGORY_LABEL[value]}
                  </option>
                ))}
              </select>
              <span className={styles.helperText}>Immutable once created.</span>
            </div>
          </>
        ) : (
          <>
            <div className={styles.field}>
              <span className={styles.label}>Public ID</span>
              <span className={styles.readonlyValue}>{props.initial.publicId}</span>
            </div>
            <div className={styles.field}>
              <span className={styles.label}>Category</span>
              <span className={styles.readonlyValue}>{CATEGORY_LABEL[props.initial.category]}</span>
            </div>
          </>
        )}

        <div className={styles.field}>
          <label htmlFor="severity" className={styles.label}>
            Severity
          </label>
          <select
            id="severity"
            value={severity}
            onChange={(event) => setSeverity(event.target.value as ChangeRecordSeverity)}
            className={styles.select}
          >
            {SEVERITY_VALUES.map((value) => (
              <option key={value} value={value}>
                {SEVERITY_LABEL[value]}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label htmlFor="recordLabel" className={styles.label}>
            Record label
          </label>
          <input
            id="recordLabel"
            type="text"
            required
            maxLength={RECORD_LABEL_MAX_LENGTH}
            value={recordLabel}
            onChange={(event) => setRecordLabel(event.target.value)}
            className={styles.input}
          />
        </div>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend className={styles.fieldsetLegend}>Source</legend>

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
          <label htmlFor="scanFindingId" className={styles.label}>
            Scan finding ID
          </label>
          <input
            id="scanFindingId"
            type="text"
            value={scanFindingId}
            onChange={(event) => setScanFindingId(event.target.value)}
            className={styles.input}
          />
          <span className={styles.helperText}>
            Optional link to a Scan Center finding — not validated client-side, since no picker
            exists yet.
          </span>
        </div>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend className={styles.fieldsetLegend}>Content</legend>

        <div className={styles.field}>
          <label htmlFor="beforeValue" className={styles.label}>
            Before value
          </label>
          <textarea
            id="beforeValue"
            maxLength={LONG_VALUE_MAX_LENGTH}
            rows={4}
            value={beforeValue}
            onChange={(event) => setBeforeValue(event.target.value)}
            className={styles.textarea}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="afterValue" className={styles.label}>
            After value
          </label>
          <textarea
            id="afterValue"
            maxLength={LONG_VALUE_MAX_LENGTH}
            rows={4}
            value={afterValue}
            onChange={(event) => setAfterValue(event.target.value)}
            className={styles.textarea}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="confidence" className={styles.label}>
            Confidence
          </label>
          <input
            id="confidence"
            type="number"
            min={0}
            max={100}
            step={1}
            value={confidence}
            onChange={(event) => setConfidence(event.target.value)}
            className={styles.input}
          />
          <span className={styles.helperText}>0–100, optional.</span>
        </div>

        <div className={styles.field}>
          <label htmlFor="recommendation" className={styles.label}>
            Recommendation
          </label>
          <textarea
            id="recommendation"
            maxLength={LONG_VALUE_MAX_LENGTH}
            rows={4}
            value={recommendation}
            onChange={(event) => setRecommendation(event.target.value)}
            className={styles.textarea}
          />
        </div>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend className={styles.fieldsetLegend}>Target record</legend>

        <div className={styles.field}>
          <label htmlFor="targetModuleKey" className={styles.label}>
            Target module
          </label>
          <select
            id="targetModuleKey"
            value={targetModuleKey}
            onChange={(event) => setTargetModuleKey(event.target.value)}
            className={styles.select}
          >
            <option value="">Not linked to a specific record</option>
            {props.modules.map((module) => (
              <option key={module.key} value={module.key}>
                {module.displayName}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label htmlFor="targetId" className={styles.label}>
            Target ID
          </label>
          <input
            id="targetId"
            type="text"
            value={targetId}
            onChange={(event) => setTargetId(event.target.value)}
            className={styles.input}
          />
          <span className={styles.helperText}>
            The id of the specific record this change affects, if any. Must be provided together
            with a target module, or both left blank.
          </span>
        </div>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend className={styles.fieldsetLegend}>Governance</legend>

        <UserPicker
          id="assignedToUserId"
          label="Assigned to"
          value={assignee}
          onChange={handleAssigneeChange}
          helperText={
            props.mode === "edit" && !assigneeTouched && !assignee && props.initial.assignedToUserId
              ? "This record has an assignee that could not be resolved (the account may be disabled or removed). The existing assignment will be kept as-is unless you search and select someone new."
              : "Search by name or email. Leave unset for no assignee."
          }
        />

        <div className={styles.field}>
          <label htmlFor="decisionNotes" className={styles.label}>
            Decision notes
          </label>
          <textarea
            id="decisionNotes"
            maxLength={LONG_VALUE_MAX_LENGTH}
            rows={4}
            value={decisionNotes}
            onChange={(event) => setDecisionNotes(event.target.value)}
            className={styles.textarea}
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
          {submitting ? "Saving…" : props.mode === "create" ? "Create record" : "Save changes"}
        </button>
        <a
          href={
            props.mode === "create"
              ? withProjectId("/change-center", props.projectId)
              : withProjectId(`/change-center/${props.recordId}`, props.projectId)
          }
          className={styles.cancelLink}
        >
          Cancel
        </a>
      </div>
    </form>
  );
}
