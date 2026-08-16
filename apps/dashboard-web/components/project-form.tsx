"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import type { ApiErrorResponse, ApiSuccessResponse, Project } from "@webdesk/shared-types";
import { getApiBaseUrl } from "@/lib/auth";
import { CONFIDENTIALITY_LABEL, CONFIDENTIALITY_VALUES } from "@/lib/project-confidentiality";
import styles from "./project-form.module.css";

type Confidentiality = Project["confidentiality"];

export interface ProjectFormInitialValues {
  readonly publicId: string;
  readonly name: string;
  readonly description: string | null;
  readonly confidentiality: Confidentiality;
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
 * `ownerUserId` is deliberately not a form field in either mode — no user-lookup/picker capability
 * exists anywhere in this app yet, the same constraint that already shaped the list and detail
 * pages' own omission of owner identity.
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
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const trimmedName = name.trim();
      const trimmedDescription = description.trim();
      const payload =
        props.mode === "create"
          ? {
              publicId: publicId.trim(),
              name: trimmedName,
              description: trimmedDescription ? trimmedDescription : null,
              confidentiality,
            }
          : {
              name: trimmedName,
              description: trimmedDescription ? trimmedDescription : null,
              confidentiality,
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
        const body = (await response.json().catch(() => null)) as ApiErrorResponse | null;
        setError(body?.error.message ?? "Something went wrong. Please try again.");
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
