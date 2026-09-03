"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import type { ApiSuccessResponse, ReleaseArtifact } from "@webdesk/shared-types";
import { parseApiErrorMessage } from "@/lib/api-errors";
import { getApiBaseUrl } from "@/lib/auth";
import { isSafeHttpUrl } from "@/lib/safe-http-url";
import { usePendingIds } from "@/lib/use-pending-ids";
import styles from "./release-artifacts-section.module.css";

export interface ReleaseArtifactsSectionProps {
  readonly projectId: string;
  readonly releaseId: string;
  readonly initialArtifacts: readonly ReleaseArtifact[];
  /** Hides the Delete action once the parent release is `completed`/`rolled_back` — a UX nicety
   *  only; the backend independently rejects the delete outright once the release reaches either
   *  status, so a stale button click here would just surface that real 400/409 via
   *  `parseApiErrorMessage()`, not a security boundary this flag enforces. */
  readonly deletionBlocked: boolean;
}

interface ArtifactFormValues {
  readonly repoOwner: string;
  readonly repoName: string;
  readonly commitSha: string;
  readonly prUrl: string;
}

const EMPTY_FORM: ArtifactFormValues = { repoOwner: "", repoName: "", commitSha: "", prUrl: "" };

// Mirrors apps/dashboard-api/src/release-center/release-center.dto.ts's createReleaseArtifactSchema.
const REPO_SEGMENT_MAX_LENGTH = 255;
const REPO_SEGMENT_PATTERN = /^[\w.-]+$/;
const COMMIT_SHA_MAX_LENGTH = 40;

/**
 * `release_artifacts` ("repositories and SHAs, PRs") editing — create/list/delete, no update route
 * (`ReleaseArtifactsController` exposes no `PATCH`/`:id/update`), so this section is add-and-list-
 * and-delete only, composing its CSS from the same shared `project-subresource-section.module.css`
 * base every genuine sub-resource in this app uses.
 *
 * `repoOwner`/`repoName` are validated client-side against the same plain-segment pattern the
 * backend's own `repoOwnerOrName` schema enforces (`/^[\w.-]+$/`, no slashes or spaces) before
 * submit, so a rejected value surfaces as a clear, specific error rather than a raw 400. `prUrl` is
 * optional and validated (when present) client-side via `isSafeHttpUrl()` before submit, and only
 * ever rendered as a clickable link when that same guard passes — the backend's own
 * `safeHttpUrlSchema` already restricts it server-side, but this stays defense-in-depth, matching
 * every other stored-URL field in this app.
 *
 * Delete uses the real HTTP `DELETE` method (`ReleaseArtifactsController.remove()` is a genuine
 * `@Delete(":artifactId")` route, unlike `PageUrlsController`'s/`ClaimSourcesController`'s own
 * `POST .../delete` convention) and returns `204 No Content` on success.
 */
