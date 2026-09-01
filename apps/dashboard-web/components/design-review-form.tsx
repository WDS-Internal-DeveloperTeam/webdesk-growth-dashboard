"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import type {
  DesignReview,
  DesignReviewType,
  ModuleRegistrySummary,
  UserSummary,
} from "@webdesk/shared-types";
import { postMutation } from "@/lib/api-errors";
import { getApiBaseUrl } from "@/lib/auth";
import {
  DESIGN_REVIEW_TYPE_LABEL,
  DESIGN_REVIEW_TYPE_VALUES,
  moduleDisplayName,
} from "@/lib/design-review-center-query";
import { isUuid } from "@/lib/uuid";
import { UserPicker } from "./user-picker";
import styles from "./design-review-form.module.css";

const TARGET_LABEL_MAX_LENGTH = 500;
const VERSION_LABEL_MAX_LENGTH = 255;

export interface DesignReviewFormProps {
  /** Already sorted alphabetically by display name (`sortModulesForPicker()`) — real backing data
   *  for the `targetModuleKey` field, sourced from `getServerSession()`'s own already-fetched
   *  `session.navigation` (`GET /me/navigation`, `SessionGuard`-only) rather than a dedicated
   *  `GET /authz/module-registry` fetch, matching `ReviewForm`'s own already-reviewed fix for the
   *  identical field. Can still be empty if the underlying navigation fetch itself failed — the
   *  empty-state warning below covers that case honestly rather than silently letting the form
   *  become unsubmittable with no explanation. */
  readonly modules: readonly ModuleRegistrySummary[];
}

/**
 * Submit a new design review request — this module's only real mutation form (design reviews have
 * no generic edit route; every other change is a `decide()` action). No approved wireframe/screen
 * spec exists for this module — built to the smallest honest reading of `createDesignReviewSchema`
 * (`apps/dashboard-api/src/design-review-center/design-review-center.dto.ts`), mirroring
 * `ReviewForm`'s own structure file-for-file with one addition: a required `reviewType` select (the
 * 9-value vocabulary from `03_Detailed_Module_Specifications.md §19`) — Review and Approval Center
 * has no equivalent field.
 *
 * `targetId` is a plain, client-side UUID-format-checked text input, not a picker — mirrors
 * `ReviewForm`'s own D6 design: no generic cross-module record-lookup capability exists anywhere in
 * this app. `targetLabel` is a human-readable snapshot label captured now, not a live link back to
 * the target record. `versionALabel`/`versionBLabel` are likewise opaque, human-supplied comparison
 * labels, not a real diff.
 *
 * Submits via `postMutation()` (`credentials: "include"`, required for `dashboard-api`'s
 * `OriginCheckGuard`) — the same pattern every mutation form in this app already uses. On success,
 * redirects to the new review's own detail page.
 */
export function DesignReviewForm({ modules }: DesignReviewFormProps): ReactNode {
  const router = useRouter();

  const [targetModuleKey, setTargetModuleKey] = useState(modules[0]?.key ?? "");
  const [targetId, setTargetId] = useState("");
  const [targetLabel, setTargetLabel] = useState("");
  const [reviewType, setReviewType] = useState<DesignReviewType>(DESIGN_REVIEW_TYPE_VALUES[0]!);
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
      const result = await postMutation<DesignReview>(`${getApiBaseUrl()}/design-reviews`, {
        targetModuleKey,
        targetId: trimmedTargetId,
        targetLabel: targetLabel.trim() || null,
        reviewType,
        assignedToUserId: assignedTo?.id ?? null,
        versionALabel: versionALabel.trim() || null,
        versionBLabel: versionBLabel.trim() || null,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      // Same guard ReviewForm's own doc comment explains: postMutation()'s success data may still
      // degrade to undefined on a missing/malformed response body.
      if (!result.data) {
        setError(
          "The design review was created, but its details couldn't be loaded. Please check the list.",
        );
        return;
      }
      router.push(`/design-review-center/${result.data.id}`);
    } catch (err) {
      console.error("Failed to submit design review", err);
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
        <legend className={styles.fieldsetLegend}>Review type</legend>
        <div className={styles.field}>
          <label htmlFor="reviewType" className={styles.label}>
            Review type
          </label>
          <select
            id="reviewType"
            required
            value={reviewType}
            onChange={(event) => setReviewType(event.target.value as DesignReviewType)}
            className={styles.select}
          >
            {DESIGN_REVIEW_TYPE_VALUES.map((value) => (
              <option key={value} value={value}>
                {DESIGN_REVIEW_TYPE_LABEL[value]}
              </option>
            ))}
          </select>
          <span className={styles.helperText}>
            Immutable after creation — a real review-type change is a different review, not an edit.
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
          {submitting ? "Submitting…" : "Submit design review"}
        </button>
        <a href="/design-review-center" className={styles.cancelLink}>
          Cancel
        </a>
      </div>
    </form>
  );
}
