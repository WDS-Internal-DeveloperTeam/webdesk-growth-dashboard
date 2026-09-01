"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import type { CaseStudyStatus } from "@webdesk/shared-types";
import { parseApiErrorMessage } from "@/lib/api-errors";
import { getApiBaseUrl } from "@/lib/auth";
import { isEmptyRichTextHtml } from "@/lib/rich-text";
import { useSyncedState } from "@/lib/use-synced-state";
import { RichTextEditor } from "./rich-text-editor";
import styles from "./case-study-status-actions.module.css";

export interface CaseStudyStatusActionsProps {
  readonly caseStudyId: string;
  readonly status: CaseStudyStatus;
  /** Drives D7's `internal_approval` branching below — a case study that requires client approval
   *  can only reach `client_approval` from `internal_approval`, never `scheduled` directly, and
   *  vice versa. Set once at intake and immutable, so this never changes across the lifetime of one
   *  status-actions render. */
  readonly clientApprovalRequired: boolean;
}

/**
 * Mirrors the `TRANSITIONS` table in
 * `apps/dashboard-api/src/case-study-studio/case-studies.service.ts` — kept in sync by hand, same
 * approach every sibling status-actions component in this app already uses. Only the legal target
 * statuses are mirrored here (not the required RBAC action per transition, which varies
 * dynamically per status — `CaseStudiesService.changeStatus()`'s own
 * `AuthorizationService.assertAllowed()` call remains the authoritative check either way; a caller
 * without the real grant still gets a clean 403, shown via the same `parseApiErrorMessage()`
 * allowlist every mutation in this app uses).
 *
 * Unlike every prior module's own shared 8-value `ArtifactApprovalStatus` workflow, this is a
 * genuinely bespoke 14-state lifecycle (D1) — the second bespoke workflow in this codebase after
 * Internal Linking Library's own 4-state one. `internal_approval`'s own target list branches on
 * `clientApprovalRequired` (D7): only ONE of `client_approval`/`scheduled` is ever a legal target
 * from `internal_approval` for a given case study, never both.
 */
function allowedTransitions(
  status: CaseStudyStatus,
  clientApprovalRequired: boolean,
): readonly CaseStudyStatus[] {
  switch (status) {
    case "intake":
      return ["upload", "archived"];
    case "upload":
      return ["completeness_review", "archived"];
    case "completeness_review":
      return ["ready_for_claude", "missing_information", "archived"];
    case "ready_for_claude":
      return ["draft", "missing_information", "archived"];
    case "missing_information":
      return ["draft", "archived"];
    case "draft":
      return ["search_review", "archived"];
    case "search_review":
      return ["fact_confidentiality_review", "missing_information", "archived"];
    case "fact_confidentiality_review":
      return ["internal_approval", "missing_information", "archived"];
    case "internal_approval":
      return clientApprovalRequired
        ? ["client_approval", "missing_information", "archived"]
        : ["scheduled", "missing_information", "archived"];
    case "client_approval":
      return ["scheduled", "missing_information", "archived"];
    case "scheduled":
      return ["published", "archived"];
    case "published":
      return ["unpublished", "archived"];
    case "unpublished":
      return ["published", "archived"];
    case "archived":
      return [];
    default:
      return [];
  }
}

/** Labels the action that REACHES the given status, not the status itself — same convention every
 *  sibling status-actions component's own `ACTION_LABEL` establishes. `draft` is reachable from
 *  both `ready_for_claude` and `missing_information`, sharing one label — the target, not the
 *  source, drives what the button says. */
const ACTION_LABEL: Readonly<Record<CaseStudyStatus, string>> = {
  intake: "Revert to Intake",
  upload: "Move to Upload",
  completeness_review: "Submit for Completeness Review",
  ready_for_claude: "Mark Ready for Claude",
  missing_information: "Request More Information",
  draft: "Revert to Draft",
  search_review: "Submit for Search Review",
  fact_confidentiality_review: "Submit for Fact & Confidentiality Review",
  internal_approval: "Submit for Internal Approval",
  client_approval: "Send to Client Approval",
  scheduled: "Schedule",
  published: "Publish",
  unpublished: "Unpublish",
  archived: "Archive",
};

/** `archived` is this module's only terminal state (D1) — the one transition that always confirms,
 *  matching every sibling status-actions component's identical "only the irreversible transition
 *  confirms" precedent. */
const CONFIRM_MESSAGE: Partial<Record<CaseStudyStatus, string>> = {
  archived: "Archive this case study? Archived case studies can't be reactivated.",
};

