"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import type { ApiSuccessResponse, Project, UserSummary } from "@webdesk/shared-types";
import { parseApiErrorMessage } from "@/lib/api-errors";
import { getApiBaseUrl } from "@/lib/auth";
import { CONFIDENTIALITY_LABEL, CONFIDENTIALITY_VALUES } from "@/lib/project-confidentiality";
import { findOverLongRichTextField, isEmptyRichTextHtml } from "@/lib/rich-text";
import { RichTextEditor } from "./rich-text-editor";
import { UserPicker } from "./user-picker";
import styles from "./project-form.module.css";

type Confidentiality = Project["confidentiality"];

export interface ProjectFormInitialValues {
  readonly publicId: string;
  readonly name: string;
  readonly description: string | null;
  readonly confidentiality: Confidentiality;
  /** Already resolved to a display summary by the edit page's own server-side `getUser()` call —
   *  this form never resolves an id to a name itself. `null` covers both "no owner assigned" and
   *  "the assigned owner id no longer resolves" (disabled/removed) identically; either way, the
   *  picker starts empty rather than showing a raw, meaningless UUID. */
  readonly owner: UserSummary | null;
  /** The project's raw, un-resolved owner id (or `null` if none is assigned) — distinct from
   *  `owner` above, which is `null` in BOTH the "no owner" and "owner set but unresolvable" cases.
   *  Kept separately so the submit payload can preserve an unresolvable owner assignment untouched
   *  (rather than silently clearing it) when the picker itself was never interacted with — see the
   *  `ownerTouched` logic in the submit handler below. */
  readonly ownerUserId: string | null;
}

export type ProjectFormProps =
  | { readonly mode: "create" }
  | {
      readonly mode: "edit";
      readonly projectId: string;
      readonly initial: ProjectFormInitialValues;
    };

// Mirrors apps/dashboard-api/src/projects/projects.dto.ts's createProjectSchema/updateProjectSchema —
// kept in sync by hand (this app has no runtime access to the backend's Zod schemas), same
// approach lib/projects.ts's parseProjectsSearchParams already uses for the list page's query.
const PUBLIC_ID_MAX_LENGTH = 64;
const NAME_MAX_LENGTH = 255;
// Raised from 10_000 alongside the backend's own DESCRIPTION_MAX_LENGTH bump — description is now
// HTML from the rich-text editor, carrying real markup overhead over the equivalent plain text,
// same reasoning as business-knowledge-record-form.tsx's own CONTENT_MAX_LENGTH raise.
const DESCRIPTION_MAX_LENGTH = 20_000;

/**
 * The Projects module's own unapproved list-screen proposal (`module-projects-foundation.md` §8)
 * scopes this form to name/description only, with status/archival handled by a separate,
 * dedicated transition action (not built here). `publicId` is create-only and immutable (absent
 * from `updateProjectSchema` entirely — migration `00036`'s own doc comment: "never regenerated
 * once assigned") so the edit form shows it as read-only reference text, not an input.
 * `ownerUserId` is now a real field via `UserPicker` — the backend schema always accepted it
 * (`createProjectSchema`/`updateProjectSchema`), but no UI could set it until the read-only
 * `GET /users` lookup capability existed to resolve a search into a real identity, closing the
 * gap the list/detail pages' own doc comments previously recorded ("no user-lookup endpoint
 * exists yet").
 *
 * `description` uses `RichTextEditor` (Tiptap), not a plain `<textarea>` — the resulting HTML is
 * sanitized server-side before it's ever stored (`project.service.ts`'s `sanitizeLongTextField()`)
 * and again at render time on the detail page, the same double-sanitization pattern
 * `BusinessKnowledgeRecordForm`'s own `content` field already established.
 *
 * Submits with a direct browser `fetch()` (not a Next.js Server Action), `credentials: "include"`,
 * following the one existing real-mutation precedent in this app
 * (`app/auth/emergency/page.tsx`) — `OriginCheckGuard` on `dashboard-api`'s mutating routes checks
 * the request's real `Origin` header, which only a genuine browser fetch sets automatically.
 */
