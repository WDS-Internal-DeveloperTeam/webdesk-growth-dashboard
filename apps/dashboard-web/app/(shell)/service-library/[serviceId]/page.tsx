import Link from "next/link";
import { notFound } from "next/navigation";
import { ContentContainer, Fact, PageHeader, StatusBadge } from "@webdesk/ui";
import { ServiceStatusActions } from "@/components/service-status-actions";
import { primaryActionLinkStyle } from "@/lib/action-link-style";
import { sanitizeRenderedHtml } from "@/lib/sanitize-html";
import { getServerSession } from "@/lib/server-session";
import {
  formatTimestamp,
  getDeliverables,
  getEngagementModels,
  getPlatforms,
  getService,
  getServiceCategories,
  serviceApprovalStatusBadge,
  servicePublicationStatusBadge,
} from "@/lib/service-library";
import { CONFIDENTIALITY_LABEL } from "@/lib/service-library-query";

export const dynamic = "force-dynamic";

interface ServiceLibraryDetailPageProps {
  readonly params: Promise<{ serviceId: string }>;
}

/** Approved design brief: `docs/design/dashboard-ui/15-representative-screen-specifications.md`
 *  §4 — "Detail screen: sectioned by [Identity, Positioning, Relationships, Status] with Approval
 *  block since it has an approval status." Renders as sections, not client-side tabs, the same
 *  simplification the Project/Business Knowledge Center detail pages already established. The
 *  `ApprovalBlock` component is deliberately not used here — see `ServiceStatusActions`'s own doc
 *  comment for why (the backend's status-transition endpoint doesn't capture the
 *  submitter/reviewer identity or rejection/revision reason that component requires to render
 *  honestly). Relationship ids (`deliverableIds`/`platformIds`/`engagementModelIds`/`categoryId`)
 *  are resolved to real display names by cross-referencing the dimension lists fetched alongside
 *  the service itself — no fabrication, matching `ProjectDetailPage`'s own `activePhaseId`
 *  resolution precedent. */
export default async function ServiceLibraryDetailPage({ params }: ServiceLibraryDetailPageProps) {
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const { serviceId } = await params;
  const [service, categories, deliverables, platforms, engagementModels] = await Promise.all([
    getService(serviceId),
    getServiceCategories(),
    getDeliverables(),
    getPlatforms(),
    getEngagementModels(),
  ]);
  if (!service) {
    notFound();
  }

  const approvalBadge = serviceApprovalStatusBadge(service.approvalStatus);
  const publicationBadge = servicePublicationStatusBadge(service.publicationStatus);
  // `internalDescription` being absent from the JSON response (not merely `null`) is the
  // confidential-field redaction signal, not "no description exists" — the same convention
  // `BusinessKnowledgeRecord.content`/`.notes` already establish.
  const isInternalDescriptionRedacted = service.internalDescription === undefined;

  const categoryName =
    categories.find((category) => category.id === service.categoryId)?.name ?? "—";
  const deliverableNames = service.deliverableIds
    .map((id) => deliverables.find((d) => d.id === id)?.name)
    .filter((name): name is string => !!name);
  const platformNames = service.platformIds
    .map((id) => platforms.find((p) => p.id === id)?.name)
    .filter((name): name is string => !!name);
  const engagementModelNames = service.engagementModelIds
    .map((id) => engagementModels.find((e) => e.id === id)?.name)
    .filter((name): name is string => !!name);

  return (
    <ContentContainer>
      <PageHeader
        title={service.canonicalName}
        breadcrumbs={[
          { label: "Service Library", href: "/service-library" },
          { label: service.canonicalName },
        ]}
        linkComponent={Link}
        statusBadge={<StatusBadge status={approvalBadge.token} label={approvalBadge.label} />}
        contextActions={
          <>
            <ServiceStatusActions serviceId={service.id} approvalStatus={service.approvalStatus} />
            <Link href={`/service-library/${service.id}/edit`} style={primaryActionLinkStyle}>
              Edit
            </Link>
          </>
        }
      />

      <section style={sectionStyle}>
        <h2 style={h2Style}>Identity</h2>
        <dl style={dlStyle}>
          <Fact label="Public ID">{service.publicId}</Fact>
          <Fact label="Public name">{service.publicName ?? "—"}</Fact>
          <Fact label="Category">{categoryName}</Fact>
          <Fact label="Created">{formatTimestamp(service.createdAt)}</Fact>
          <Fact label="Updated">{formatTimestamp(service.updatedAt)}</Fact>
        </dl>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Positioning</h2>
        <TextBlock label="Short public description" value={service.shortPublicDescription} />
        <TextBlock label="Audience" value={service.audience} />
        <TextBlock label="Problems solved" value={service.problems} />
        <TextBlock label="Capabilities" value={service.capabilities} />
        <TextBlock label="Outcomes" value={service.outcomes} />
        <TextBlock label="Exclusions" value={service.exclusions} />
        {isInternalDescriptionRedacted ? (
          <div style={subsectionStyle}>
            <h3 style={h3Style}>Internal description</h3>
            <p style={redactedStyle}>
              This service is restricted — its internal description isn&apos;t visible to your
              account.
            </p>
          </div>
        ) : (
          <TextBlock label="Internal description" value={service.internalDescription ?? null} />
        )}
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Relationships</h2>
        <dl style={dlStyle}>
          <Fact label="Deliverables">
            {deliverableNames.length > 0 ? deliverableNames.join(", ") : "None"}
          </Fact>
          <Fact label="Platforms">
            {platformNames.length > 0 ? platformNames.join(", ") : "None"}
          </Fact>
          <Fact label="Engagement models">
            {engagementModelNames.length > 0 ? engagementModelNames.join(", ") : "None"}
          </Fact>
          <Fact label="ICPs">{service.icpIds.length > 0 ? service.icpIds.join(", ") : "None"}</Fact>
          <Fact label="Related pages">
            {service.relatedPageIds.length > 0 ? service.relatedPageIds.join(", ") : "None"}
          </Fact>
          <Fact label="Related case studies">
            {service.relatedCaseStudyIds.length > 0
              ? service.relatedCaseStudyIds.join(", ")
              : "None"}
          </Fact>
        </dl>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Status</h2>
        <dl style={dlStyle}>
          <Fact label="Confidentiality">{CONFIDENTIALITY_LABEL[service.confidentiality]}</Fact>
          <Fact label="Publication status">
            <StatusBadge status={publicationBadge.token} label={publicationBadge.label} />
          </Fact>
          <Fact label="Approval status">
            <StatusBadge status={approvalBadge.token} label={approvalBadge.label} />
          </Fact>
        </dl>
      </section>
    </ContentContainer>
  );
}

