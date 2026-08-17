"use client";

import { useId, useState, type ReactNode } from "react";
import {
  borderTokens,
  colorTokens,
  radiusTokens,
  spacingTokens,
  typographyTokens,
} from "../tokens.js";
import { Button, Textarea } from "./controls.js";
import { Modal } from "./overlay.js";
import { Accordion } from "./structural.js";

/**
 * Domain-specific components (design system `06-dashboard-component-system.md`
 * §5) — Approval block, Diff viewer, File attachment, Relationship picker,
 * Stepper, and the `<Code>` inline convention.
 */

export interface CodeProps {
  readonly children: ReactNode;
}

/** The mono-font usage convention (design system §5) — use instead of ad hoc inline `style={{fontFamily: ...}}`. */
export function Code({ children }: CodeProps): ReactNode {
  return (
    <code
      style={{
        fontFamily: typographyTokens.fontFamilyMono,
        fontSize: typographyTokens.fontSizeXs,
        background: colorTokens.mutedSurface,
        padding: "0.125rem 0.375rem",
        borderRadius: radiusTokens.sm,
      }}
    >
      {children}
    </code>
  );
}

export interface PreviousApproval {
  readonly id: string;
  readonly version: string;
  readonly approver: string;
  readonly date: string;
  readonly decision: string;
}

export interface ApprovalBlockProps {
  readonly currentVersion?: ReactNode;
  readonly proposedVersion?: ReactNode;
  readonly submitter: string;
  readonly submittedAt: string;
  readonly reviewer?: string;
  readonly requiredApprovers: readonly string[];
  readonly statusBadge: ReactNode;
  readonly comments?: ReactNode;
  readonly previousApprovals?: readonly PreviousApproval[];
  readonly onApprove?: () => void;
  readonly onRequestRevision?: (reason: string) => void;
  readonly onReject?: (reason: string) => void;
}

/**
 * The single reusable approval surface (design prompt §11,
 * `11-approval-patterns.md` §1) — same field order everywhere: current
 * version, proposed version, submitter, reviewer, required approver(s),
 * status, comments, date, previous approvals (collapsed once >2-3 exist).
 * Approve/Reject/Request Revision render visually distinct from routine
 * editing actions, per §11 §2; Reject and Request Revision both require a
 * typed reason before they can fire.
 */