export function ProjectForm(props: ProjectFormProps): ReactNode {
  const router = useRouter();
  const initial = props.mode === "edit" ? props.initial : null;

  const [publicId, setPublicId] = useState(initial?.publicId ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [confidentiality, setConfidentiality] = useState<Confidentiality>(
    initial?.confidentiality ?? "internal",
  );
  const [owner, setOwner] = useState<UserSummary | null>(initial?.owner ?? null);
  // Tracks whether the user has actually interacted with the owner picker (selected someone, or
  // clicked Remove) — as opposed to `owner` simply being `null` because the initial owner id
  // couldn't be resolved to a display summary (disabled/removed account). Only an explicit
  // interaction should ever change what gets submitted for ownerUserId; see handleOwnerChange.
  const [ownerTouched, setOwnerTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function handleOwnerChange(next: UserSummary | null): void {
    setOwner(next);
    setOwnerTouched(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const trimmedName = name.trim();
      // Never coerced to `null` — the schema accepts either "" or null just as validly, and
      // coercing to null would silently overwrite a project's existing stored value on any edit
      // that left this field untouched. Tiptap's own "nothing typed" output ("<p></p>") is
      // normalized to "" here (matching ServiceLibraryForm's own textField() convention) — left
      // as-is, it renders as truthy on the detail page, permanently showing an empty content box
      // instead of "No description." (code-review finding, this branch).
      const trimmedDescription = description.trim();
      const normalizedDescription = isEmptyRichTextHtml(trimmedDescription)
        ? ""
        : trimmedDescription;

      const lengthError = findOverLongRichTextField(
        [["Description", description]],
        DESCRIPTION_MAX_LENGTH,
      );
      if (lengthError) {
        setError(lengthError);
        return;
      }
      // If the owner picker was never touched, preserve the project's existing ownerUserId exactly
      // as-is — including an unresolvable one (a disabled/removed account) — rather than collapsing
      // it to null just because `owner` (the resolved display summary) happens to be null. Only an
      // explicit picker interaction (selecting someone new, or clicking Remove) should ever change
      // this value; otherwise saving an unrelated field edit would silently clear the assignment.
      const ownerUserId = ownerTouched ? (owner?.id ?? null) : (initial?.ownerUserId ?? null);
      const payload =
        props.mode === "create"
          ? {
              publicId: publicId.trim(),
              name: trimmedName,
              description: normalizedDescription,
              confidentiality,
              ownerUserId,
            }
          : {
              name: trimmedName,
              description: normalizedDescription,
              confidentiality,
              ownerUserId,
            };
      const url =
        props.mode === "create"
          ? `${getApiBaseUrl()}/projects`
          : `${getApiBaseUrl()}/projects/${props.projectId}/update`;

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

      const body = (await response.json()) as ApiSuccessResponse<Project>;
      router.push(`/projects/${body.data.id}`);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
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
            A short, stable identifier for this project. Cannot be changed later.
          </span>
        </div>
      ) : (
        <div className={styles.field}>
          <span className={styles.label}>Public ID</span>
          <span className={styles.readonlyValue}>{props.initial.publicId}</span>
          <span className={styles.helperText}>Permanent — set when the project was created.</span>
        </div>
      )}

      <div className={styles.field}>
        <label htmlFor="name" className={styles.label}>
          Name
        </label>
        <input
          id="name"
          type="text"
          required
          maxLength={NAME_MAX_LENGTH}
          value={name}
          onChange={(event) => setName(event.target.value)}
          className={styles.input}
        />
      </div>

      <div className={styles.field}>
        <label htmlFor="description" className={styles.label}>
          Description
        </label>
        <RichTextEditor id="description" value={description} onChange={setDescription} />
      </div>

      <UserPicker
        id="owner"
        label="Owner"
        value={owner}
        onChange={handleOwnerChange}
        helperText={
          props.mode === "edit" && !ownerTouched && !owner && initial?.ownerUserId
            ? "This project has an assigned owner that could not be resolved (the account may be disabled or removed). The existing assignment will be kept as-is unless you search and select someone new."
            : "Search by name or email. Leave unset for no assigned owner."
        }
      />

      <div className={styles.field}>
        <label htmlFor="confidentiality" className={styles.label}>
          Confidentiality
        </label>
        <select
          id="confidentiality"
          value={confidentiality}
          onChange={(event) => setConfidentiality(event.target.value as Confidentiality)}
          className={styles.select}
        >
          {CONFIDENTIALITY_VALUES.map((value) => (
            <option key={value} value={value}>
              {CONFIDENTIALITY_LABEL[value]}
            </option>
          ))}
        </select>
      </div>

      {error ? (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      ) : null}

      <div className={styles.actions}>
        <button type="submit" disabled={submitting} className={styles.submitButton}>
          {submitting ? "Saving…" : props.mode === "create" ? "Create project" : "Save changes"}
        </button>
        <a
          href={props.mode === "create" ? "/projects" : `/projects/${props.projectId}`}
          className={styles.cancelLink}
        >
          Cancel
        </a>
      </div>
    </form>
  );
}
