import Link from "next/link";
import { notFound } from "next/navigation";
import { ContentContainer, Fact, PageHeader, StatusBadge } from "@webdesk/ui";
import { CaseStudyApprovalsSection } from "@/components/case-study-approvals-section";
import { CaseStudyAssetsSection } from "@/components/case-study-assets-section";
import { CaseStudyConsentsSection } from "@/components/case-study-consents-section";
import { CaseStudyStatusActions } from "@/components/case-study-status-actions";
import { SanitizedRichText } from "@/components/sanitized-rich-text";
import { primaryActionLinkStyle } from "@/lib/action-link-style";
import {
  dlStyle,
  h2Style,
  h3Style,
  mutedStyle,
  richContentStyle,
  sectionStyle,
  subsectionStyle,
} from "@/lib/detail-section-styles";
import { buildNameById, resolveIdsToNames } from "@/lib/resolve-ids-to-names";
import { getServerSession } from "@/lib/server-session";
import { getUsersByIds } from "@/lib/users";
import { VISIBILITY_LABEL } from "@/lib/case-study-studio-query";
import {
  caseStudyStatusBadge,
  formatTimestamp,
  getAssetsForCaseStudyPicker,
  getCaseStudyDetail,
  getProofClaimsForCaseStudyPicker,
  getServicesForCaseStudyPicker,
} from "@/lib/case-study-studio";

export const dynamic = "force-dynamic";

interface CaseStudyStudioDetailPageProps {
  readonly params: Promise<{ caseStudyId: string }>;
}

/**
 * No approved wireframe exists for this module — sections mirror
 * `docs/implementation/module-case-study-studio.md`'s own D5 field grouping (Identity,
 * Visibility, Narrative, Relationships, Assets, Consents, Status, Approval history), rendered as
 * sections rather than client-side tabs, the same simplification every sibling detail page already
 * establishes. `relatedServiceIds`/`relatedClaimIds` are resolved to real display names by
 * cross-referencing the same picker-population fetches the create/edit form uses (capped at the
 * same 100-row bound — an id outside that window falls back to showing the raw id itself, matching
 * `ProofAndClaimsLibraryDetailPage`'s own identical fallback). Assets/Consents render via their own
 * real sub-resource sections; Approval history is read-only.
 */
export default async function CaseStudyStudioDetailPage({
  params,
}: CaseStudyStudioDetailPageProps) {
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const { caseStudyId } = await params;
  const [detail, services, claims, assets] = await Promise.all([
    getCaseStudyDetail(caseStudyId),
    getServicesForCaseStudyPicker(),
    getProofClaimsForCaseStudyPicker(),
    getAssetsForCaseStudyPicker(),
  ]);
  if (!detail) {
    notFound();
  }
  const { caseStudy, assets: linkedAssets, consents, approvals } = detail;

  const decidedByUserIds = approvals
    .map((approval) => approval.decidedByUserId)
    .filter((id): id is string => id !== null);
  const decidedByMap = await getUsersByIds(decidedByUserIds);
  const decidedByNameById = new Map(
    [...decidedByMap.entries()].map(([id, user]) => [id, user.displayName]),
  );

  const badge = caseStudyStatusBadge(caseStudy.status);
  const serviceNameById = buildNameById(
    services,
    (service) => service.id,
    (service) => service.publicName ?? service.canonicalName,
  );
  const claimNameById = buildNameById(
    claims,
    (claim) => claim.id,
    (claim) => claim.publicId,
  );
  const relatedServiceNames = resolveIdsToNames(caseStudy.relatedServiceIds, serviceNameById);
  const relatedClaimNames = resolveIdsToNames(caseStudy.relatedClaimIds, claimNameById);

  return (
    <ContentContainer>
      <PageHeader
        title={caseStudy.publicId}
        breadcrumbs={[
          { label: "Case Study Studio", href: "/case-study-studio" },
          { label: caseStudy.publicId },
        ]}
        linkComponent={Link}
        statusBadge={<StatusBadge status={badge.token} label={badge.label} />}
        contextActions={
          <>
            <CaseStudyStatusActions
              caseStudyId={caseStudy.id}
              status={caseStudy.status}
              clientApprovalRequired={caseStudy.clientApprovalRequired}
            />
            {caseStudy.status !== "archived" ? (
              <Link href={`/case-study-studio/${caseStudy.id}/edit`} style={primaryActionLinkStyle}>
                Edit
              </Link>
            ) : null}
          </>
        }
      />

      <section style={sectionStyle}>
        <h2 style={h2Style}>Identity</h2>
        <dl style={dlStyle}>
          <Fact label="Public ID">{caseStudy.publicId}</Fact>
          <Fact label="Client">{caseStudy.clientName}</Fact>
          <Fact label="Project title">{caseStudy.projectTitle}</Fact>
          <Fact label="Industry">{caseStudy.industry ?? "—"}</Fact>
          <Fact label="Platform">{caseStudy.platform ?? "—"}</Fact>
          <Fact label="Created">{formatTimestamp(caseStudy.createdAt)}</Fact>
          <Fact label="Updated">{formatTimestamp(caseStudy.updatedAt)}</Fact>
        </dl>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Visibility</h2>
        <dl style={dlStyle}>
          <Fact label="Visibility">{VISIBILITY_LABEL[caseStudy.visibility]}</Fact>
          <Fact label="Embargo date">{caseStudy.embargoDate ?? "—"}</Fact>
          <Fact label="Scheduled publish at">
            {caseStudy.scheduledPublishAt ? formatTimestamp(caseStudy.scheduledPublishAt) : "—"}
          </Fact>
          <Fact label="Published at">
            {caseStudy.publishedAt ? formatTimestamp(caseStudy.publishedAt) : "—"}
          </Fact>
          <Fact label="Client approval required">
            {caseStudy.clientApprovalRequired ? "Yes" : "No"}
          </Fact>
          {caseStudy.unpublishReason ? (
            <Fact label="Unpublish reason">{caseStudy.unpublishReason}</Fact>
          ) : null}
        </dl>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Narrative</h2>
        <TextBlock label="Challenge" value={caseStudy.challenge} />
        <TextBlock label="Solution" value={caseStudy.solution} />
        <TextBlock label="Implementation" value={caseStudy.implementation} />
        <TextBlock label="Results" value={caseStudy.results} />
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Relationships</h2>
        <dl style={dlStyle}>
          <Fact label="Related services">
            {relatedServiceNames.length > 0 ? relatedServiceNames.join(", ") : "None"}
          </Fact>
          <Fact label="Related claims">
            {relatedClaimNames.length > 0 ? relatedClaimNames.join(", ") : "None"}
          </Fact>
        </dl>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Assets</h2>
        <CaseStudyAssetsSection
          caseStudyId={caseStudy.id}
          initialAssets={linkedAssets}
          assets={assets}
        />
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Consents</h2>
        <CaseStudyConsentsSection caseStudyId={caseStudy.id} initialConsents={consents} />
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Approval history</h2>
        <CaseStudyApprovalsSection approvals={approvals} decidedByNameById={decidedByNameById} />
      </section>
    </ContentContainer>
  );
}

function TextBlock({ label, value }: { readonly label: string; readonly value: string | null }) {
  return (
    <div style={subsectionStyle}>
      <h3 style={h3Style}>{label}</h3>
      {value ? (
        <SanitizedRichText html={value} style={richContentStyle} />
      ) : (
        <p style={mutedStyle}>Not set.</p>
      )}
    </div>
  );
}
