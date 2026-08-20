import Link from "next/link";
import { notFound } from "next/navigation";
import { ContentContainer, Fact, PageHeader, StatusBadge } from "@webdesk/ui";
import { BusinessKnowledgeStatusActions } from "@/components/business-knowledge-status-actions";
import { primaryActionLinkStyle } from "@/lib/action-link-style";
import {
  businessKnowledgeStatusBadge,
  formatTimestamp,
  getBusinessKnowledgeRecord,
  RECORD_TYPE_LABEL,
} from "@/lib/business-knowledge";
import { getServerSession } from "@/lib/server-session";

export const dynamic = "force-dynamic";

interface BusinessKnowledgeDetailPageProps {
  readonly params: Promise<{ recordId: string }>;
}

/** No approved wireframe exists for this screen. Renders the record as a single page of sections
 *  (Overview + Content + Notes), the same "sections, not client-side tabs" simplification the
 *  Project Detail page already established — keeps the page mostly server-rendered, with only the
 *  status-transition actions as a small client island (`BusinessKnowledgeStatusActions`). An "Edit"
 *  action links to `/business-knowledge-center/:id/edit` (title/content/notes only, matching
 *  `ProjectDetailPage`'s own Edit-link-plus-status-actions header layout). */
export default async function BusinessKnowledgeDetailPage({
  params,
}: BusinessKnowledgeDetailPageProps) {
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const { recordId } = await params;
  const record = await getBusinessKnowledgeRecord(recordId);
  if (!record) {
    notFound();
  }

  const badge = businessKnowledgeStatusBadge(record.status);
  // `content`/`notes` being absent from the JSON response (not merely `null`) is the confidential-
  // field redaction signal, not "no content exists" — a real record always has non-empty content.
  const isRedacted = record.content === undefined;

  return (
    <ContentContainer>
      <PageHeader
        title={record.title}
        breadcrumbs={[
          { label: "Business Knowledge Center", href: "/business-knowledge-center" },
          { label: record.title },
        ]}
        linkComponent={Link}
        statusBadge={<StatusBadge status={badge.token} label={badge.label} />}
        contextActions={
          <>
            <BusinessKnowledgeStatusActions recordId={record.id} status={record.status} />
            <Link
              href={`/business-knowledge-center/${record.id}/edit`}
              style={primaryActionLinkStyle}
            >
              Edit
            </Link>
          </>
        }
      />

      <section style={sectionStyle}>
        <h2 style={h2Style}>Overview</h2>
        <dl style={dlStyle}>
          <Fact label="Record type">{RECORD_TYPE_LABEL[record.recordType]}</Fact>
          <Fact label="Created">{formatTimestamp(record.createdAt)}</Fact>
          <Fact label="Updated">{formatTimestamp(record.updatedAt)}</Fact>
        </dl>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Content</h2>
        {isRedacted ? (
          <p style={redactedStyle}>
            This record is restricted — its content isn&apos;t visible to your account.
          </p>
        ) : (
          <p style={contentStyle}>{record.content}</p>
        )}
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Notes</h2>
        {isRedacted ? (
          <p style={redactedStyle}>
            This record is restricted — its notes aren&apos;t visible to your account.
          </p>
        ) : record.notes ? (
          <p style={contentStyle}>{record.notes}</p>
        ) : (
          <p style={mutedStyle}>No notes.</p>
        )}
      </section>
    </ContentContainer>
  );
}

const sectionStyle: React.CSSProperties = {
  marginBottom: "2rem",
};

const h2Style: React.CSSProperties = {
  fontSize: "1.125rem",
  fontWeight: 600,
  marginBottom: "0.75rem",
};

const dlStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(14rem, 1fr))",
  gap: "0.75rem 1.5rem",
  margin: 0,
};

const contentStyle: React.CSSProperties = {
  fontSize: "0.9375rem",
  color: "var(--webdesk-dashboard-color-foreground)",
  whiteSpace: "pre-wrap",
  margin: 0,
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
