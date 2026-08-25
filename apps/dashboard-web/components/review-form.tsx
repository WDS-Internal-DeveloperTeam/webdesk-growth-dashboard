"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import type { ModuleRegistrySummary, Review, UserSummary } from "@webdesk/shared-types";
import { postMutation } from "@/lib/api-errors";
import { getApiBaseUrl } from "@/lib/auth";
import { moduleDisplayName } from "@/lib/review-and-approval-center-query";
import { isUuid } from "@/lib/uuid";
import { UserPicker } from "./user-picker";
import styles from "./review-form.module.css";

const TARGET_LABEL_MAX_LENGTH = 500;
const VERSION_LABEL_MAX_LENGTH = 255;

export interface ReviewFormProps {
  /** Already sorted alphabetically by display name (`sortModulesForPicker()`) — real backing data
   *  for the `targetModuleKey` field, sourced from `GET /authz/module-registry`. A real, verified
   *  RBAC alignment makes this dropdown safe rather than a guess: only `super_admin`/
   *  `owner_growth_approver` hold `review_center:create` (this form's own gate), and those are the
   *  SAME two roles that hold `users_roles:view` (`GET /authz/module-registry`'s own gate) — no
   *  caller who can reach this form is ever denied this lookup. Can still be empty if the fetch
   *  itself failed (a genuine transient error, not an RBAC mismatch) — the empty-state warning
   *  below covers that case honestly rather than silently letting the form become unsubmittable
   *  with no explanation, mirroring `ContentTemplateLibraryForm`'s own precedent for its required
   *  `categoryId` field. */
  readonly modules: readonly ModuleRegistrySummary[];
}

/**
 * Submit a new review — this module's only real mutation form (reviews have no generic edit route;
 * every other change is one of decide/pause/delegate/comment, each its own dedicated action). No
 * approved wireframe/screen spec exists for this module — built to the smallest honest reading of
 * `createReviewSchema` (`apps/dashboard-api/src/review-and-approval-center/
 * review-and-approval-center.dto.ts`), matching every sibling module's own precedent for an
 * unsourced screen.
 *
 * `targetId` is a plain, client-side UUID-format-checked text input, not a picker — task package
 * D6's own explicit design: no generic cross-module record-lookup capability exists anywhere in
 * this app, so a real picker isn't buildable. `targetLabel` is a human-readable snapshot label
 * captured now, not a live link back to the target record. `versionALabel`/`versionBLabel` are
 * likewise opaque, human-supplied comparison labels (e.g. "v3" vs. "v4"), not a real diff.
 *
 * Submits via a direct browser `fetch()` (`postMutation()`) with `credentials: "include"` —
 * required for `dashboard-api`'s `OriginCheckGuard` to see a real browser `Origin` header, the same
 * pattern every mutation form in this app already uses. On success, redirects to the new review's
 * own detail page.
 */
