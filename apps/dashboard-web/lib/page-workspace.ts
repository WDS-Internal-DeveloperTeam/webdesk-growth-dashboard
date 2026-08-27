import { cookies } from "next/headers";
import type {
  ApiSuccessResponse,
  Page,
  PageArtifact,
  PageArtifactVersion,
} from "@webdesk/shared-types";
import { getApiBaseUrl } from "./auth";
import { workspaceApiPath } from "./page-workspace-query";
import { isUuid } from "./uuid";

/**
 * Server-side fetches for the Page Workspace module. Split from `page-workspace-query.ts` (which
 * has no non-type imports) so client components can use the query helpers without dragging
 * `next/headers` into the browser bundle — the same split every sibling module uses, and the trap
 * that has bitten this codebase twice.
 */

async function cookieHeader(): Promise<string> {
  const store = await cookies();
  return store.toString();
}

function workspaceBase(projectId: string, pageId: string): string {
  return `${getApiBaseUrl()}${workspaceApiPath(projectId, pageId)}`;
}

/**
 * The artifacts that already exist for a page. A page with no artifacts yet is a normal, expected
 * state — every tab simply offers creation — so an empty list is not an error.
 *
 * Note the backend filters this list to the permission groups the caller may view, so a shorter
 * list than 15 can mean "not created yet" OR "not visible to you"; the tab itself distinguishes
 * the two, because creating requires a permission the caller would also lack.
 */
export async function getArtifacts(
  projectId: string,
  pageId: string,
): Promise<readonly PageArtifact[] | null> {
  if (!isUuid(projectId) || !isUuid(pageId)) {
    return null;
  }
  const response = await fetch(`${workspaceBase(projectId, pageId)}/artifacts`, {
    headers: { cookie: await cookieHeader() },
    cache: "no-store",
  });
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Failed to load page artifacts (status ${response.status})`);
  }
  const body = (await response.json()) as ApiSuccessResponse<readonly PageArtifact[]>;
  return body.data;
}

/**
 * One artifact's version history, newest first. An empty array is a real, valid answer (no
 * versions yet, or a malformed id) — never thrown for that case, matching `getArtifacts()`'s and
 * `getPageLifecycle()`'s own guard/404 handling in this file, which this function previously
 * lacked (code-review finding, `dashboard-web-page-workspace`): it had no `isUuid()` guard and
 * threw on a 404 rather than degrading, the only one of this file's three fetches to do so.
 */
export async function getArtifactVersions(
  projectId: string,
  pageId: string,
  artifactId: string,
): Promise<readonly PageArtifactVersion[]> {
  if (!isUuid(projectId) || !isUuid(pageId) || !isUuid(artifactId)) {
    return [];
  }
  const response = await fetch(
    `${workspaceBase(projectId, pageId)}/artifacts/${artifactId}/versions`,
    { headers: { cookie: await cookieHeader() }, cache: "no-store" },
  );
  if (response.status === 404) {
    return [];
  }
  if (!response.ok) {
    throw new Error(`Failed to load artifact versions (status ${response.status})`);
  }
  const body = (await response.json()) as ApiSuccessResponse<readonly PageArtifactVersion[]>;
  return body.data;
}

/** The page's own record, carrying `lifecycleStage`/`lifecyclePreviousStage`. */
export async function getPageLifecycle(projectId: string, pageId: string): Promise<Page | null> {
  if (!isUuid(projectId) || !isUuid(pageId)) {
    return null;
  }
  const response = await fetch(`${workspaceBase(projectId, pageId)}/lifecycle`, {
    headers: { cookie: await cookieHeader() },
    cache: "no-store",
  });
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Failed to load page lifecycle (status ${response.status})`);
  }
  const body = (await response.json()) as ApiSuccessResponse<Page>;
  return body.data;
}
