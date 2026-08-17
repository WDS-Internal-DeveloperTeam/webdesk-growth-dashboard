"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import type { ApiSuccessResponse, Project, UserSummary } from "@webdesk/shared-types";
import { parseApiErrorMessage } from "@/lib/api-errors";
import { getApiBaseUrl } from "@/lib/auth";
import { CONFIDENTIALITY_LABEL, CONFIDENTIALITY_VALUES } from "@/lib/project-confidentiality";
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
const DESCRIPTION_MAX_LENGTH = 10_000;

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
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const trimmedName = name.trim();
      // Sent as-is (may be ""), never coerced to `null` — the schema accepts an empty string just
      // as validly as null, and coercing would silently overwrite a project's existing stored ""
      // with null on any edit that left this field untouched (both render identically either way,
      // so there's no display reason to prefer one over the other).
      const trimmedDescription = description.trim();
      const payload =
        props.mode === "create"
          ? {
              publicId: publicId.trim(),
              name: trimmedName,
              description: trimmedDescription,
              confidentiality,
              ownerUserId: owner?.id ?? null,
            }
          : {
              name: trimmedName,
              description: trimmedDescription,
              confidentiality,
              ownerUserId: owner?.id ?? null,
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
        <textarea
          id="description"
          rows={4}
          maxLength={DESCRIPTION_MAX_LENGTH}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          className={styles.textarea}
        />
      </div>

      <UserPicker
        id="owner"
        label="Owner"
        value={owner}
        onChange={setOwner}
        helperText="Search by name or email. Leave unset for no assigned owner."
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
