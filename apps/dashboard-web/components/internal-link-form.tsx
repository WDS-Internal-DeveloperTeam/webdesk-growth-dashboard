"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import type { InternalLink, InternalLinkPriority, Page, UserSummary } from "@webdesk/shared-types";
import { RelationshipPicker, type RelationshipOption } from "@webdesk/ui";
import { parseApiErrorMessage } from "@/lib/api-errors";
import { getApiBaseUrl } from "@/lib/auth";
import { plainTextFieldValue } from "@/lib/form-field-value";
import {
  PRIORITY_LABEL,
  PRIORITY_VALUES,
  withProjectId,
} from "@/lib/internal-linking-library-query";
import { findOverLongRichTextField, richTextFieldValue } from "@/lib/rich-text";
import { isUuid } from "@/lib/uuid";
import { RichTextEditor } from "./rich-text-editor";
import { UserPicker } from "./user-picker";
import styles from "./internal-link-form.module.css";

// Mirrors apps/dashboard-api/src/internal-linking-library/internal-linking-library.dto.ts — kept
// in sync by hand, same approach every sibling form in this app uses.
const PUBLIC_ID_MAX_LENGTH = 64;
const SHORT_TEXT_MAX_LENGTH = 255;
const CONTEXT_MAX_LENGTH = 4_000;

function toPageOption(page: Page): RelationshipOption {
  return { id: page.id, displayName: page.pageName };
}

export type InternalLinkFormProps =
  | {
      readonly mode: "create";
      readonly projectId: string;
      readonly pages: readonly Page[];
    }
  | {
      readonly mode: "edit";
      readonly projectId: string;
      readonly linkId: string;
      readonly initial: InternalLink;
      readonly pages: readonly Page[];
      /** Already resolved to a real name by the edit page's own server-side `getPage()` call —
       *  falls back to the raw id as its own option when the page can't be resolved (deleted, or
       *  simply outside the picker's own bounded top-100 fetch window) — a real relationship is
       *  never invisible or unremovable in this form, mirroring `PersonaLibraryForm`'s own raw-id
       *  fallback precedent for the identical case. Always non-null — `sourcePageId`/`targetPageId`
       *  are required fields on every real link. */
      readonly initialSourcePage: RelationshipOption;
      readonly initialTargetPage: RelationshipOption;
      /** Already resolved to a display summary by the edit page's own server-side `getUser()`
       *  call — this form never resolves an id to a name itself, mirroring `ProjectForm`'s own
       *  `owner`/`ownerUserId` split. `null` covers both "no approver assigned" and "the assigned
       *  approver id no longer resolves" (disabled/removed) identically. */
      readonly initialApprover: UserSummary | null;
    };

/**
 * A single-value wrapper around `@webdesk/ui`'s `RelationshipPicker` — no prior consumer in this
 * codebase needs single-value selection (every existing `RelationshipPicker` use is a many-to-many
 * sub-resource join list), so this form builds it locally rather than reusing an existing pattern.
 * `onSelect` REPLACES the current selection (not appends, unlike a real many-to-many picker) and
 * `onRemove`/the picker's own chip "x" button clears it back to `null`. `excludeId` (the id
 * currently selected in the OTHER picker) is filtered out of the option pool so a user can't
 * easily pick the same page for both fields — the real, authoritative self-link guard still runs
 * server-side (case-insensitively) and is re-checked client-side at submit time below; this is
 * purely a UX nicety, not the enforcement point.
 */
function SinglePagePicker({
  label,
  pages,
  excludeId,
  selected,
  onChange,
  hint,
}: {
  readonly label: string;
  readonly pages: readonly Page[];
  readonly excludeId: string | null;
  readonly selected: RelationshipOption | null;
  readonly onChange: (next: RelationshipOption | null) => void;
  readonly hint?: string;
}): ReactNode {
  const [query, setQuery] = useState("");

  const options = useMemo(() => {
    const lowerQuery = query.trim().toLowerCase();
    return pages
      .filter(
        (page) =>
          page.id !== excludeId &&
          page.id !== selected?.id &&
          (lowerQuery === "" || page.pageName.toLowerCase().includes(lowerQuery)),
      )
      .map(toPageOption)
      .slice(0, 20);
  }, [pages, excludeId, selected, query]);

  return (
    <RelationshipPicker
      label={label}
      query={query}
      onQueryChange={setQuery}
      options={options}
      selected={selected ? [selected] : []}
      onSelect={(option) => {
        onChange(option);
        setQuery("");
      }}
      onRemove={() => onChange(null)}
      hint={hint}
    />
  );
}

