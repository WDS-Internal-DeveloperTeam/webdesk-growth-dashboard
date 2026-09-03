"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import type { Release, ReleaseType, UserSummary } from "@webdesk/shared-types";
import { postMutation } from "@/lib/api-errors";
import { getApiBaseUrl } from "@/lib/auth";
import { RELEASE_TYPE_LABEL, RELEASE_TYPE_VALUES } from "@/lib/release-center-query";
import { withProjectId } from "@/lib/project-scoped-href";
import { UserPicker } from "./user-picker";
import styles from "./release-form.module.css";

// Mirrors apps/dashboard-api/src/release-center/release-center.dto.ts's createReleaseSchema/
// updateReleaseSchema — kept in sync by hand, same approach every sibling form in this app uses.
const PUBLIC_ID_MAX_LENGTH = 64;
const TITLE_MAX_LENGTH = 255;
const NOTES_MAX_LENGTH = 10_000;
const HOTFIX_REASON_MAX_LENGTH = 10_000;

export type ReleaseFormProps =
  | { readonly mode: "create"; readonly projectId: string }
  | {
      readonly mode: "edit";
      readonly projectId: string;
      readonly releaseId: string;
      readonly initial: Release;
      /** Server-resolved `UserSummary` for `initial.assignedDeveloperUserId`/
       *  `assignedReviewerUserId` — `null` covers both "not assigned" and "assigned but the id no
       *  longer resolves" (disabled/removed) identically, mirroring `ProjectForm`'s own `owner`/
       *  `ownerUserId` split. Resolved server-side so this form never resolves an id to a name
       *  itself. */
      readonly assignedDeveloper: UserSummary | null;
      readonly assignedReviewer: UserSummary | null;
    };

/**
 * Create/edit form for a release. No approved wireframe/screen spec exists for this module —
 * fields mirror `createReleaseSchema`'s/`updateReleaseSchema`'s own field list directly, the
 * smallest honest reading of the backend's actual field set, matching
 * `TechnicalCheckDefinitionForm`'s own identical precedent.
 *
 * `publicId`/`releaseType` are both create-only (shown read-only on edit) —
 * `updateReleaseSchema` never accepts either, mirroring every sibling module's own
 * discriminator-field create-only contract. `status` is NEVER a field here — only the dedicated
 * `POST .../:id/status` route (`ReleaseStatusActions`) may change it.
 *
 * `notes`/`hotfixReason` are PLAIN `<textarea>`s, deliberately NOT `RichTextEditor` — an explicit,
 * documented exception to the 2026-08-22 standing rule: `createReleaseSchema`'s own DTO comment
 * states both fields are "deliberately plain, unsanitized text — no `dashboard-web` UI exists
 * yet," and this build is that same follow-up point, so converting the frontend alone without a
 * paired backend sanitization change (out of scope for a UI-only branch) would be dishonest.
 * `hotfixReason` is always shown, not gated on `releaseType === "hotfix"` — the schema accepts it
 * regardless of type, and hard-blocking it here would silently discard a value a caller may
 * legitimately want to record for a non-hotfix release too.
 *
 * `assignedDeveloperUserId`/`assignedReviewerUserId` are two independent `UserPicker` fields, each
 * seeded from a server-resolved `UserSummary` on edit and guarded by its own `*Touched` flag so an
 * untouched picker preserves the release's existing assignment exactly (including an unresolvable
 * one) rather than silently clearing it on an unrelated save — the exact data-loss bug class this
 * project has already found and fixed twice (`ProjectForm`'s owner field, then
 * `ReadyForClaudeTaskForm`'s three assignee fields).
 *
 * Submits via `postMutation()` (`credentials: "include"`, required for `dashboard-api`'s
 * `OriginCheckGuard`) — `POST .../releases` on create, `POST .../releases/:id/update` on edit,
 * matching `ReleasesController`'s own real route shape.
 */