export function ReviewForm({ modules }: ReviewFormProps): ReactNode {
  const router = useRouter();

  const [targetModuleKey, setTargetModuleKey] = useState(modules[0]?.key ?? "");
  const [targetId, setTargetId] = useState("");
  const [targetLabel, setTargetLabel] = useState("");
  const [assignedTo, setAssignedTo] = useState<UserSummary | null>(null);
  const [versionALabel, setVersionALabel] = useState("");
  const [versionBLabel, setVersionBLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);

    const trimmedTargetId = targetId.trim();
    if (!isUuid(trimmedTargetId)) {
      setError("Target ID must be a valid UUID.");
      return;
    }
    if (!targetModuleKey) {
      setError("Target module is required.");
      return;
    }

    setSubmitting(true);
    try {
      const result = await postMutation<Review>(`${getApiBaseUrl()}/reviews`, {
        targetModuleKey,
        targetId: trimmedTargetId,
        targetLabel: targetLabel.trim() || null,
        assignedToUserId: assignedTo?.id ?? null,
        versionALabel: versionALabel.trim() || null,
        versionBLabel: versionBLabel.trim() || null,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.push(`/review-and-approval-center/${result.data.id}`);
    } catch (err) {
      console.error("Failed to submit review", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      {modules.length === 0 ? (
        <p className={styles.warningNotice}>
          The list of target modules couldn&apos;t be loaded, so this form can&apos;t be submitted
          right now. Try reloading the page, or contact an administrator if this keeps happening.
        </p>
      ) : null}

      <fieldset className={styles.fieldset}>
        <legend className={styles.fieldsetLegend}>Target</legend>

        <div className={styles.field}>
          <label htmlFor="targetModuleKey" className={styles.label}>
            Target module
          </label>
          <select
            id="targetModuleKey"
            required
            disabled={modules.length === 0}
            value={targetModuleKey}
            onChange={(event) => setTargetModuleKey(event.target.value)}
            className={styles.select}
          >
            {modules.length === 0 ? <option value="">No modules available</option> : null}
            {modules.map((module) => (
              <option key={module.key} value={module.key}>
                {moduleDisplayName(module)}
              </option>
            ))}
          </select>
          <span className={styles.helperText}>The module that owns the record being reviewed.</span>
        </div>

        <div className={styles.field}>
          <label htmlFor="targetId" className={styles.label}>
            Target ID
          </label>
          <input
            id="targetId"
            type="text"
            required
            value={targetId}
            onChange={(event) => setTargetId(event.target.value)}
            className={styles.input}
            placeholder="00000000-0000-0000-0000-000000000000"
          />
          <span className={styles.helperText}>
            The target record&apos;s own id — no lookup exists yet for this module, so this must be
            entered directly.
          </span>
        </div>

        <div className={styles.field}>
          <label htmlFor="targetLabel" className={styles.label}>
            Target label
          </label>
          <input
            id="targetLabel"
            type="text"
            maxLength={TARGET_LABEL_MAX_LENGTH}
            value={targetLabel}
            onChange={(event) => setTargetLabel(event.target.value)}
            className={styles.input}
          />
          <span className={styles.helperText}>
            Optional. A human-readable snapshot of what&apos;s being reviewed, captured now — not a
            live link back to the target record.
          </span>
        </div>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend className={styles.fieldsetLegend}>Assignment</legend>
        <UserPicker
          id="assignedToUserId"
          label="Assign to"
          value={assignedTo}
          onChange={setAssignedTo}
          helperText="Optional. Leave unassigned to assign it later."
        />
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend className={styles.fieldsetLegend}>Version comparison</legend>

        <div className={styles.field}>
          <label htmlFor="versionALabel" className={styles.label}>
            Version A label
          </label>
          <input
            id="versionALabel"
            type="text"
            maxLength={VERSION_LABEL_MAX_LENGTH}
            value={versionALabel}
            onChange={(event) => setVersionALabel(event.target.value)}
            className={styles.input}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="versionBLabel" className={styles.label}>
            Version B label
          </label>
          <input
            id="versionBLabel"
            type="text"
            maxLength={VERSION_LABEL_MAX_LENGTH}
            value={versionBLabel}
            onChange={(event) => setVersionBLabel(event.target.value)}
            className={styles.input}
          />
        </div>
        <span className={styles.helperText}>
          Optional, opaque comparison labels (e.g. &quot;v3&quot; vs. &quot;v4&quot;) — not a real
          diff, since this module has no generic cross-module comparison capability.
        </span>
      </fieldset>

      {error ? (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      ) : null}

      <div className={styles.actions}>
        <button
          type="submit"
          disabled={submitting || modules.length === 0}
          className={styles.submitButton}
        >
          {submitting ? "Submitting…" : "Submit review"}
        </button>
        <a href="/review-and-approval-center" className={styles.cancelLink}>
          Cancel
        </a>
      </div>
    </form>
  );
}