export function ApprovalBlock({
  currentVersion,
  proposedVersion,
  submitter,
  submittedAt,
  reviewer,
  requiredApprovers,
  statusBadge,
  comments,
  previousApprovals = [],
  onApprove,
  onRequestRevision,
  onReject,
}: ApprovalBlockProps): ReactNode {
  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [isRevisionOpen, setIsRevisionOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [isPreviousExpanded, setIsPreviousExpanded] = useState(false);
  const labelId = useId();

  function submitReject() {
    if (!reason.trim()) {
      return;
    }
    onReject?.(reason);
    setIsRejectOpen(false);
    setReason("");
  }

  function submitRevision() {
    if (!reason.trim()) {
      return;
    }
    onRequestRevision?.(reason);
    setIsRevisionOpen(false);
    setReason("");
  }

  return (
    <section
      aria-labelledby={labelId}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: spacingTokens.md,
        border: `${borderTokens.widthThin} solid ${colorTokens.border}`,
        borderRadius: radiusTokens.md,
        padding: spacingTokens.lg,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h2
          id={labelId}
          style={{
            margin: 0,
            fontSize: typographyTokens.fontSizeMd,
            fontWeight: typographyTokens.fontWeightSemibold,
          }}
        >
          Approval
        </h2>
        {statusBadge}
      </div>

      {currentVersion || proposedVersion ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: spacingTokens.md }}>
          <div>
            <p
              style={{
                margin: 0,
                fontSize: typographyTokens.fontSizeXs,
                color: colorTokens.foregroundMuted,
              }}
            >
              Current version
            </p>
            {currentVersion ?? (
              <p
                style={{
                  fontSize: typographyTokens.fontSizeSm,
                  color: colorTokens.foregroundSubtle,
                }}
              >
                None yet
              </p>
            )}
          </div>
          <div>
            <p
              style={{
                margin: 0,
                fontSize: typographyTokens.fontSizeXs,
                color: colorTokens.foregroundMuted,
              }}
            >
              Proposed version
            </p>
            {proposedVersion}
          </div>
        </div>
      ) : null}

      <dl
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: spacingTokens.sm,
          margin: 0,
          fontSize: typographyTokens.fontSizeSm,
        }}
      >
        <div>
          <dt style={{ color: colorTokens.foregroundMuted }}>Submitter</dt>
          <dd style={{ margin: 0 }}>
            {submitter} · {submittedAt}
          </dd>
        </div>
        <div>
          <dt style={{ color: colorTokens.foregroundMuted }}>Reviewer</dt>
          <dd style={{ margin: 0 }}>{reviewer ?? "Unassigned"}</dd>
        </div>
        <div>
          <dt style={{ color: colorTokens.foregroundMuted }}>Required approver(s)</dt>
          <dd style={{ margin: 0 }}>{requiredApprovers.join(", ") || "None"}</dd>
        </div>
      </dl>

      {comments ? (
        <div>
          <p
            style={{
              margin: 0,
              fontSize: typographyTokens.fontSizeXs,
              color: colorTokens.foregroundMuted,
            }}
          >
            Comments
          </p>
          {comments}
        </div>
      ) : null}

      {previousApprovals.length > 0 ? (
        <Accordion
          items={[
            {
              id: "previous-approvals",
              title: `Previous approvals (${previousApprovals.length})`,
              content: (
                <ul
                  style={{
                    margin: 0,
                    padding: 0,
                    listStyle: "none",
                    display: "flex",
                    flexDirection: "column",
                    gap: spacingTokens.xs,
                  }}
                >
                  {previousApprovals.map((entry) => (
                    <li
                      key={entry.id}
                      style={{
                        fontSize: typographyTokens.fontSizeSm,
                        color: colorTokens.foregroundMuted,
                      }}
                    >
                      {entry.version} · {entry.approver} · {entry.date} · {entry.decision}
                    </li>
                  ))}
                </ul>
              ),
            },
          ]}
          expandedIds={isPreviousExpanded ? new Set(["previous-approvals"]) : new Set()}
          onToggle={() => setIsPreviousExpanded((expanded) => !expanded)}
        />
      ) : null}

      <div
        style={{
          display: "flex",
          gap: spacingTokens.sm,
          paddingTop: spacingTokens.sm,
          borderTop: `${borderTokens.widthThin} solid ${colorTokens.border}`,
        }}
      >
        {onApprove ? (
          <Button variant="primary" onClick={onApprove} style={{ background: colorTokens.success }}>
            Approve
          </Button>
        ) : null}
        {onRequestRevision ? (
          <Button variant="secondary" onClick={() => setIsRevisionOpen(true)}>
            Request Revision
          </Button>
        ) : null}
        {onReject ? (
          <Button variant="danger" onClick={() => setIsRejectOpen(true)}>
            Reject
          </Button>
        ) : null}
      </div>

      <Modal
        isOpen={isRejectOpen}
        onClose={() => setIsRejectOpen(false)}
        title="Reject this submission?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsRejectOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={submitReject} disabled={!reason.trim()}>
              Reject
            </Button>
          </>
        }
      >
        <p style={{ fontSize: typographyTokens.fontSizeSm, color: colorTokens.foregroundMuted }}>
          This will return the record to Draft and notify the submitter.
        </p>
        <Textarea
          label="Reason"
          required
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </Modal>

      <Modal
        isOpen={isRevisionOpen}
        onClose={() => setIsRevisionOpen(false)}
        title="Request revision"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsRevisionOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={submitRevision} disabled={!reason.trim()}>
              Send
            </Button>
          </>
        }
      >
        <Textarea
          label="Reason"
          required
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </Modal>
    </section>
  );
}

export interface DiffField {
  readonly fieldLabel: string;
  readonly before: string | null;
  readonly after: string | null;
}

export interface DiffViewerProps {
  readonly fields: readonly DiffField[];
}

