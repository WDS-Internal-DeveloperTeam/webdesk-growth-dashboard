import Link from "next/link";
import { notFound } from "next/navigation";
import { ContentContainer, Fact, PageHeader, StatusBadge } from "@webdesk/ui";
import { PortfolioLibraryPublishActions } from "@/components/portfolio-library-publish-actions";
import { PortfolioLibraryStatusActions } from "@/components/portfolio-library-status-actions";
import { PortfolioScreenshotsSection } from "@/components/portfolio-screenshots-section";
import { primaryActionLinkStyle } from "@/lib/action-link-style";
import { dlStyle, h2Style, sectionStyle } from "@/lib/detail-section-styles";
import { buildNameById, resolveIdsToNames } from "@/lib/resolve-ids-to-names";
import { getServerSession } from "@/lib/server-session";
import {
  formatTimestamp,
  getAssetsForPortfolioPicker,
  getPortfolioDetail,
  getProofClaimsForPortfolioPicker,
  portfolioApprovalStatusBadge,
  portfolioPublishBadge,
  VISIBILITY_LABEL,
} from "@/lib/portfolio-library";

export const dynamic = "force-dynamic";

interface PortfolioLibraryDetailPageProps {
  readonly params: Promise<{ recordId: string }>;
}

/**
 * No approved wireframe exists for this module — sections mirror
 * `03_Detailed_Module_Specifications.md`'s own field grouping (Identity, Classification,
 * Visibility, Relationships, Screenshots, Status), rendered as sections rather than client-side
 * tabs, the same simplification every sibling detail page already establishes.
 * `relatedProofIds` is resolved to real display names by cross-referencing the same
 * picker-population fetch the create/edit form uses (capped at the same 100-row bound — an id
 * outside that window falls back to showing the raw id itself, matching
 * `CaseStudyStudioDetailPage`'s own identical fallback). Screenshots render via their own real
 * sub-resource section.
 */
export default async function PortfolioLibraryDetailPage({
  params,
}: PortfolioLibraryDetailPageProps) {
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const { recordId } = await params;
  const [detail, claims, assets] = await Promise.all([
    getPortfolioDetail(recordId),
    getProofClaimsForPortfolioPicker(),
    getAssetsForPortfolioPicker(),
  ]);
  if (!detail) {
    notFound();
  }
  const { record, screenshots } = detail;

  const approvalBadge = portfolioApprovalStatusBadge(record.approvalStatus);
  const publishBadge = portfolioPublishBadge(record.isPublished);
  const claimNameById = buildNameById(
    claims,
    (claim) => claim.id,
    (claim) => claim.publicId,
  );
  const relatedProofNames = resolveIdsToNames(record.relatedProofIds, claimNameById);

  return (
    <ContentContainer>
      <PageHeader
        title={record.projectOrClientName}
        breadcrumbs={[
          { label: "Portfolio Library", href: "/portfolio-library" },
          { label: record.projectOrClientName },
        ]}
        linkComponent={Link}
        statusBadge={<StatusBadge status={approvalBadge.token} label={approvalBadge.label} />}
        contextActions={
          <>
            <PortfolioLibraryStatusActions
              recordId={record.id}
              approvalStatus={record.approvalStatus}
            />
            <PortfolioLibraryPublishActions
              recordId={record.id}
              approvalStatus={record.approvalStatus}
              isPublished={record.isPublished}
            />
            {/* archived/superseded are terminal — the backend rejects any edit of one outright
                (portfolio-records.service.ts's own update() guard), so the link is hidden rather
                than left clickable only to 400 on submit, matching every sibling
                `*StatusActions` component's own self-hiding behavior for these same two
                statuses. */}
            {record.approvalStatus !== "archived" && record.approvalStatus !== "superseded" ? (
              <Link href={`/portfolio-library/${record.id}/edit`} style={primaryActionLinkStyle}>
                Edit
              </Link>
            ) : null}
          </>
        }
      />

      <section style={sectionStyle}>
        <h2 style={h2Style}>Identity</h2>
        <dl style={dlStyle}>
          <Fact label="Public ID">{record.publicId}</Fact>
          <Fact label="Project/client name">{record.projectOrClientName}</Fact>
          <Fact label="URL">
            {record.url ? (
              <a href={record.url} target="_blank" rel="noreferrer">
                {record.url}
              </a>
            ) : (
              "—"
            )}
          </Fact>
          <Fact label="Version">{record.version}</Fact>
          <Fact label="Created">{formatTimestamp(record.createdAt)}</Fact>
          <Fact label="Updated">{formatTimestamp(record.updatedAt)}</Fact>
        </dl>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Classification</h2>
        <dl style={dlStyle}>
          <Fact label="Primary category">{record.primaryCategory ?? "—"}</Fact>
          <Fact label="Additional categories">
            {record.additionalCategories.length > 0
              ? record.additionalCategories.join(", ")
              : "None"}
          </Fact>
          <Fact label="Tags">{record.tags.length > 0 ? record.tags.join(", ") : "None"}</Fact>
          <Fact label="Industry">{record.industry ?? "—"}</Fact>
          <Fact label="Platform">{record.platform ?? "—"}</Fact>
          <Fact label="Service type">{record.serviceType ?? "—"}</Fact>
          <Fact label="Launch date">{record.launchDate ?? "—"}</Fact>
        </dl>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Visibility</h2>
        <dl style={dlStyle}>
          <Fact label="Visibility">{VISIBILITY_LABEL[record.visibility]}</Fact>
        </dl>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Relationships</h2>
        <dl style={dlStyle}>
          <Fact label="Related proof claims">
            {relatedProofNames.length > 0 ? relatedProofNames.join(", ") : "None"}
          </Fact>
        </dl>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Screenshots</h2>
        <PortfolioScreenshotsSection
          recordId={record.id}
          initialScreenshots={screenshots}
          assets={assets}
        />
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Status</h2>
        <dl style={dlStyle}>
          <Fact label="Approval status">
            <StatusBadge status={approvalBadge.token} label={approvalBadge.label} />
          </Fact>
          <Fact label="Publish status">
            <StatusBadge status={publishBadge.token} label={publishBadge.label} />
          </Fact>
          <Fact label="Published">
            {record.publishedAt ? formatTimestamp(record.publishedAt) : "Never"}
          </Fact>
        </dl>
      </section>
    </ContentContainer>
  );
}