/**
 * Create/edit form for an Internal Linking Library link record. No approved wireframe field-level
 * spec exists for this screen — `packages/database/src/internal-linking-library/entities.ts`'s own
 * field list plus the backend's actual `createInternalLinkSchema`/`updateInternalLinkSchema`
 * (`apps/dashboard-api/src/internal-linking-library/internal-linking-library.dto.ts`) is the only
 * source, matching every sibling module's own "smallest honest reading" precedent for an unsourced
 * screen.
 *
 * `publicId` is create-only (shown read-only on edit, matching every sibling form's own
 * `publicId`/`recordType` convention). `status`/`implementedAt`/`verifiedAt` are deliberately never
 * fields here — only the dedicated `POST .../status` route (`InternalLinkStatusActions`) may change
 * `status`, and `implementedAt`/`verifiedAt` are server-stamped exclusively by that route's own
 * atomic write, matching `updateInternalLinkSchema`'s own contract.
 *
 * `sourcePageId`/`targetPageId` ARE editable here (unlike `publicId`/`projectId`) — two independent
 * `SinglePagePicker` fields (see its own doc comment above), each excluding whichever page is
 * currently selected in the other. A client-side check blocks submitting the same page for both
 * before ever hitting the network — the real, authoritative guard is still server-side.
 *
 * `context` uses `RichTextEditor`, per the 2026-08-22 standing rule — sanitized server-side before
 * it's ever stored (`InternalLinksService.create()`/`update()`'s `sanitizeNullableRichText()`/
 * `sanitizeNullableRichTextIfChanged()`) and again at render time via `SanitizedRichText`, the same
 * double-sanitization pattern every other rich-text field in this app already establishes.
 *
 * `relatedStrategyRecordId` is a plain, OPTIONAL text input, NOT a picker — the backend deliberately
 * never validates it against `website_strategy_records` (task package D8, that module has no lookup
 * hook yet) — but it must still be UUID-SHAPED if provided (the backend's own `z.string().uuid()`
 * schema rejects anything else with a clean 400), so a lightweight client-side format check runs at
 * submit time to avoid a round trip for an obviously-malformed value.
 *
 * Submits via a direct browser `fetch()` with `credentials: "include"` — required for
 * `dashboard-api`'s `OriginCheckGuard` to see a real browser `Origin` header, the same pattern every
 * mutation form in this app already uses. `projectId` is always a prop (never a form field) —
 * internal links are project-scoped, and the project id is threaded into both the submit URL and
 * the post-submit redirect, never derived from the form's own fields.
 */