/** Field-level before/after diff on a structured record — not a code-diff renderer (design system §5). */
export function DiffViewer({ fields }: DiffViewerProps): ReactNode {
  const changed = fields.filter((field) => field.before !== field.after);
  return (
    <table
      style={{ width: "100%", borderCollapse: "collapse", fontSize: typographyTokens.fontSizeSm }}
    >
      <caption
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          overflow: "hidden",
          clip: "rect(0 0 0 0)",
        }}
      >
        Field-level changes
      </caption>
      <thead>
        <tr>
          <th
            scope="col"
            style={{
              textAlign: "left",
              padding: spacingTokens.sm,
              color: colorTokens.foregroundMuted,
            }}
          >
            Field
          </th>
          <th
            scope="col"
            style={{
              textAlign: "left",
              padding: spacingTokens.sm,
              color: colorTokens.foregroundMuted,
            }}
          >
            Before
          </th>
          <th
            scope="col"
            style={{
              textAlign: "left",
              padding: spacingTokens.sm,
              color: colorTokens.foregroundMuted,
            }}
          >
            After
          </th>
        </tr>
      </thead>
      <tbody>
        {changed.length === 0 ? (
          <tr>
            <td
              colSpan={3}
              style={{ padding: spacingTokens.md, color: colorTokens.foregroundMuted }}
            >
              No field changes.
            </td>
          </tr>
        ) : (
          changed.map((field) => (
            <tr key={field.fieldLabel}>
              <td
                style={{ padding: spacingTokens.sm, fontWeight: typographyTokens.fontWeightMedium }}
              >
                {field.fieldLabel}
              </td>
              <td
                style={{
                  padding: spacingTokens.sm,
                  background: colorTokens.dangerSurface,
                  color: colorTokens.danger,
                }}
              >
                {field.before ?? <em>—</em>}
              </td>
              <td
                style={{
                  padding: spacingTokens.sm,
                  background: colorTokens.successSurface,
                  color: colorTokens.success,
                }}
              >
                {field.after ?? <em>—</em>}
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}

export interface FileAttachmentProps {
  readonly fileName: string;
  readonly fileType: string;
  readonly href: string | null;
  readonly restrictedMessage?: string;
}

/** References an asset (Vercel Blob) — never uploads/stores here. `href: null` + `restrictedMessage` renders a confidential-field-aware locked state instead of a link. */
export function FileAttachment({
  fileName,
  fileType,
  href,
  restrictedMessage,
}: FileAttachmentProps): ReactNode {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: spacingTokens.sm,
        padding: spacingTokens.sm,
        border: `${borderTokens.widthThin} solid ${colorTokens.border}`,
        borderRadius: radiusTokens.sm,
      }}
    >
      <span aria-hidden="true" style={{ color: colorTokens.foregroundMuted }}>
        📎
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        {href ? (
          <a
            href={href}
            style={{ fontSize: typographyTokens.fontSizeSm, color: colorTokens.accent }}
          >
            {fileName}
          </a>
        ) : (
          <span
            style={{ fontSize: typographyTokens.fontSizeSm, color: colorTokens.foregroundSubtle }}
          >
            {fileName}
          </span>
        )}
        <p
          style={{
            margin: 0,
            fontSize: typographyTokens.fontSizeXs,
            color: colorTokens.foregroundMuted,
          }}
        >
          {href
            ? fileType
            : (restrictedMessage ?? "Restricted — you don't have access to this file.")}
        </p>
      </div>
    </div>
  );
}

export interface RelationshipOption {
  readonly id: string;
  readonly displayName: string;
}

export interface RelationshipPickerProps {
  readonly label: string;
  readonly query: string;
  readonly onQueryChange: (query: string) => void;
  readonly options: readonly RelationshipOption[];
  readonly selected: readonly RelationshipOption[];
  readonly onSelect: (option: RelationshipOption) => void;
  readonly onRemove: (id: string) => void;
  readonly hint?: string;
}