/**
 * Status-transition actions for the case study detail page's header — D1's real 14-state bespoke
 * workflow. No approved design brief names an `ApprovalBlock` component for this module, and the
 * same reasoning that kept every sibling status-actions component from using it applies identically
 * here: `changeCaseStudyStatusSchema` accepts `{status, notes?, unpublishReason?}`, no real
 * submitter/reviewer identity, so a component expecting that data would need to fabricate it.
 *
 * `notes` (rich text, per the DTO — recorded on the resulting `case_study_approvals` row for a
 * transition FROM `internal_approval`/`client_approval`, per D7) is a single, always-visible
 * `RichTextEditor` above the action buttons rather than a per-button field — the backend accepts it
 * on every `changeStatus()` call, not just approval-stage ones, so gating its visibility per
 * transition would add real complexity for no corresponding backend restriction.
 *
 * `unpublishReason` is the one D5-named "mandatory governance" field — required by the backend
 * specifically on `published -> unpublished` (enforced service-side, not schema-side) — so a
 * required plain-text input for it only renders once "Unpublish" becomes the pending action, and
 * that specific button stays disabled until a reason is entered. It's plain text, not rich text:
 * `changeCaseStudyStatusSchema`'s own `unpublishReason` field is a bare `z.string()`, not routed
 * through `sanitizeNullableRichText()` on the backend the way `notes` is.
 *
 * Renders only the transitions `POST /case-study-studio/case-studies/:id/status` would actually
 * accept from the case study's current status (respecting the `clientApprovalRequired` branching),
 * so an invalid-transition response is unreachable through this UI in normal use. Submits via a
 * direct browser `fetch()` with `credentials: "include"` — required for `dashboard-api`'s
 * `OriginCheckGuard` to see a real browser `Origin` header, same pattern every mutation form in
 * this app already uses.
 */
export function CaseStudyStatusActions({
  caseStudyId,
  status: initialStatus,
  clientApprovalRequired,
}: CaseStudyStatusActionsProps): ReactNode {
  const router = useRouter();
  const [status, setStatus] = useSyncedState(initialStatus);
  const [notes, setNotes] = useState("");
  const [unpublishReason, setUnpublishReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<CaseStudyStatus | null>(null);

  const targets = allowedTransitions(status, clientApprovalRequired);
  if (targets.length === 0) {
    return null;
  }

  const unpublishReasonRequired = targets.includes("unpublished");
  const trimmedUnpublishReason = unpublishReason.trim();

  async function handleTransition(nextStatus: CaseStudyStatus): Promise<void> {
    if (nextStatus === "unpublished" && !trimmedUnpublishReason) {
      return;
    }
    const confirmMessage = CONFIRM_MESSAGE[nextStatus];
    if (confirmMessage && !window.confirm(confirmMessage)) {
      return;
    }
    setError(null);
    setPending(nextStatus);
    try {
      const response = await fetch(
        `${getApiBaseUrl()}/case-study-studio/case-studies/${caseStudyId}/status`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: nextStatus,
            notes: isEmptyRichTextHtml(notes) ? null : notes,
            unpublishReason: nextStatus === "unpublished" ? trimmedUnpublishReason : null,
          }),
        },
      );
      if (!response.ok) {
        setError(await parseApiErrorMessage(response));
        return;
      }
      // Same batched-render pattern every sibling status-actions component uses: update the
      // rendered button set from the just-confirmed transition immediately, rather than waiting on
      // router.refresh() to reconcile it, so buttons never re-enable against the stale
      // pre-transition status.
      setStatus(nextStatus);
      setNotes("");
      setUnpublishReason("");
      router.refresh();
    } catch (err) {
      console.error("Failed to change case study status", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.notesField}>
        <label htmlFor="case-study-status-notes" className={styles.notesLabel}>
          Notes (optional)
        </label>
        <RichTextEditor id="case-study-status-notes" value={notes} onChange={setNotes} />
      </div>

      {unpublishReasonRequired ? (
        <div className={styles.reasonField}>
          <label htmlFor="case-study-unpublish-reason" className={styles.notesLabel}>
            Unpublish reason (required to unpublish)
          </label>
          <input
            id="case-study-unpublish-reason"
            type="text"
            value={unpublishReason}
            onChange={(event) => setUnpublishReason(event.target.value)}
            className={styles.reasonInput}
          />
        </div>
      ) : null}

      <div className={styles.buttonRow}>
        {targets.map((target) => (
          <button
            key={target}
            type="button"
            onClick={() => {
              void handleTransition(target);
            }}
            disabled={pending !== null || (target === "unpublished" && !trimmedUnpublishReason)}
            className={target === "archived" ? styles.terminalButton : styles.actionButton}
          >
            {pending === target ? "…" : ACTION_LABEL[target]}
          </button>
        ))}
      </div>
      {error ? (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
