import Link from "next/link";
import { notFound } from "next/navigation";
import { ContentContainer, Fact, PageHeader, StatusBadge, Stepper } from "@webdesk/ui";
import { PageArtifactPanel } from "@/components/page-artifact-panel";
import { PageLifecycleActions } from "@/components/page-lifecycle-actions";
import { SanitizedRichText } from "@/components/sanitized-rich-text";
import { formatTimestamp } from "@/lib/format-timestamp";
import { getArtifacts, getArtifactVersions, getPageLifecycle } from "@/lib/page-workspace";
import {
  buildWorkspaceHref,
  findTab,
  isOffPathStage,
  LIFECYCLE_MAIN_PATH,
  LIFECYCLE_STAGE_LABEL,
  lifecycleStageBadge,
  VERSION_STATUS_LABEL,
  WORKSPACE_TABS,
} from "@/lib/page-workspace-query";
import { firstValue } from "@/lib/search-params";
import { getServerSession } from "@/lib/server-session";

export const dynamic = "force-dynamic";

interface PageWorkspacePageProps {
  readonly params: Promise<{ pageId: string }>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * The Page Workspace — archetype D, described by the design system as "the system's most
 * structurally complex screen" (`15-representative-screen-specifications.md §7`).
 *
 * Tabs are URL-driven links rather than the client `Tabs` component (task package D1): this keeps
 * the screen a zero-client-JS Server Component like every sibling detail page, and makes each tab
 * deep-linkable — genuinely useful when someone is discussing one artifact. The visual result is
 * the same tab bar; only the mechanism differs.
 *
 * The wireframe's comments, related records, owner and required-approver regions are deliberately
 * absent — none is backed by any column this module owns (task package §3). Building them would
 * mean inventing data.
 */
export default async function PageWorkspacePage({ params, searchParams }: PageWorkspacePageProps) {
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const { pageId } = await params;
  const rawParams = await searchParams;
  const projectId = firstValue(rawParams.projectId);
  const tab = findTab(firstValue(rawParams.tab));

  if (!projectId) {
    notFound();
  }

  const [page, artifacts] = await Promise.all([
    getPageLifecycle(projectId, pageId),
    getArtifacts(projectId, pageId),
  ]);

  if (!page || !artifacts) {
    notFound();
  }

  const artifact = tab.artifactType
    ? (artifacts.find((entry) => entry.artifactType === tab.artifactType) ?? null)
    : null;

  // Only the selected tab's versions are fetched — the other 14 artifacts are not opened, so this
  // stays one extra request regardless of how many tabs exist.
  const versions = artifact ? await getArtifactVersions(projectId, pageId, artifact.id) : [];
  const currentVersion =
    versions.find((version) => version.id === artifact?.currentVersionId) ?? versions[0] ?? null;

  const stageBadge = lifecycleStageBadge(page.lifecycleStage);
  const offPath = isOffPathStage(page.lifecycleStage);

  return (
    <ContentContainer>
      <PageHeader
        title={page.pageName}
        statusBadge={<StatusBadge status={stageBadge.token} label={stageBadge.label} />}
        contextActions={
          <Link href={`/page-inventory/${page.id}?projectId=${projectId}`}>
            Open in Page Inventory
          </Link>
        }
      />
      <p>Page workspace &middot; {page.publicId}</p>

      <section style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}>
          {currentVersion?.commitSha ? (
            <Fact label="Latest commit">{currentVersion.commitSha.slice(0, 7)}</Fact>
          ) : null}
        </div>

        {/* The stepper shows the 16-stage main path only. An off-path state (paused, blocked,
            failed, rolled back, revision requested) is genuinely not on the linear track, so it
            renders as its own notice rather than being forced onto the stepper, which would
            misrepresent the state machine (task package D6). */}
        {offPath ? (
          <p>
            This page is currently <strong>{LIFECYCLE_STAGE_LABEL[page.lifecycleStage]}</strong>
            {page.lifecyclePreviousStage
              ? ` — it can resume at ${LIFECYCLE_STAGE_LABEL[page.lifecyclePreviousStage]}.`
              : "."}
          </p>
        ) : (
          <Stepper
            label="Page delivery lifecycle"
            currentStageId={page.lifecycleStage}
            stages={LIFECYCLE_MAIN_PATH.map((stage) => ({
              id: stage,
              label: LIFECYCLE_STAGE_LABEL[stage],
            }))}
          />
        )}

        <PageLifecycleActions
          projectId={projectId}
          pageId={page.id}
          stage={page.lifecycleStage}
          previousStage={page.lifecyclePreviousStage}
        />
      </section>

      {/* 16 tabs as links. Below 768px the row scrolls horizontally — an accepted tab-overflow
          pattern, explicitly distinct from the no-horizontal-scroll rule that governs tables
          (`15-representative-screen-specifications.md §7`). */}
      <nav aria-label="Workspace tabs" style={{ overflowX: "auto", margin: "1.5rem 0" }}>
        <ul style={{ display: "flex", gap: "0.5rem", listStyle: "none", margin: 0, padding: 0 }}>
          {WORKSPACE_TABS.map((entry) => {
            const selected = entry.key === tab.key;
            return (
              <li key={entry.key}>
                <Link
                  href={buildWorkspaceHref(page.id, projectId, entry.key)}
                  aria-current={selected ? "page" : undefined}
                  style={{ whiteSpace: "nowrap", fontWeight: selected ? 600 : 400 }}
                >
                  {entry.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <section aria-label={tab.label}>
        <h2>{tab.label}</h2>
        {tab.artifactType ? (
          <PageArtifactPanel
            projectId={projectId}
            pageId={page.id}
            artifactType={tab.artifactType}
            tabLabel={tab.label}
            artifact={artifact}
            currentVersion={currentVersion}
            /* Rendered HERE, on the server: SanitizedRichText wraps sanitize-html, a Node-only
               package, so the client panel cannot call it. Passing the rendered node also means
               unsanitized HTML never reaches the browser bundle. */
            readView={
              currentVersion && (currentVersion.content || currentVersion.notes) ? (
                <>
                  {currentVersion.content ? (
                    <SanitizedRichText html={currentVersion.content} />
                  ) : null}
                  {currentVersion.notes ? (
                    <>
                      <p>Notes</p>
                      <SanitizedRichText html={currentVersion.notes} />
                    </>
                  ) : null}
                </>
              ) : null
            }
          />
        ) : (
          <VersionHistory versions={versions} />
        )}
      </section>
    </ContentContainer>
  );
}

/**
 * The History tab (task package D5) — a derived view over the version list, which is exactly why
 * `history` is not a stored artifact type. It shows the SELECTED tab's history; History is the
 * one tab with no artifact of its own, so it lists whatever artifact was last opened, or nothing.
 */
function VersionHistory({
  versions,
}: {
  readonly versions: readonly {
    readonly id: string;
    readonly versionNumber: number;
    readonly status: string;
    readonly reopenedReason: string | null;
    readonly approvedAt: string | null;
    readonly updatedAt: string;
  }[];
}) {
  if (versions.length === 0) {
    return <p>Open an artifact tab to see its version history.</p>;
  }
  return (
    <ol>
      {versions.map((version) => (
        <li key={version.id}>
          Version {version.versionNumber} —{" "}
          {VERSION_STATUS_LABEL[version.status as keyof typeof VERSION_STATUS_LABEL] ??
            version.status}
          {version.approvedAt ? ` · approved ${formatTimestamp(version.approvedAt)}` : ""}
          {version.reopenedReason ? ` · reopened: ${version.reopenedReason}` : ""}
          {` · updated ${formatTimestamp(version.updatedAt)}`}
        </li>
      ))}
    </ol>
  );
}