/** Search-and-select for one record referencing another — returns a lightweight `{id, displayName}` reference, not the full related record. */
export function RelationshipPicker({
  label,
  query,
  onQueryChange,
  options,
  selected,
  onSelect,
  onRemove,
  hint,
}: RelationshipPickerProps): ReactNode {
  const inputId = useId();
  const listId = useId();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: spacingTokens.xs }}>
      <label
        htmlFor={inputId}
        style={{
          fontSize: typographyTokens.fontSizeSm,
          fontWeight: typographyTokens.fontWeightMedium,
          color: colorTokens.foreground,
        }}
      >
        {label}
      </label>
      {selected.length > 0 ? (
        <ul
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: spacingTokens.xs,
            margin: 0,
            padding: 0,
            listStyle: "none",
          }}
        >
          {selected.map((option) => (
            <li
              key={option.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: spacingTokens.xs,
                padding: `${spacingTokens.xs} ${spacingTokens.sm}`,
                borderRadius: radiusTokens.full,
                background: colorTokens.mutedSurface,
                fontSize: typographyTokens.fontSizeXs,
              }}
            >
              {option.displayName}
              <button
                type="button"
                aria-label={`Remove ${option.displayName}`}
                onClick={() => onRemove(option.id)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: colorTokens.foregroundMuted,
                }}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <input
        id={inputId}
        type="text"
        role="combobox"
        aria-expanded={options.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        aria-describedby={hint ? `${inputId}-hint` : undefined}
        style={{
          height: "2.25rem",
          paddingInline: spacingTokens.md,
          fontSize: typographyTokens.fontSizeMd,
          border: `${borderTokens.widthThin} solid ${colorTokens.border}`,
          borderRadius: radiusTokens.sm,
        }}
      />
      {hint ? (
        <p
          id={`${inputId}-hint`}
          style={{
            margin: 0,
            fontSize: typographyTokens.fontSizeXs,
            color: colorTokens.foregroundMuted,
          }}
        >
          {hint}
        </p>
      ) : null}
      {options.length > 0 ? (
        <ul
          id={listId}
          role="listbox"
          aria-label={label}
          style={{
            margin: 0,
            padding: spacingTokens.xs,
            listStyle: "none",
            border: `${borderTokens.widthThin} solid ${colorTokens.border}`,
            borderRadius: radiusTokens.sm,
          }}
        >
          {options.map((option) => (
            <li key={option.id} role="option" aria-selected={false}>
              <button
                type="button"
                onClick={() => onSelect(option)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: spacingTokens.sm,
                  background: "none",
                  border: "none",
                  font: "inherit",
                  cursor: "pointer",
                }}
              >
                {option.displayName}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export interface StepperStage {
  readonly id: string;
  readonly label: string;
}

export type StepperStageState = "complete" | "current" | "upcoming";

export interface StepperProps {
  readonly label: string;
  readonly stages: readonly StepperStage[];
  readonly currentStageId: string;
}

/** Scoped to Release Center, Page Workspace, and similarly explicitly staged workflows (Direction B borrowing) — never a generic status replacement. */
export function Stepper({ label, stages, currentStageId }: StepperProps): ReactNode {
  const currentIndex = stages.findIndex((stage) => stage.id === currentStageId);
  return (
    <ol
      aria-label={label}
      style={{
        display: "flex",
        alignItems: "center",
        gap: spacingTokens.sm,
        margin: 0,
        padding: 0,
        listStyle: "none",
      }}
    >
      {stages.map((stage, index) => {
        const state: StepperStageState =
          index < currentIndex ? "complete" : index === currentIndex ? "current" : "upcoming";
        return (
          <li
            key={stage.id}
            style={{ display: "flex", alignItems: "center", gap: spacingTokens.sm }}
          >
            <span
              aria-current={state === "current" ? "step" : undefined}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: "1.5rem",
                height: "1.5rem",
                borderRadius: radiusTokens.full,
                fontSize: typographyTokens.fontSizeXs,
                fontWeight: typographyTokens.fontWeightSemibold,
                background: state === "upcoming" ? colorTokens.mutedSurface : colorTokens.accent,
                color:
                  state === "upcoming" ? colorTokens.foregroundMuted : colorTokens.accentForeground,
              }}
            >
              {state === "complete" ? "✓" : index + 1}
            </span>
            <span
              style={{
                fontSize: typographyTokens.fontSizeSm,
                color: state === "upcoming" ? colorTokens.foregroundMuted : colorTokens.foreground,
              }}
            >
              {stage.label}
            </span>
            {index < stages.length - 1 ? (
              <span
                aria-hidden="true"
                style={{
                  width: "1.5rem",
                  height: borderTokens.widthThin,
                  background: colorTokens.border,
                }}
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