export function ReleaseForm(props: ReleaseFormProps): ReactNode {
  const router = useRouter();
  const initial = props.mode === "edit" ? props.initial : null;

  const [publicId, setPublicId] = useState(initial?.publicId ?? "");
  const [releaseType, setReleaseType] = useState<ReleaseType>(initial?.releaseType ?? "staging");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [hotfixReason, setHotfixReason] = useState(initial?.hotfixReason ?? "");
  const [assignedDeveloper, setAssignedDeveloper] = useState<UserSummary | null>(
    props.mode === "edit" ? props.assignedDeveloper : null,
  );
  const [developerTouched, setDeveloperTouched] = useState(false);
  const [assignedReviewer, setAssignedReviewer] = useState<UserSummary | null>(
    props.mode === "edit" ? props.assignedReviewer : null,
  );
  const [reviewerTouched, setReviewerTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function handleDeveloperChange(next: UserSummary | null): void {
    setAssignedDeveloper(next);
    setDeveloperTouched(true);
  }

  function handleReviewerChange(next: UserSummary | null): void {
    setAssignedReviewer(next);
    setReviewerTouched(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      // Omitted entirely (create) or sent as an explicit null (edit) when empty — an omitted key
      // leaves the field unchanged on update, matching updateReleaseSchema's own `.nullish()`
      // contract; an explicit null is what actually clears an existing value back to "none".
      // Matches `TechnicalCheckDefinitionForm`'s own identical `textField()` helper.
      function textField(value: string): string | null | undefined {
        const trimmed = value.trim();
        if (trimmed !== "") return trimmed;
        return props.mode === "create" ? undefined : null;
      }

      const developerUserId = developerTouched
        ? (assignedDeveloper?.id ?? null)
        : props.mode === "edit"
          ? (props.initial.assignedDeveloperUserId ?? null)
          : null;
      const reviewerUserId = reviewerTouched
        ? (assignedReviewer?.id ?? null)
        : props.mode === "edit"
          ? (props.initial.assignedReviewerUserId ?? null)
          : null;

      const sharedFields = {
        title: title.trim(),
        notes: textField(notes),
        hotfixReason: textField(hotfixReason),
        assignedDeveloperUserId: developerUserId,
        assignedReviewerUserId: reviewerUserId,
      };

      const payload =
        props.mode === "create"
          ? { ...sharedFields, publicId: publicId.trim(), releaseType }
          : sharedFields;

      const url =
        props.mode === "create"
          ? `${getApiBaseUrl()}/release-center/projects/${props.projectId}/releases`
          : `${getApiBaseUrl()}/release-center/projects/${props.projectId}/releases/${props.releaseId}/update`;

      const result = await postMutation<Release>(url, payload);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      const releaseId = props.mode === "create" ? result.data?.id : props.releaseId;
      if (!releaseId) {
        setError(
          "The release was saved, but its details couldn't be loaded. Please check the list.",
        );
        return;
      }
      router.push(withProjectId(`/release-center/${releaseId}`, props.projectId));
    } catch (err) {
      console.error("Failed to save release", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className={styles.form}>
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
            A short, stable identifier for this release. Cannot be changed later.
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
          <label htmlFor="releaseType" className={styles.label}>
            Release type
          </label>
          <select
            id="releaseType"
            value={releaseType}
            onChange={(event) => setReleaseType(event.target.value as ReleaseType)}
            className={styles.select}
          >
            {RELEASE_TYPE_VALUES.map((value) => (
              <option key={value} value={value}>
                {RELEASE_TYPE_LABEL[value]}
              </option>
            ))}
          </select>
          <span className={styles.helperText}>Immutable once created.</span>
        </div>
      ) : (
        <div className={styles.field}>
          <span className={styles.label}>Release type</span>
          <span className={styles.readonlyValue}>
            {RELEASE_TYPE_LABEL[props.initial.releaseType]}
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

      <UserPicker
        id="assignedDeveloper"
        label="Assigned developer"
        value={assignedDeveloper}
        onChange={handleDeveloperChange}
        helperText={
          props.mode === "edit" &&
          !developerTouched &&
          !assignedDeveloper &&
          initial?.assignedDeveloperUserId
            ? "This release has an assigned developer that could not be resolved (the account may be disabled or removed). The existing assignment will be kept as-is unless you search and select someone new."
            : "Search by name or email. Leave unset for no assigned developer."
        }
      />

      <UserPicker
        id="assignedReviewer"
        label="Assigned reviewer"
        value={assignedReviewer}
        onChange={handleReviewerChange}
        helperText={
          props.mode === "edit" &&
          !reviewerTouched &&
          !assignedReviewer &&
          initial?.assignedReviewerUserId
            ? "This release has an assigned reviewer that could not be resolved (the account may be disabled or removed). The existing assignment will be kept as-is unless you search and select someone new."
            : "Search by name or email. Leave unset for no assigned reviewer."
        }
      />

      <div className={styles.field}>
        <label htmlFor="notes" className={styles.label}>
          Notes
        </label>
        <textarea
          id="notes"
          maxLength={NOTES_MAX_LENGTH}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          className={styles.textarea}
          rows={3}
        />
      </div>

      <div className={styles.field}>
        <label htmlFor="hotfixReason" className={styles.label}>
          Hotfix reason
        </label>
        <textarea
          id="hotfixReason"
          maxLength={HOTFIX_REASON_MAX_LENGTH}
          value={hotfixReason}
          onChange={(event) => setHotfixReason(event.target.value)}
          className={styles.textarea}
          rows={3}
        />
        <span className={styles.helperText}>
          Only relevant for a hotfix release, but accepted regardless of release type.
        </span>
      </div>

      {error ? (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      ) : null}

      <div className={styles.actions}>
        <button type="submit" disabled={submitting} className={styles.submitButton}>
          {submitting ? "Saving…" : props.mode === "create" ? "Create release" : "Save changes"}
        </button>
        <a href={withProjectId("/release-center", props.projectId)} className={styles.cancelLink}>
          Cancel
        </a>
      </div>
    </form>
  );
}
