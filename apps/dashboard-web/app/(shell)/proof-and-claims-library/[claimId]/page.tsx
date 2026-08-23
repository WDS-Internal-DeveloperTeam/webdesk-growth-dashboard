import Link from "next/link";
import { notFound } from "next/navigation";
import { ContentContainer, Fact, PageHeader, StatusBadge } from "@webdesk/ui";
import { ClaimSourcesSection } from "@/components/claim-sources-section";
import { ProofClaimStatusActions } from "@/components/proof-claim-status-actions";
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
import { getServerSession } from "@/lib/server-session";
import {
  formatTimestamp,
  getProofClaimDetail,
  getServicesForClaimPicker,
  proofClaimApprovalStatusBadge,
} from "@/lib/proof-and-claims-library";

export const dynamic = "force-dynamic";

interface ProofAndClaimsLibraryDetailPageProps {
  readonly params: Promise<{ claimId: string }>;
}

const VERIFICATION_STATUS_LABEL: Readonly<Record<string, string>> = {
  unverified: "Unverified",
  pending: "Pending",
  verified: "Verified",
};

/**
 * No approved wireframe exists for this module — sections mirror
 * `04_Data_Model_and_Ownership.md:119-120`'s own field grouping (Identity, Verification, Content,
 * Relationships, Sources, Status), rendered as sections rather than client-side tabs, the same
 * simplification the Project/Business Knowledge Center/Service Library/Persona Library detail
 * pages already establish. `relatedServiceIds` is resolved to real service display names by
 * cross-referencing the same picker-population fetch the create/edit form uses (capped at the same
 * 100-row bound — an id outside that window falls back to showing the raw id itself, matching
 * `PersonaLibraryDetailPage`'s own identical fallback). Sources
 * (`claim_sources`) render via `ClaimSourcesSection`, a real one-to-many sub-resource with its own
 * add/edit/delete UI — the module's only genuine sub-resource, unlike Service Library's four
 * read-only dimension pickers.
 */
export default async function ProofAndClaimsLibraryDetailPage({
  params,
}: ProofAndClaimsLibraryDetailPageProps) {
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const { claimId } = await params;
  const [detail, services] = await Promise.all([
    getProofClaimDetail(claimId),
    getServicesForClaimPicker(),
  ]);
  if (!detail) {
    notFound();
  }
  const { claim, sources } = detail;

  const approvalBadge = proofClaimApprovalStatusBadge(claim.approvalStatus);
  const serviceNameById = new Map(
    services.map((service) => [service.id, service.publicName ?? service.canonicalName]),
  );
  const relatedServiceNames = claim.relatedServiceIds.map((id) => serviceNameById.get(id) ?? id);

  return (
    <ContentContainer>
      <PageHeader
        title={claim.publicId}
        breadcrumbs={[
          { label: "Proof and Claims Library", href: "/proof-and-claims-library" },
          { label: claim.publicId },
        ]}
        linkComponent={Link}
        statusBadge={<StatusBadge status={approvalBadge.token} label={approvalBadge.label} />}
        contextActions={
          <>
            <ProofClaimStatusActions claimId={claim.id} approvalStatus={claim.approvalStatus} />
            <Link
              href={`/proof-and-claims-library/${claim.id}/edit`}
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
          <Fact label="Public ID">{claim.publicId}</Fact>
          <Fact label="Claim type">{claim.claimType ?? "—"}</Fact>
          <Fact label="Created">{formatTimestamp(claim.createdAt)}</Fact>
          <Fact label="Updated">{formatTimestamp(claim.updatedAt)}</Fact>
        </dl>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Verification</h2>
        <dl style={dlStyle}>
          <Fact label="Verification status">
            {VERIFICATION_STATUS_LABEL[claim.verificationStatus]}
          </Fact>
          <Fact label="Before value">{claim.beforeValue ?? "—"}</Fact>
          <Fact label="After value">{claim.afterValue ?? "—"}</Fact>
          <Fact label="Expiry / review date">{claim.expiryReviewDate ?? "—"}</Fact>
        </dl>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Content</h2>
        <TextBlock label="Claim" value={claim.claim} />
        <TextBlock label="Approved wording" value={claim.approvedWording} />
        <TextBlock label="Restrictions" value={claim.restrictions} />
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Relationships</h2>
        <dl style={dlStyle}>
          <Fact label="Related services">
            {relatedServiceNames.length > 0 ? relatedServiceNames.join(", ") : "None"}
          </Fact>
          <Fact label="Related case studies">
            {claim.relatedCaseStudyIds.length > 0 ? claim.relatedCaseStudyIds.join(", ") : "None"}
          </Fact>
          <Fact label="Related pages">
            {claim.relatedPageIds.length > 0 ? claim.relatedPageIds.join(", ") : "None"}
          </Fact>
        </dl>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Sources</h2>
        <ClaimSourcesSection claimId={claim.id} initialSources={sources} />
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Status</h2>
        <dl style={dlStyle}>
          <Fact label="Approval status">
            <StatusBadge status={approvalBadge.token} label={approvalBadge.label} />
          </Fact>
        </dl>
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
