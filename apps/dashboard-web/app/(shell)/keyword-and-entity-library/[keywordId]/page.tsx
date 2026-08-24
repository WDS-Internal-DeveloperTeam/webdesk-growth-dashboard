import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ContentContainer, Fact, PageHeader, StatusBadge, typographyTokens } from "@webdesk/ui";
import { KeywordEntityRelationshipsSection } from "@/components/keyword-entity-relationships-section";
import { KeywordPageAssignmentsSection } from "@/components/keyword-page-assignments-section";
import { KeywordStatusActions } from "@/components/keyword-status-actions";
import { SanitizedRichText } from "@/components/sanitized-rich-text";
import { primaryActionLinkStyle } from "@/lib/action-link-style";
import { dlStyle, h2Style, mutedStyle, richContentStyle, sectionStyle } from "@/lib/detail-section-styles";
import {
  formatTimestamp,
  getEntitiesForKeywordPicker,
  getKeyword,
  getKeywordEntityRelationships,
  getPageKeywordAssignments,
  getPagesForKeywordPicker,
  keywordApprovalStatusBadge,
  tolerateDiscard,
  withProjectId,
} from "@/lib/keyword-and-entity-library";
import { CONFIDENCE_LABEL } from "@/lib/keyword-and-entity-library-query";
import { getProject } from "@/lib/projects";
import { firstValue } from "@/lib/search-params";
import { getServerSession } from "@/lib/server-session";

export const dynamic = "force-dynamic";

interface KeywordDetailPageProps {
  readonly params: Promise<{ keywordId: string }>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * No approved wireframe/screen-level spec exists for this module — sections mirror the backend's
 * own field grouping (Identity, Metrics, Cannibalization notes, Linked entities, Assigned pages,
 * Status), rendered as sections rather than client-side tabs, the same simplification every prior
 * detail page in this app already establishes.
 *
 * Requires `?projectId=` — same rule as every other route in this module (see the list page's own
 * top doc comment). A missing/unresolvable `projectId` redirects to the list page's own
 * project-picker prompt before this page ever tries `getKeyword()`.
 *
 * `cannibalizationNotes` renders via `SanitizedRichText` — the one place any of these fields may use
 * `dangerouslySetInnerHTML`, matching every other rich-text field in this app.
 */
export default async function KeywordDetailPage({ params, searchParams }: KeywordDetailPageProps) {
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const rawParams = await searchParams;
  const projectIdParam = firstValue(rawParams.projectId);
  const { keywordId } = await params;

  // Fired concurrently with the project-existence check below, not sequentially after it, matching
  // `getPageDetail()`'s own fixed ordering — none of these need any field resolved from the
  // `Project` entity itself, only its raw id. `tolerateDiscard()` avoids an unhandled-rejection
  // warning on the branch where `project` turns out null and these promises are never awaited.
  const keywordPromise = projectIdParam
    ? tolerateDiscard(getKeyword(projectIdParam, keywordId))
    : null;
  const relationshipsPromise = projectIdParam
    ? tolerateDiscard(getKeywordEntityRelationships(projectIdParam, keywordId))
    : null;
  const assignmentsPromise = projectIdParam
    ? tolerateDiscard(getPageKeywordAssignments(projectIdParam, keywordId))
    : null;
  const entitiesForPickerPromise = projectIdParam
    ? tolerateDiscard(getEntitiesForKeywordPicker(projectIdParam))
    : null;
  const pagesForPickerPromise = projectIdParam
    ? tolerateDiscard(getPagesForKeywordPicker(projectIdParam))
    : null;

  const project = projectIdParam ? await getProject(projectIdParam) : null;
  if (!project) {
    redirect("/keyword-and-entity-library");
  }

  const [keyword, relationships, assignments, entitiesForPicker, pagesForPicker] =
    await Promise.all([
      keywordPromise!,
      relationshipsPromise!,
      assignmentsPromise!,
      entitiesForPickerPromise!,
      pagesForPickerPromise!,
    ]);
  if (!keyword) {
    notFound();
  }

  const badge = keywordApprovalStatusBadge(keyword.approvalStatus);
  // archived/superseded are terminal — the backend rejects any content edit of one via the generic
  // update route once its status genuinely reaches either, matching every sibling detail page's own
  // Edit-link-hiding precedent for the same two statuses.
  const isTerminal = keyword.approvalStatus === "archived" || keyword.approvalStatus === "superseded";

  return (
    <ContentContainer>
      <PageHeader
        title={keyword.queryText}
        breadcrumbs={[
          { label: "Keyword & Entity Library", href: "/keyword-and-entity-library" },
          { label: keyword.queryText },
        ]}
        linkComponent={Link}
        statusBadge={<StatusBadge status={badge.token} label={badge.label} />}
        contextActions={
          <>
            <KeywordStatusActions
              projectId={project.id}
              keywordId={keyword.id}
              approvalStatus={keyword.approvalStatus}
            />
            {!isTerminal ? (
              <Link
                href={withProjectId(`/keyword-and-entity-library/${keyword.id}/edit`, project.id)}
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
            <span style={{ fontFamily: typographyTokens.fontFamilyMono }}>{keyword.publicId}</span>
          </Fact>
          <Fact label="Keyword type">{keyword.keywordType ?? "—"}</Fact>
          <Fact label="Intent">{keyword.intent ?? "—"}</Fact>
          <Fact label="Funnel stage">{keyword.funnelStage ?? "—"}</Fact>
          <Fact label="Country">{keyword.country ?? "—"}</Fact>
          <Fact label="Source">{keyword.source ?? "—"}</Fact>
          <Fact label="Research date">{keyword.researchDate ?? "—"}</Fact>
        </dl>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Metrics</h2>
        <dl style={dlStyle}>
          <Fact label="Search volume">{keyword.searchVolume ?? "—"}</Fact>
          <Fact label="Difficulty score">{keyword.difficultyScore ?? "—"}</Fact>
          <Fact label="Confidence">
            {keyword.confidence ? CONFIDENCE_LABEL[keyword.confidence] : "—"}
          </Fact>
        </dl>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Cannibalization notes</h2>
        {keyword.cannibalizationNotes ? (
          <SanitizedRichText html={keyword.cannibalizationNotes} style={richContentStyle} />
        ) : (
          <p style={mutedStyle}>Not set.</p>
        )}
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Linked entities</h2>
        <KeywordEntityRelationshipsSection
          projectId={project.id}
          keywordId={keyword.id}
          initialRelationships={relationships}
          entities={entitiesForPicker}
        />
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Assigned pages</h2>
        <KeywordPageAssignmentsSection
          projectId={project.id}
          keywordId={keyword.id}
          initialAssignments={assignments}
          pages={pagesForPicker}
        />
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Status</h2>
        <dl style={dlStyle}>
          <Fact label="Approval status">
            <StatusBadge status={badge.token} label={badge.label} />
          </Fact>
          <Fact label="Created">{formatTimestamp(keyword.createdAt)}</Fact>
          <Fact label="Updated">{formatTimestamp(keyword.updatedAt)}</Fact>
        </dl>
      </section>
    </ContentContainer>
  );
}
