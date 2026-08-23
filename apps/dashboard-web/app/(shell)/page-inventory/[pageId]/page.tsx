import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { CSSProperties } from "react";
import { ContentContainer, Fact, PageHeader, StatusBadge, typographyTokens } from "@webdesk/ui";
import { PageStatusActions } from "@/components/page-status-actions";
import { PageUrlsSection } from "@/components/page-urls-section";
import { primaryActionLinkStyle } from "@/lib/action-link-style";
import { tolerateDiscard } from "@/lib/business-knowledge";
import { dlStyle, h2Style, mutedStyle, sectionStyle } from "@/lib/detail-section-styles";
import {
  formatTimestamp,
  getPage,
  getPageUrls,
  pageWorkflowStageBadge,
  withProjectId,
} from "@/lib/page-inventory";
import {
  CLASSIFICATION_LABEL,
  EXISTING_OR_PROPOSED_LABEL,
  INDEX_STATUS_LABEL,
} from "@/lib/page-inventory-query";
import { getProject } from "@/lib/projects";
import { firstValue } from "@/lib/search-params";
import { getServerSession } from "@/lib/server-session";

export const dynamic = "force-dynamic";

interface PageInventoryDetailPageProps {
  readonly params: Promise<{ pageId: string }>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * No approved wireframe/screen-level spec exists for this module — sections mirror the backend's
 * own field grouping (Identity, SEO & design, Scan & deployment, WordPress references, Repository
 * files, Page URLs, Status), rendered as sections rather than client-side tabs, the same
 * simplification every prior detail page in this app already establishes.
 *
 * Requires `?projectId=` — same rule as every other route in this module (see `page.tsx`'s own top
 * doc comment). A missing/unresolvable `projectId` redirects to the list page's own project-picker
 * prompt before this page ever tries `getPage()` (which itself hard-requires a real `projectId` to
 * build its own URL).
 *
 * `repositoryFiles` renders as plain pre-wrapped text (`BusinessKnowledgeRecordDetailPage`'s own
 * `notes`-block precedent), NOT via `SanitizedRichText` — it's genuinely plain, unsanitized text on
 * the backend, never HTML (see `PageForm`'s own doc comment for the full reasoning).
 */
export default async function PageInventoryDetailPage({
  params,
  searchParams,
}: PageInventoryDetailPageProps) {
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const rawParams = await searchParams;
  const projectIdParam = firstValue(rawParams.projectId);
  const { pageId } = await params;

  // Fired concurrently with the project-existence check below, not sequentially after it
  // (code-review finding, `dashboard-web-page-inventory`) — both only need the raw `projectId`
  // string, not any field resolved from the `Project` entity itself. `tolerateDiscard()` avoids an
  // unhandled-rejection warning on the branch where `project` turns out null and neither promise
  // is ever awaited.
  const pagePromise = projectIdParam ? tolerateDiscard(getPage(projectIdParam, pageId)) : null;
  const urlsPromise = projectIdParam ? tolerateDiscard(getPageUrls(projectIdParam, pageId)) : null;

  const project = projectIdParam ? await getProject(projectIdParam) : null;
  if (!project) {
    redirect("/page-inventory");
  }

  const [page, urls] = await Promise.all([pagePromise!, urlsPromise!]);
  if (!page) {
    notFound();
  }

  const badge = pageWorkflowStageBadge(page.workflowStage);
  // archived/superseded are terminal — the backend rejects any content edit of one via the generic
  // update route once its status genuinely reaches either (matching WebsiteStrategyCenterDetailPage's
  // own identical Edit-link-hiding precedent for the same two statuses), so the link is hidden
  // rather than left clickable only to 400 on submit.
  const isTerminal = page.workflowStage === "archived" || page.workflowStage === "superseded";

  return (
    <ContentContainer>
      <PageHeader
        title={page.pageName}
        breadcrumbs={[
          { label: "Page Inventory", href: "/page-inventory" },
          { label: page.pageName },
        ]}
        linkComponent={Link}
        statusBadge={<StatusBadge status={badge.token} label={badge.label} />}
        contextActions={
          <>
            <PageStatusActions
              projectId={project.id}
              pageId={page.id}
              workflowStage={page.workflowStage}
            />
            {!isTerminal ? (
              <Link
                href={withProjectId(`/page-inventory/${page.id}/edit`, project.id)}
                style={primaryActionLinkStyle}
              >
                Edit
              </Link>
            ) : null}
          </>
        }
      />

      <section style={sectionStyle}>
        <h2 style={h2Style}>Identity</h2>
        <dl style={dlStyle}>
          <Fact label="Public ID">
            <span style={{ fontFamily: typographyTokens.fontFamilyMono }}>{page.publicId}</span>
          </Fact>
          <Fact label="Page type">{page.pageType ?? "—"}</Fact>
          <Fact label="Existing / Proposed">
            {EXISTING_OR_PROPOSED_LABEL[page.existingOrProposed]}
          </Fact>
          <Fact label="Index status">{INDEX_STATUS_LABEL[page.indexStatus]}</Fact>
          <Fact label="Template">{page.template ?? "—"}</Fact>
          <Fact label="Roadmap phase ID">
            {page.roadmapPhaseId ? (
              <span style={{ fontFamily: typographyTokens.fontFamilyMono }}>
                {page.roadmapPhaseId}
              </span>
            ) : (
              "—"
            )}
          </Fact>
          <Fact label="Classification">
            {page.classification ? CLASSIFICATION_LABEL[page.classification] : "—"}
          </Fact>
        </dl>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>SEO &amp; design</h2>
        <dl style={dlStyle}>
          <Fact label="Target keyword">{page.targetKeyword ?? "—"}</Fact>
          <Fact label="Design version">{page.designVersion ?? "—"}</Fact>
        </dl>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Scan &amp; deployment</h2>
        <dl style={dlStyle}>
          <Fact label="Last scan date">{page.lastScanAt ?? "—"}</Fact>
          <Fact label="Last deployment date">{page.lastDeploymentAt ?? "—"}</Fact>
        </dl>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>WordPress references</h2>
        <dl style={dlStyle}>
          <Fact label="WordPress page ID">{page.wordpressPageId ?? "—"}</Fact>
          <Fact label="WordPress post ID">{page.wordpressPostId ?? "—"}</Fact>
        </dl>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Repository files</h2>
        {page.repositoryFiles ? (
          <p style={contentStyle}>{page.repositoryFiles}</p>
        ) : (
          <p style={mutedStyle}>Not set.</p>
        )}
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Page URLs</h2>
        <PageUrlsSection projectId={project.id} pageId={page.id} initialUrls={urls} />
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Status</h2>
        <dl style={dlStyle}>
          <Fact label="Workflow stage">
            <StatusBadge status={badge.token} label={badge.label} />
          </Fact>
          <Fact label="Created">{formatTimestamp(page.createdAt)}</Fact>
          <Fact label="Updated">{formatTimestamp(page.updatedAt)}</Fact>
        </dl>
      </section>
    </ContentContainer>
  );
}

const contentStyle: CSSProperties = {
  fontSize: "0.9375rem",
  color: "var(--webdesk-dashboard-color-foreground)",
  whiteSpace: "pre-wrap",
  margin: 0,
};