export function InternalLinkForm(props: InternalLinkFormProps): ReactNode {
  const router = useRouter();
  const initial = props.mode === "edit" ? props.initial : null;

  const [publicId, setPublicId] = useState(initial?.publicId ?? "");
  const [sourcePage, setSourcePage] = useState<RelationshipOption | null>(
    props.mode === "edit" ? props.initialSourcePage : null,
  );
  const [targetPage, setTargetPage] = useState<RelationshipOption | null>(
    props.mode === "edit" ? props.initialTargetPage : null,
  );
  const [context, setContext] = useState(initial?.context ?? "");
  const [anchor, setAnchor] = useState(initial?.anchor ?? "");
  const [relationship, setRelationship] = useState(initial?.relationship ?? "");
  const [linkType, setLinkType] = useState(initial?.linkType ?? "");
  const [priority, setPriority] = useState<InternalLinkPriority | "">(initial?.priority ?? "");
  const [detector, setDetector] = useState(initial?.detector ?? "");
  const [approver, setApprover] = useState<UserSummary | null>(
    props.mode === "edit" ? props.initialApprover : null,
  );
  // Tracks whether the user actually interacted with the approver picker — as opposed to
  // `approver` simply being `null` because the initial approver id couldn't be resolved to a
  // display summary (disabled/removed account). Only an explicit interaction should ever change
  // what gets submitted for assignedApproverUserId, mirroring ProjectForm's own ownerTouched.
  const [approverTouched, setApproverTouched] = useState(false);
  const [relatedStrategyRecordId, setRelatedStrategyRecordId] = useState(
    initial?.relatedStrategyRecordId ?? "",
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function handleApproverChange(next: UserSummary | null): void {
    setApprover(next);
    setApproverTouched(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);

    if (!sourcePage || !targetPage) {
      setError("Both a source page and a target page are required.");
      return;
    }
    if (sourcePage.id.toLowerCase() === targetPage.id.toLowerCase()) {
      setError("Source and target must be different pages.");
      return;
    }
    const trimmedRelatedStrategyRecordId = relatedStrategyRecordId.trim();
    if (trimmedRelatedStrategyRecordId && !isUuid(trimmedRelatedStrategyRecordId)) {
      setError("Related strategy record ID must be a valid UUID.");
      return;
    }

    setSubmitting(true);
    try {
      const plainTextField = (value: string): string | null | undefined =>
        plainTextFieldValue(value, props.mode);

      function richTextField(value: string): string | null | undefined {
        return richTextFieldValue(value, props.mode);
      }

      const lengthError = findOverLongRichTextField([["Context", context]], CONTEXT_MAX_LENGTH);
      if (lengthError) {
        setError(lengthError);
        return;
      }

      const sharedFields = {
        sourcePageId: sourcePage.id,
        targetPageId: targetPage.id,
        relationship: plainTextField(relationship),
        anchor: plainTextField(anchor),
        context: richTextField(context),
        linkType: plainTextField(linkType),
        priority: priority === "" ? (props.mode === "create" ? undefined : null) : priority,
        detector: plainTextField(detector),
        assignedApproverUserId: approverTouched
          ? (approver?.id ?? null)
          : props.mode === "edit"
            ? props.initial.assignedApproverUserId
            : undefined,
        relatedStrategyRecordId: trimmedRelatedStrategyRecordId
          ? trimmedRelatedStrategyRecordId
          : props.mode === "create"
            ? undefined
            : null,
      };

      const payload =
        props.mode === "create" ? { ...sharedFields, publicId: publicId.trim() } : sharedFields;

      const url =
        props.mode === "create"
          ? `${getApiBaseUrl()}/internal-linking-library/projects/${props.projectId}/links`
          : `${getApiBaseUrl()}/internal-linking-library/projects/${props.projectId}/links/${props.linkId}/update`;

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

      const linkId =
        props.mode === "create"
          ? ((await response.json()) as { data: { id: string } }).data.id
          : props.linkId;
      router.push(withProjectId(`/internal-linking-library/${linkId}`, props.projectId));
    } catch (err) {
      console.error("Failed to save internal link", err);
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
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend className={styles.fieldsetLegend}>Relationship</legend>

        <div className={styles.field}>
          <SinglePagePicker
            label="Source page"
            pages={props.pages}
            excludeId={targetPage?.id ?? null}
            selected={sourcePage}
            onChange={setSourcePage}
            hint="The page the link is placed on."
          />
        </div>

        <div className={styles.field}>
          <SinglePagePicker
            label="Target page"
            pages={props.pages}
            excludeId={sourcePage?.id ?? null}
            selected={targetPage}
            onChange={setTargetPage}
            hint="The page the link points to."
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="relationship" className={styles.label}>
            Relationship
          </label>
          <input
            id="relationship"
            type="text"
            maxLength={SHORT_TEXT_MAX_LENGTH}
            value={relationship}
            onChange={(event) => setRelationship(event.target.value)}
            className={styles.input}
          />
        </div>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend className={styles.fieldsetLegend}>Content</legend>

        <div className={styles.field}>
          <label htmlFor="anchor" className={styles.label}>
            Anchor text
          </label>
          <input
            id="anchor"
            type="text"
            maxLength={SHORT_TEXT_MAX_LENGTH}
            value={anchor}
            onChange={(event) => setAnchor(event.target.value)}
            className={styles.input}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="context" className={styles.label}>
            Context
          </label>
          <RichTextEditor id="context" value={context} onChange={setContext} />
        </div>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend className={styles.fieldsetLegend}>Classification</legend>

        <div className={styles.field}>
          <label htmlFor="linkType" className={styles.label}>
            Link type
          </label>
          <input
            id="linkType"
            type="text"
            maxLength={SHORT_TEXT_MAX_LENGTH}
            value={linkType}
            onChange={(event) => setLinkType(event.target.value)}
            className={styles.input}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="priority" className={styles.label}>
            Priority
          </label>
          <select
            id="priority"
            value={priority}
            onChange={(event) => setPriority(event.target.value as InternalLinkPriority | "")}
            className={styles.select}
          >
            <option value="">Not set</option>
            {PRIORITY_VALUES.map((value) => (
              <option key={value} value={value}>
                {PRIORITY_LABEL[value]}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label htmlFor="detector" className={styles.label}>
            Detector
          </label>
          <input
            id="detector"
            type="text"
            maxLength={SHORT_TEXT_MAX_LENGTH}
            value={detector}
            onChange={(event) => setDetector(event.target.value)}
            className={styles.input}
          />
          <span className={styles.helperText}>
            How this link was identified — an automated scan tool name, or &quot;manual&quot;.
          </span>
        </div>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend className={styles.fieldsetLegend}>Governance</legend>

        <UserPicker
          id="assignedApproverUserId"
          label="Assigned approver"
          value={approver}
          onChange={handleApproverChange}
          helperText={
            props.mode === "edit" &&
            !approverTouched &&
            !approver &&
            props.initial.assignedApproverUserId
              ? "This link has an assigned approver that could not be resolved (the account may be disabled or removed). The existing assignment will be kept as-is unless you search and select someone new."
              : "Search by name or email. Leave unset for no assigned approver."
          }
        />

        <div className={styles.field}>
          <label htmlFor="relatedStrategyRecordId" className={styles.label}>
            Related strategy record ID
          </label>
          <input
            id="relatedStrategyRecordId"
            type="text"
            value={relatedStrategyRecordId}
            onChange={(event) => setRelatedStrategyRecordId(event.target.value)}
            className={styles.input}
          />
          <span className={styles.helperText}>
            Optional link to a Website Strategy Center record — not validated, since no lookup
            exists for this relationship yet.
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
          {submitting ? "Saving…" : props.mode === "create" ? "Create link" : "Save changes"}
        </button>
        <a
          href={
            props.mode === "create"
              ? withProjectId("/internal-linking-library", props.projectId)
              : withProjectId(`/internal-linking-library/${props.linkId}`, props.projectId)
          }
          className={styles.cancelLink}
        >
          Cancel
        </a>
      </div>
    </form>
  );
}
