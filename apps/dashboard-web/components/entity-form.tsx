"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import type { EntityRecord } from "@webdesk/shared-types";
import { parseApiErrorMessage } from "@/lib/api-errors";
import { getApiBaseUrl } from "@/lib/auth";
import { withProjectId } from "@/lib/keyword-and-entity-library-query";
import { findOverLongRichTextField, richTextFieldValue } from "@/lib/rich-text";
import { RichTextEditor } from "./rich-text-editor";
import styles from "./entity-form.module.css";

// Mirrors apps/dashboard-api/src/keyword-and-entity-library/keyword-and-entity-library.dto.ts.
const PUBLIC_ID_MAX_LENGTH = 64;
const NAME_MAX_LENGTH = 255;
const ENTITY_TYPE_MAX_LENGTH = 100;
const LONG_TEXT_MAX_LENGTH = 40_000;

export type EntityFormProps =
  | { readonly mode: "create"; readonly projectId: string }
  | {
      readonly mode: "edit";
      readonly projectId: string;
      readonly entityId: string;
      readonly initial: EntityRecord;
    };

/**
 * Create/edit form for a Keyword & Entity Library entity record — a lightweight, project-scoped
 * reference record with no approval workflow of its own (task package D3), so this form has no
 * status field or transition actions, unlike `KeywordForm`. `publicId` is create-only (shown
 * read-only on edit, matching every sibling form's own convention). `description` uses
 * `RichTextEditor`, per the 2026-08-22 standing rule — sanitized server-side before storage
 * (`EntitiesService.create()`/`update()`) and again at render time via `SanitizedRichText`.
 */
export function EntityForm(props: EntityFormProps): ReactNode {
  const router = useRouter();
  const initial = props.mode === "edit" ? props.initial : null;

  const [publicId, setPublicId] = useState(initial?.publicId ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [entityType, setEntityType] = useState(initial?.entityType ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      // name is a real HTML `required` field — the browser's own constraint validation blocks a
      // submit event from ever firing while it's empty, so no redundant JS-level check is needed
      // here, matching KeywordForm/ProjectForm's own precedent.
      const trimmedName = name.trim();

      function textField(value: string): string | null | undefined {
        const trimmed = value.trim();
        if (trimmed !== "") return trimmed;
        return props.mode === "create" ? undefined : null;
      }

      function richTextField(value: string): string | null | undefined {
        return richTextFieldValue(value, props.mode);
      }

      const lengthError = findOverLongRichTextField(
        [["Description", description]],
        LONG_TEXT_MAX_LENGTH,
      );
      if (lengthError) {
        setError(lengthError);
        return;
      }

      const sharedFields = {
        name: trimmedName,
        entityType: textField(entityType),
        description: richTextField(description),
      };

      const payload =
        props.mode === "create" ? { ...sharedFields, publicId: publicId.trim() } : sharedFields;

      const url =
        props.mode === "create"
          ? `${getApiBaseUrl()}/keyword-and-entity-library/projects/${props.projectId}/entities`
          : `${getApiBaseUrl()}/keyword-and-entity-library/projects/${props.projectId}/entities/${props.entityId}/update`;

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

      const entityId =
        props.mode === "create"
          ? ((await response.json()) as { data: { id: string } }).data.id
          : props.entityId;
      router.push(withProjectId(`/keyword-and-entity-library/entities/${entityId}`, props.projectId));
    } catch (err) {
      console.error("Failed to save entity", err);
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
          <label htmlFor="entityType" className={styles.label}>
            Entity type
          </label>
          <input
            id="entityType"
            type="text"
            maxLength={ENTITY_TYPE_MAX_LENGTH}
            value={entityType}
            onChange={(event) => setEntityType(event.target.value)}
            className={styles.input}
          />
          <span className={styles.helperText}>
            Free text — e.g. Person, Organization, Place, Concept, Brand.
          </span>
        </div>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend className={styles.fieldsetLegend}>Description</legend>
        <div className={styles.field}>
          <label htmlFor="description" className={styles.label}>
            Description
          </label>
          <RichTextEditor id="description" value={description} onChange={setDescription} />
        </div>
      </fieldset>

      {error ? (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      ) : null}

      <div className={styles.actions}>
        <button type="submit" disabled={submitting} className={styles.submitButton}>
          {submitting ? "Saving…" : props.mode === "create" ? "Create entity" : "Save changes"}
        </button>
        <a
          href={
            props.mode === "create"
              ? withProjectId("/keyword-and-entity-library/entities", props.projectId)
              : withProjectId(
                  `/keyword-and-entity-library/entities/${props.entityId}`,
                  props.projectId,
                )
          }
          className={styles.cancelLink}
        >
          Cancel
        </a>
      </div>
    </form>
  );
}
