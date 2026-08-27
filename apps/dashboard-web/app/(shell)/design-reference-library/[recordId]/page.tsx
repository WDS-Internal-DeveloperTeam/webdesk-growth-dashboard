import Link from "next/link";
import { notFound } from "next/navigation";
import { ContentContainer, Fact, PageHeader, StatusBadge } from "@webdesk/ui";
import { DesignReferenceLibraryPublishActions } from "@/components/design-reference-library-publish-actions";
import { DesignReferenceLibraryStatusActions } from "@/components/design-reference-library-status-actions";
import { SanitizedRichText } from "@/components/sanitized-rich-text";
import { primaryActionLinkStyle } from "@/lib/action-link-style";
import {
  designReferenceApprovalStatusBadge,
  designReferencePublishBadge,
  formatTimestamp,
  getDesignReferenceRecord,
} from "@/lib/design-reference-library";
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

interface DesignReferenceLibraryDetailPageProps {
  readonly params: Promise<{ recordId: string }>;
}

/**
 * No approved wireframe exists for this module — sections mirror
 * `03_Detailed_Module_Specifications.md`'s own field grouping (Identity, Reference, Assessment,
 * Status), rendered as sections rather than client-side tabs, the same simplification every
 * sibling detail page already establishes.
 */
export default async function DesignReferenceLibraryDetailPage({
  params,
}: DesignReferenceLibraryDetailPageProps) {
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const { recordId } = await params;
  const record = await getDesignReferenceRecord(recordId);
  if (!record) {
    notFound();
  }

  const approvalBadge = designReferenceApprovalStatusBadge(record.approvalStatus);
  const publishBadge = designReferencePublishBadge(record.isPublished);
  const hasSafeSourceUrl = record.sourceUrl !== null && isSafeHttpUrl(record.sourceUrl);
  const hasSafeScreenshotUrl = record.screenshotUrl !== null && isSafeHttpUrl(record.screenshotUrl);

  return (
    <ContentContainer>
      <PageHeader
        title={record.title}
        breadcrumbs={[
          { label: "Design Reference Library", href: "/design-reference-library" },
          { label: record.title },
        ]}
        linkComponent={Link}
        statusBadge={<StatusBadge status={approvalBadge.token} label={approvalBadge.label} />}
        contextActions={
          <>
            <DesignReferenceLibraryStatusActions
              recordId={record.id}
              approvalStatus={record.approvalStatus}
            />
            <DesignReferenceLibraryPublishActions
              recordId={record.id}
              approvalStatus={record.approvalStatus}
              isPublished={record.isPublished}
            />
            {/* archived/superseded are terminal — the backend rejects any edit of one outright
                (design-reference-library.service.ts's own update() guard), so the link is hidden
                rather than left clickable only to 400 on submit, matching every sibling
                *StatusActions component's own self-hiding behavior for these same two statuses. */}
            {record.approvalStatus !== "archived" && record.approvalStatus !== "superseded" ? (
              <Link
                href={`/design-reference-library/${record.id}/edit`}
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
          <Fact label="Public ID">{record.publicId}</Fact>
          <Fact label="Page/section type">{record.pageSectionType ?? "Not set"}</Fact>
          <Fact label="Tags">{record.tags.length > 0 ? record.tags.join(", ") : "None"}</Fact>
          <Fact label="Version">{record.version}</Fact>
          <Fact label="Created">{formatTimestamp(record.createdAt)}</Fact>
          <Fact label="Updated">{formatTimestamp(record.updatedAt)}</Fact>
        </dl>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Reference</h2>
        <div style={subsectionStyle}>
          <h3 style={h3Style}>Source URL</h3>
          {record.sourceUrl ? (
            hasSafeSourceUrl ? (
              <a href={record.sourceUrl} target="_blank" rel="noopener noreferrer">
                {record.sourceUrl}
              </a>
            ) : (
              <p style={mutedStyle}>{record.sourceUrl}</p>
            )
          ) : (
            <p style={mutedStyle}>Not set.</p>
          )}
        </div>
        <div style={subsectionStyle}>
          <h3 style={h3Style}>Screenshot</h3>
          {record.screenshotUrl ? (
            hasSafeScreenshotUrl ? (
              <a href={record.screenshotUrl} target="_blank" rel="noopener noreferrer">
                {/* A plain <img>, not next/image — an arbitrary external URL, not an asset
                    next/image's build-time optimizer can process. */}
                <img
                  src={record.screenshotUrl}
                  alt={`Screenshot for ${record.title}`}
                  style={{
                    maxWidth: "100%",
                    maxHeight: "24rem",
                    borderRadius: "var(--webdesk-dashboard-radius-sm)",
                    border: "1px solid var(--webdesk-dashboard-color-border)",
                  }}
                />
              </a>
            ) : (
              <p style={mutedStyle}>{record.screenshotUrl}</p>
            )
          ) : (
            <p style={mutedStyle}>Not set.</p>
          )}
        </div>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Assessment</h2>
        <TextBlock label="Likes" value={record.likes} />
        <TextBlock label="Dislikes" value={record.dislikes} />
        <PlainTextBlock label="Desktop behavior" value={record.desktopBehavior} />
        <PlainTextBlock label="Mobile behavior" value={record.mobileBehavior} />
        <TextBlock label="Motion notes" value={record.motionNotes} />
        <TextBlock label="Accessibility concerns" value={record.accessibilityConcerns} />
        <TextBlock label="Performance concerns" value={record.performanceConcerns} />
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

/** Renders `desktopBehavior`/`mobileBehavior` as plain text (D5) — unlike `TextBlock` above,
 *  never through `SanitizedRichText`, since the backend stores these two fields unsanitized as
 *  plain text, not HTML. */
function PlainTextBlock({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string | null;
}) {
  return (
    <div style={subsectionStyle}>
      <h3 style={h3Style}>{label}</h3>
      {value ? (
        <p style={{ ...richContentStyle, whiteSpace: "pre-wrap" }}>{value}</p>
      ) : (
        <p style={mutedStyle}>Not set.</p>
      )}
    </div>
  );
}
