import Link from "next/link";
import { notFound } from "next/navigation";
import { ContentContainer, Fact, PageHeader, StatusBadge } from "@webdesk/ui";
import { BrandLibraryPublishActions } from "@/components/brand-library-publish-actions";
import { BrandLibraryStatusActions } from "@/components/brand-library-status-actions";
import { SanitizedRichText } from "@/components/sanitized-rich-text";
import { primaryActionLinkStyle } from "@/lib/action-link-style";
import {
  brandLibraryApprovalStatusBadge,
  brandLibraryPublishBadge,
  formatTimestamp,
  getBrandLibraryRecord,
  RECORD_TYPE_LABEL,
} from "@/lib/brand-library";
import {
  dlStyle,
  h2Style,
  h3Style,
  mutedStyle,
  richContentStyle,
  sectionStyle,
  subsectionStyle,
} from "@/lib/detail-section-styles";
import { isSafeHttpUrl } from "@/lib/safe-http-url";
import { getServerSession } from "@/lib/server-session";

export const dynamic = "force-dynamic";

interface BrandLibraryDetailPageProps {
  readonly params: Promise<{ recordId: string }>;
}

/**
 * No approved wireframe exists for this module — sections mirror
 * `03_Detailed_Module_Specifications.md §10`'s own field grouping (Identity, Content, Status),
 * rendered as sections rather than client-side tabs, the same simplification the Content Template/
 * Persona/Service Library detail pages already establish.
 */
export default async function BrandLibraryDetailPage({ params }: BrandLibraryDetailPageProps) {
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const { recordId } = await params;
  const record = await getBrandLibraryRecord(recordId);
  if (!record) {
    notFound();
  }

  const approvalBadge = brandLibraryApprovalStatusBadge(record.approvalStatus);
  const publishBadge = brandLibraryPublishBadge(record.isPublished);
  const hasSafeFileReference = record.fileReference !== null && isSafeHttpUrl(record.fileReference);

  return (
    <ContentContainer>
      <PageHeader
        title={record.title}
        breadcrumbs={[{ label: "Brand Library", href: "/brand-library" }, { label: record.title }]}
        linkComponent={Link}
        statusBadge={<StatusBadge status={approvalBadge.token} label={approvalBadge.label} />}
        contextActions={
          <>
            <BrandLibraryStatusActions
              recordId={record.id}
              approvalStatus={record.approvalStatus}
            />
            <BrandLibraryPublishActions
              recordId={record.id}
              approvalStatus={record.approvalStatus}
              isPublished={record.isPublished}
            />
            {/* archived/superseded are terminal — the backend rejects any edit of one outright
                (brand-library.service.ts's own update() guard), so the link is hidden rather than
                left clickable only to 400 on submit, matching ContentTemplateStatusActions's own
                self-hiding behavior for these same two statuses. */}
            {record.approvalStatus !== "archived" && record.approvalStatus !== "superseded" ? (
              <Link href={`/brand-library/${record.id}/edit`} style={primaryActionLinkStyle}>
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
          <Fact label="Record type">{RECORD_TYPE_LABEL[record.recordType]}</Fact>
          <Fact label="Version">{record.version}</Fact>
          <Fact label="Created">{formatTimestamp(record.createdAt)}</Fact>
          <Fact label="Updated">{formatTimestamp(record.updatedAt)}</Fact>
        </dl>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Content</h2>
        <div style={subsectionStyle}>
          <h3 style={h3Style}>File reference</h3>
          {record.fileReference ? (
            hasSafeFileReference ? (
              <a href={record.fileReference} target="_blank" rel="noopener noreferrer">
                {record.fileReference}
              </a>
            ) : (
              <p style={mutedStyle}>{record.fileReference}</p>
            )
          ) : (
            <p style={mutedStyle}>Not set.</p>
          )}
        </div>
        <TextBlock label="Description" value={record.description} />
        <TextBlock label="Usage notes" value={record.usageNotes} />
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
