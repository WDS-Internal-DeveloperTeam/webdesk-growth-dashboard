import Link from "next/link";
import { notFound } from "next/navigation";
import { ContentContainer, Fact, PageHeader, StatusBadge } from "@webdesk/ui";
import { ContentTemplatePublishActions } from "@/components/content-template-library-publish-actions";
import { ContentTemplateStatusActions } from "@/components/content-template-library-status-actions";
import { SanitizedRichText } from "@/components/sanitized-rich-text";
import {
  contentTemplateApprovalStatusBadge,
  contentTemplatePublishBadge,
  formatTimestamp,
  getContentTemplate,
} from "@/lib/content-template-library";
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

export const dynamic = "force-dynamic";

interface ContentTemplateLibraryDetailPageProps {
  readonly params: Promise<{ templateId: string }>;
}

/**
 * No approved wireframe exists for this module — sections mirror
 * `03_Detailed_Module_Specifications.md §25`'s own field grouping (Identity, Sections, Guidance,
 * Status), rendered as sections rather than client-side tabs, the same simplification the
 * Project/Persona Library/Service Library detail pages already establish.
 */
export default async function ContentTemplateLibraryDetailPage({
  params,
}: ContentTemplateLibraryDetailPageProps) {
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const { templateId } = await params;
  const template = await getContentTemplate(templateId);
  if (!template) {
    notFound();
  }

  const approvalBadge = contentTemplateApprovalStatusBadge(template.approvalStatus);
  const publishBadge = contentTemplatePublishBadge(template.isPublished);

  return (
    <ContentContainer>
      <PageHeader
        title={template.pageType}
        breadcrumbs={[
          { label: "Content Template Library", href: "/content-template-library" },
          { label: template.pageType },
        ]}
        linkComponent={Link}
        statusBadge={<StatusBadge status={approvalBadge.token} label={approvalBadge.label} />}
        contextActions={
          <>
            <ContentTemplateStatusActions
              templateId={template.id}
              approvalStatus={template.approvalStatus}
            />
            <ContentTemplatePublishActions
              templateId={template.id}
              approvalStatus={template.approvalStatus}
              isPublished={template.isPublished}
            />
            {/* archived/superseded are terminal — the backend rejects any edit of one outright
                (content-templates.service.ts's own update() guard), so the link is hidden rather
                than left clickable only to 400 on submit, matching WebsiteStrategyStatusActions's/
                ContentTemplateStatusActions's own self-hiding behavior for these same two
                statuses. */}
            {template.approvalStatus !== "archived" && template.approvalStatus !== "superseded" ? (
              <Link
                href={`/content-template-library/${template.id}/edit`}
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
          <Fact label="Public ID">{template.publicId}</Fact>
          <Fact label="Version">{template.version}</Fact>
          <Fact label="Created">{formatTimestamp(template.createdAt)}</Fact>
          <Fact label="Updated">{formatTimestamp(template.updatedAt)}</Fact>
        </dl>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Sections</h2>
        <dl style={dlStyle}>
          <Fact label="Required sections">
            {template.requiredSections && template.requiredSections.length > 0
              ? template.requiredSections.join(", ")
              : "None"}
          </Fact>
          <Fact label="Optional sections">
            {template.optionalSections && template.optionalSections.length > 0
              ? template.optionalSections.join(", ")
              : "None"}
          </Fact>
        </dl>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Guidance</h2>
        <TextBlock label="Purpose" value={template.purpose} />
        <TextBlock label="Proof rules" value={template.proofRules} />
        <TextBlock label="SEO/AEO/GEO requirements" value={template.seoAeoGeoRequirements} />
        <TextBlock label="Schema" value={template.schema} />
        <TextBlock label="CTA rules" value={template.ctaRules} />
        <TextBlock label="Content-depth guidance" value={template.contentDepthGuidance} />
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
            {template.publishedAt ? formatTimestamp(template.publishedAt) : "Never"}
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