const sectionStyle: React.CSSProperties = {
  marginBottom: "2rem",
};

const subsectionStyle: React.CSSProperties = {
  marginBottom: "1rem",
};

const h2Style: React.CSSProperties = {
  fontSize: "1.125rem",
  fontWeight: 600,
  marginBottom: "0.75rem",
};

const h3Style: React.CSSProperties = {
  fontSize: "0.9375rem",
  fontWeight: 600,
  marginBottom: "0.375rem",
};

const dlStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(14rem, 1fr))",
  gap: "0.75rem 1.5rem",
  margin: 0,
};

// No `whiteSpace: pre-wrap` here — this wraps real HTML (already structured with its own <p>/<br>
// tags from the rich-text editor), not plain text needing that treatment, matching Business
// Knowledge Center's own `richContentStyle` precedent.
const richContentStyle: React.CSSProperties = {
  fontSize: "0.9375rem",
  color: "var(--webdesk-dashboard-color-foreground)",
};

const mutedStyle: React.CSSProperties = {
  fontSize: "0.875rem",
  color: "var(--webdesk-dashboard-color-foreground-muted)",
  margin: 0,
};

const redactedStyle: React.CSSProperties = {
  fontSize: "0.875rem",
  color: "var(--webdesk-dashboard-color-foreground-muted)",
  background: "var(--webdesk-dashboard-color-surface)",
  border: "1px dashed var(--webdesk-dashboard-color-border)",
  borderRadius: "0.375rem",
  padding: "0.75rem",
  margin: 0,
};

function TextBlock({ label, value }: { readonly label: string; readonly value: string | null }) {
  return (
    <div style={subsectionStyle}>
      <h3 style={h3Style}>{label}</h3>
      {value ? (
        <div
          style={richContentStyle}
          // Sanitized twice: dashboard-api's own write-time pass (services.service.ts's
          // sanitizeLongTextField()) before this was ever stored, and again here at render time
          // as defense-in-depth (lib/sanitize-html.ts) — same double-sanitization pattern
          // Business Knowledge Center's own content field already establishes.
          dangerouslySetInnerHTML={{ __html: sanitizeRenderedHtml(value) }}
        />
      ) : (
        <p style={mutedStyle}>Not set.</p>
      )}
    </div>
  );
}