export function ReleaseArtifactsSection({
  projectId,
  releaseId,
  initialArtifacts,
  deletionBlocked,
}: ReleaseArtifactsSectionProps): ReactNode {
  const [artifacts, setArtifacts] = useState(initialArtifacts);
  const [error, setError] = useState<string | null>(null);
  const [values, setValues] = useState<ArtifactFormValues>(EMPTY_FORM);
  const [adding, setAdding] = useState(false);
  const { pendingIds, markPending } = usePendingIds();

  useEffect(() => {
    setArtifacts(initialArtifacts);
  }, [initialArtifacts]);

  const basePath = `${getApiBaseUrl()}/release-center/projects/${projectId}/releases/${releaseId}/artifacts`;

  async function handleAdd(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const repoOwner = values.repoOwner.trim();
    const repoName = values.repoName.trim();
    const commitSha = values.commitSha.trim();
    const prUrl = values.prUrl.trim();

    if (!repoOwner || !repoName || !commitSha) {
      setError("Repository owner, repository name, and commit SHA are all required.");
      return;
    }
    if (!REPO_SEGMENT_PATTERN.test(repoOwner) || !REPO_SEGMENT_PATTERN.test(repoName)) {
      setError("Repository owner and name must be a plain GitHub segment — no slashes or spaces.");
      return;
    }
    if (prUrl !== "" && !isSafeHttpUrl(prUrl)) {
      setError("PR URL must be a valid http:// or https:// URL.");
      return;
    }

    setError(null);
    setAdding(true);
    try {
      const response = await fetch(basePath, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repoOwner,
          repoName,
          commitSha,
          prUrl: prUrl || null,
        }),
      });
      if (!response.ok) {
        setError(await parseApiErrorMessage(response));
        return;
      }
      const body = (await response.json()) as ApiSuccessResponse<ReleaseArtifact>;
      setArtifacts((current) => [...current, body.data]);
      setValues(EMPTY_FORM);
    } catch (err) {
      console.error("Failed to add release artifact", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(id: string): Promise<void> {
    setError(null);
    markPending(id, true);
    try {
      const response = await fetch(`${basePath}/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok && response.status !== 204) {
        setError(await parseApiErrorMessage(response));
        return;
      }
      setArtifacts((current) => current.filter((item) => item.id !== id));
    } catch (err) {
      console.error("Failed to delete release artifact", err);
      setError("Something went wrong. Please try again.");
    } finally {
      markPending(id, false);
    }
  }

  return (
    <div>
      {artifacts.length === 0 ? (
        <p className={styles.muted}>No artifacts recorded yet.</p>
      ) : (
        <ul className={styles.list}>
          {artifacts.map((artifact) => (
            <li key={artifact.id} className={styles.row}>
              <span className={styles.rowMain}>
                <span className={styles.primaryText}>
                  {artifact.repoOwner}/{artifact.repoName}
                  {" @ "}
                  {artifact.commitSha}
                </span>
                {artifact.prUrl ? (
                  <span className={styles.secondaryText}>
                    {isSafeHttpUrl(artifact.prUrl) ? (
                      <a href={artifact.prUrl} target="_blank" rel="noopener noreferrer">
                        {artifact.prUrl}
                      </a>
                    ) : (
                      artifact.prUrl
                    )}
                  </span>
                ) : null}
              </span>
              {!deletionBlocked ? (
                <span className={styles.rowActions}>
                  <button
                    type="button"
                    disabled={pendingIds.has(artifact.id)}
                    onClick={() => void handleDelete(artifact.id)}
                    className={styles.deleteButton}
                  >
                    {pendingIds.has(artifact.id) ? "…" : "Delete"}
                  </button>
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {!deletionBlocked ? (
        <form className={styles.addForm} onSubmit={(event) => void handleAdd(event)}>
          <p className={styles.addFormTitle}>Add artifact</p>
          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <label htmlFor="new-artifact-repo-owner" className={styles.label}>
                Repository owner
              </label>
              <input
                id="new-artifact-repo-owner"
                type="text"
                maxLength={REPO_SEGMENT_MAX_LENGTH}
                value={values.repoOwner}
                onChange={(event) => setValues((v) => ({ ...v, repoOwner: event.target.value }))}
                className={styles.input}
              />
            </div>
            <div className={styles.field}>
              <label htmlFor="new-artifact-repo-name" className={styles.label}>
                Repository name
              </label>
              <input
                id="new-artifact-repo-name"
                type="text"
                maxLength={REPO_SEGMENT_MAX_LENGTH}
                value={values.repoName}
                onChange={(event) => setValues((v) => ({ ...v, repoName: event.target.value }))}
                className={styles.input}
              />
            </div>
            <div className={styles.field}>
              <label htmlFor="new-artifact-commit-sha" className={styles.label}>
                Commit SHA
              </label>
              <input
                id="new-artifact-commit-sha"
                type="text"
                maxLength={COMMIT_SHA_MAX_LENGTH}
                value={values.commitSha}
                onChange={(event) => setValues((v) => ({ ...v, commitSha: event.target.value }))}
                className={styles.input}
              />
            </div>
          </div>
          <div className={styles.field}>
            <label htmlFor="new-artifact-pr-url" className={styles.label}>
              PR URL (optional)
            </label>
            <input
              id="new-artifact-pr-url"
              type="url"
              value={values.prUrl}
              onChange={(event) => setValues((v) => ({ ...v, prUrl: event.target.value }))}
              className={styles.input}
            />
          </div>
          <div className={styles.formActions}>
            <button type="submit" className={styles.submitButton} disabled={adding}>
              {adding ? "Adding…" : "Add artifact"}
            </button>
          </div>
        </form>
      ) : null}

      {error ? (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
