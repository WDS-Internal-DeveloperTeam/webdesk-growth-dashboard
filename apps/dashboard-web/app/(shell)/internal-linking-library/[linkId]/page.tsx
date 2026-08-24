import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ContentContainer, Fact, PageHeader, StatusBadge, typographyTokens } from "@webdesk/ui";
import { InternalLinkStatusActions } from "@/components/internal-link-status-actions";
import { SanitizedRichText } from "@/components/sanitized-rich-text";
import { primaryActionLinkStyle } from "@/lib/action-link-style";
import { tolerateDiscard } from "@/lib/business-knowledge";
import {
  dlStyle,
  h2Style,
  mutedStyle,
  richContentStyle,
  sectionStyle,
} from "@/lib/detail-section-styles";
import {
  formatTimestamp,
  getInternalLink,
  internalLinkStatusBadge,
  PRIORITY_LABEL,
  resolveLinkRelationships,
  withProjectId,
} from "@/lib/internal-linking-library";
import { getProject } from "@/lib/projects";
import { firstValue } from "@/lib/search-params";
import { getServerSession } from "@/lib/server-session";

export const dynamic = "force-dynamic";

interface InternalLinkDetailPageProps {
  readonly params: Promise<{ linkId: string }>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * No approved wireframe/screen-level spec exists for this module — sections mirror the backend's
 * own field grouping (Identity, Relationship, Content, Classification, Governance, Status),
 * rendered as sections rather than client-side tabs, the same simplification every prior detail
 * page in this app already establishes.
 *
 * Requires `?projectId=` — same rule as every other route in this module (see the list page's own
 * top doc comment). A missing/unresolvable `projectId` redirects to the list page's own
 * project-picker prompt before this page ever tries `getInternalLink()`.
 *
 * `context` renders via `SanitizedRichText` — the one place this field may use
 * `dangerouslySetInnerHTML`, matching every other rich-text field in this app.
 *
 * Unlike every sibling detail page (Page Inventory, Keyword & Entity Library — each hiding the Edit
 * link for a terminal status), the Edit link is always shown here — this module's own 4-state
 * workflow has no terminal state (task package D2), so no status ever makes an edit
 * backend-rejected.
 */
export default async function InternalLinkDetailPage({
  params,
  searchParams,
}: InternalLinkDetailPageProps) {
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const rawParams = await searchParams;
  const projectIdParam = firstValue(rawParams.projectId);
  const { linkId } = await params;

  // Fired concurrently with the project-existence check below, not sequentially after it, matching
  // every sibling detail page's own fixed ordering — none of these need any field resolved from
  // the Project entity itself, only its raw id. tolerateDiscard() avoids an unhandled-rejection
  // warning on the branch where project turns out null and these promises are never awaited.
  const linkPromise = projectIdParam
    ? tolerateDiscard(getInternalLink(projectIdParam, linkId))
    : null;

  const project = projectIdParam ? await getProject(projectIdParam) : null;
  if (!project) {
    redirect("/internal-linking-library");
  }

  const link = await linkPromise!;
  if (!link) {
    notFound();
  }

  // Resolved once the link itself is known (each depends on a real field of `link`, unlike the
  // project-scoped fetch above) — resolveLinkRelationships() fires all three concurrently via
  // Promise.all internally, and each is individually guarded against a non-essential-lookup
  // failure (e.g. a 403 from a role lacking users_roles:view) degrading to null rather than
  // crashing this page.
  const { sourcePage, targetPage, approver } = await resolveLinkRelationships(project.id, link);

  const badge = internalLinkStatusBadge(link.status);

  return (
    <ContentContainer>
      <PageHeader
        title={link.publicId}
        breadcrumbs={[
          { label: "Internal Linking Library", href: "/internal-linking-library" },
          { label: link.publicId },
        ]}
        linkComponent={Link}
        statusBadge={<StatusBadge status={badge.token} label={badge.label} />}
        contextActions={
          <>
            <InternalLinkStatusActions
              projectId={project.id}
              linkId={link.id}
              status={link.status}
            />
            <Link
              href={withProjectId(`/internal-linking-library/${link.id}/edit`, project.id)}
              style={primaryActionLinkStyle}
            >
              Edit
            </Link>
          </>
        }
      />

      <section style={sectionStyle}>
        <h2 style={h2Style}>Identity</h2>
        <dl style={dlStyle}>
          <Fact label="Public ID">
            <span style={{ fontFamily: typographyTokens.fontFamilyMono }}>{link.publicId}</span>
          </Fact>
          <Fact label="Status">
            <StatusBadge status={badge.token} label={badge.label} />
          </Fact>
        </dl>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Relationship</h2>
        <dl style={dlStyle}>
          <Fact label="Source page">
            {sourcePage ? (
              <Link href={withProjectId(`/page-inventory/${sourcePage.id}`, project.id)}>
                {sourcePage.pageName}
              </Link>
            ) : (
              <span style={{ fontFamily: typographyTokens.fontFamilyMono }}>
                {link.sourcePageId}
              </span>
            )}
          </Fact>
          <Fact label="Target page">
            {targetPage ? (
              <Link href={withProjectId(`/page-inventory/${targetPage.id}`, project.id)}>
                {targetPage.pageName}
              </Link>
            ) : (
              <span style={{ fontFamily: typographyTokens.fontFamilyMono }}>
                {link.targetPageId}
              </span>
            )}
          </Fact>
          <Fact label="Relationship">{link.relationship ?? "—"}</Fact>
          <Fact label="Link type">{link.linkType ?? "—"}</Fact>
        </dl>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Content</h2>
        <dl style={dlStyle}>
          <Fact label="Anchor text">{link.anchor ?? "—"}</Fact>
        </dl>
        <div style={{ marginTop: "0.75rem" }}>
          {link.context ? (
            <SanitizedRichText html={link.context} style={richContentStyle} />
          ) : (
            <p style={mutedStyle}>No context set.</p>
          )}
        </div>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Classification</h2>
        <dl style={dlStyle}>
          <Fact label="Priority">{link.priority ? PRIORITY_LABEL[link.priority] : "—"}</Fact>
          <Fact label="Detector">{link.detector ?? "—"}</Fact>
        </dl>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Governance</h2>
        <dl style={dlStyle}>
          <Fact label="Assigned approver">
            {approver ? (
              <>
                {approver.displayName} <span style={mutedStyle}>({approver.email})</span>
              </>
            ) : link.assignedApproverUserId ? (
              <span style={mutedStyle}>Assigned, but could not be resolved.</span>
            ) : (
              "Not assigned"
            )}
          </Fact>
          <Fact label="Related strategy record ID">
            {link.relatedStrategyRecordId ? (
              <span style={{ fontFamily: typographyTokens.fontFamilyMono }}>
                {link.relatedStrategyRecordId}
              </span>
            ) : (
              "—"
            )}
          </Fact>
        </dl>
        {link.relatedStrategyRecordId ? (
          <p style={mutedStyle}>
            Not validated — no lookup exists into Website Strategy Center for this relationship yet.
          </p>
        ) : null}
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Status</h2>
        <dl style={dlStyle}>
          <Fact label="Implemented">
            {link.implementedAt ? formatTimestamp(link.implementedAt) : "Not yet"}
          </Fact>
          <Fact label="Verified">
            {link.verifiedAt ? formatTimestamp(link.verifiedAt) : "Not yet"}
          </Fact>
          <Fact label="Created">{formatTimestamp(link.createdAt)}</Fact>
          <Fact label="Updated">{formatTimestamp(link.updatedAt)}</Fact>
        </dl>
      </section>
    </ContentContainer>
  );
}
