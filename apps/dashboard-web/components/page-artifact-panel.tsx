"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type {
  PageArtifact,
  PageArtifactType,
  PageArtifactVersion,
  PageArtifactVersionStatus,
} from "@webdesk/shared-types";
import { postMutation, parseApiErrorMessage } from "../lib/api-errors";
import {
  REOPENABLE_STATUSES,
  VERSION_REASON_REQUIRED,
  VERSION_STATUS_LABEL,
  VERSION_TRANSITIONS,
} from "../lib/page-workspace-query";
import type { ReactNode } from "react";
import { RichTextEditor } from "./rich-text-editor";
import styles from "./page-artifact-panel.module.css";

export interface PageArtifactPanelProps {
  readonly projectId: string;
  readonly pageId: string;
  readonly artifactType: PageArtifactType;
  readonly tabLabel: string;
  readonly artifact: PageArtifact | null;
  readonly currentVersion: PageArtifactVersion | null;
  /**
   * The rendered, already-sanitized read view, produced by the SERVER and passed across the
   * boundary as a ReactNode.
   *
   * It cannot be rendered here: `SanitizedRichText` wraps `sanitize-html`, a Node-only package,
   * so a client component cannot call it. Passing the rendered node rather than the raw HTML also
   * means unsanitized content never reaches the browser bundle at all. Same ReactNode-across-the-
   * boundary convention `IconBadge` already uses.
   */
  readonly readView: ReactNode;
}

/**
 * The one component that drives all 15 artifact tabs — they are homogeneous, so this is data-driven
 * rather than fifteen bespoke screens.
 *
 * Every control it offers is mirrored from the backend's own rules (which transitions are legal,
 * which need a reason, when a version may be edited in place). The backend re-validates all of it;
 * this only decides what to SHOW, so a drift shows up as a 400, never as an unauthorized action.
 */
export function PageArtifactPanel({
  projectId,
  pageId,
  artifactType,
  tabLabel,
  artifact,
  currentVersion,
  readView,
}: PageArtifactPanelProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(currentVersion?.content ?? "");
  const [notes, setNotes] = useState(currentVersion?.notes ?? "");

  const base = `/page-workspace/projects/${projectId}/pages/${pageId}/artifacts`;
  const isDraft = currentVersion?.status === "draft";
  const canReopen = currentVersion !== null && REOPENABLE_STATUSES.includes(currentVersion.status);
  const nextStatuses: readonly PageArtifactVersionStatus[] = currentVersion
    ? (VERSION_TRANSITIONS[currentVersion.status] ?? [])
    : [];

  async function run(action: () => Promise<{ ok: boolean; message?: string }>) {
    setBusy(true);
    setError(null);
    const result = await action();
    if (!result.ok) {
      setError(result.message ?? "Something went wrong. Please try again.");
      setBusy(false);
      return;
    }
    setEditing(false);
    router.refresh();
    setBusy(false);
  }

  async function createArtifact() {
    await run(() => postMutation(`${base}`, { artifactType, content: content || null }));
  }

  async function saveEdit() {
    await run(async () => {
      const response = await fetch(`${base}/${artifact!.id}/versions/${currentVersion!.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: content || null, notes: notes || null }),
      });
      return response.ok
        ? { ok: true }
        : { ok: false, message: await parseApiErrorMessage(response) };
    });
  }

  async function changeStatus(next: PageArtifactVersionStatus) {
    let reason: string | null = null;
    if (VERSION_REASON_REQUIRED.includes(next)) {
      // The backend rejects these without a reason; asking here turns a guaranteed 400 into a
      // normal prompt.
      reason = window.prompt(`Reason for "${VERSION_STATUS_LABEL[next]}"?`);
      if (!reason || !reason.trim()) return;
    }
    await run(() =>
      postMutation(`${base}/${artifact!.id}/versions/${currentVersion!.id}/status`, {
        status: next,
        ...(reason ? { reason } : {}),
      }),
    );
  }

  async function reopen() {
    const reason = window.prompt("Why is this artifact being reopened?");
    if (!reason || !reason.trim()) return;
    await run(() =>
      postMutation(`${base}/${artifact!.id}/versions/${currentVersion!.id}/reopen`, { reason }),
    );
  }

  if (!artifact || !currentVersion) {
    return (
      <div className={styles.panel}>
        <p className={styles.empty}>No {tabLabel} artifact exists for this page yet.</p>
        <RichTextEditor value={content} onChange={setContent} />
        {error ? <p className={styles.error}>{error}</p> : null}
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.actionButton}
            onClick={createArtifact}
            disabled={busy}
          >
            {busy ? "Creating…" : `Create ${tabLabel} artifact`}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      <p className={styles.meta}>
        Version {currentVersion.versionNumber} &middot;{" "}
        {VERSION_STATUS_LABEL[currentVersion.status]}
        {currentVersion.commitSha ? ` · ${currentVersion.commitSha.slice(0, 7)}` : ""}
      </p>

      {currentVersion.reopenedReason ? (
        <p className={styles.meta}>Reopened: {currentVersion.reopenedReason}</p>
      ) : null}

      {editing ? (
        <>
          <label className={styles.label} htmlFor="artifact-content">
            Content
          </label>
          <RichTextEditor value={content} onChange={setContent} />
          <label className={styles.label} htmlFor="artifact-notes">
            Notes
          </label>
          <RichTextEditor value={notes} onChange={setNotes} />
        </>
      ) : (
        <div className={styles.readView}>{readView}</div>
      )}

      {error ? <p className={styles.error}>{error}</p> : null}

      <div className={styles.actions}>
        {isDraft && !editing ? (
          <button
            type="button"
            className={styles.actionButton}
            onClick={() => setEditing(true)}
            disabled={busy}
          >
            Edit
          </button>
        ) : null}
        {editing ? (
          <>
            <button
              type="button"
              className={styles.actionButton}
              onClick={saveEdit}
              disabled={busy}
            >
              {busy ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              className={styles.actionButton}
              onClick={() => setEditing(false)}
              disabled={busy}
            >
              Cancel
            </button>
          </>
        ) : null}

        {!editing &&
          nextStatuses.map((next) => (
            <button
              key={next}
              type="button"
              className={styles.actionButton}
              onClick={() => changeStatus(next)}
              disabled={busy}
            >
              {VERSION_STATUS_LABEL[next]}
            </button>
          ))}

        {!editing && canReopen ? (
          <button type="button" className={styles.actionButton} onClick={reopen} disabled={busy}>
            Reopen
          </button>
        ) : null}
      </div>
    </div>
  );
}
