import Link from "next/link";
import { notFound } from "next/navigation";
import { ContentContainer, Fact, PageHeader, StatusBadge } from "@webdesk/ui";
import type { UserSummary } from "@webdesk/shared-types";
import { KnowledgeLibraryStatusActions } from "@/components/knowledge-library-status-actions";
import { SanitizedRichText } from "@/components/sanitized-rich-text";
import { primaryActionLinkStyle } from "@/lib/action-link-style";
import {
  dlStyle,
  h2Style,
  mutedStyle,
  richContentStyle,
  sectionStyle,
} from "@/lib/detail-section-styles";
import {
  formatTimestamp,
  getKnowledgeLibraryRecord,
  knowledgeLibraryConfidentialityBadge,
  knowledgeLibraryStatusBadge,
} from "@/lib/knowledge-library";
import { getServerSession } from "@/lib/server-session";
import { getUser } from "@/lib/users";

export const dynamic = "force-dynamic";

interface KnowledgeLibraryDetailPageProps {
  readonly params: Promise<{ recordId: string }>;
}

/**
 * No approved wireframe exists for this module (`03_Detailed_Module_Specifications.md §28` is a
 * flat field list) — sections mirror the backend's own field grouping (Identity, Source,
 * Confidentiality, Notes, Status), the smallest honest reading of an unsourced screen, matching
 * every prior module's own precedent. `sourceType`/`location`/`notes` may be redacted for the
 * current viewer (`undefined`, not `null`) on a `restricted` record with no `view_confidential`
 * grant — rendered as an inert notice, matching `BusinessKnowledgeRecordForm`'s/`ServiceLibraryForm`'s
 * own redaction convention. "Edit" is hidden once a record reaches its terminal `deprecated`
 * status, matching the equivalent already-shipped precedent on sibling detail pages (e.g.
 * `WebsiteStrategyCenterDetailPage`).
 */
export default async function KnowledgeLibraryDetailPage({
  params,
}: KnowledgeLibraryDetailPageProps) {
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const { recordId } = await params;
  const record = await getKnowledgeLibraryRecord(recordId);
  if (!record) {
    notFound();
  }

  // Secondary, non-essential enrichment — a failure here must degrade to "owner unresolved"
  // rather than crashing the whole detail page, mirroring `EditKnowledgeLibraryRecordPage`'s own
  // try/catch precedent.
  let owner: UserSummary | null = null;
  if (record.ownerUserId) {
    try {
      owner = await getUser(record.ownerUserId);
    } catch (error) {
      console.error("Failed to resolve knowledge library record owner for the detail page", error);
    }
  }

  const statusBadge = knowledgeLibraryStatusBadge(record.status);
  const confidentialityBadge = knowledgeLibraryConfidentialityBadge(record.confidentiality);
  const redacted = record.notes === undefined;
  const isTerminal = record.status === "deprecated";

  return (
    <ContentContainer>
      <PageHeader
        title={record.title}
        breadcrumbs={[
          { label: "Knowledge Library", href: "/knowledge-library" },
          { label: record.title },
        ]}
        linkComponent={Link}
        statusBadge={<StatusBadge status={statusBadge.token} label={statusBadge.label} />}
        contextActions={
          <>
            <KnowledgeLibraryStatusActions recordId={record.id} status={record.status} />
            {isTerminal ? null : (
              <Link href={`/knowledge-library/${record.id}/edit`} style={primaryActionLinkStyle}>
                Edit
              </Link>
            )}
          </>
        }
      />

      <section style={sectionStyle}>
        <h2 style={h2Style}>Identity</h2>
        <dl style={dlStyle}>
          <Fact label="Version">{record.version}</Fact>
          <Fact label="Owner">{owner ? owner.displayName : (record.ownerUserId ?? "—")}</Fact>
          <Fact label="Source date">{record.sourceDate ?? "—"}</Fact>
          <Fact label="Last reviewed">
            {record.lastReviewedAt ? formatTimestamp(record.lastReviewedAt) : "Never"}
          </Fact>
          <Fact label="Approved for agent use">{record.approvedForAgentUse ? "Yes" : "No"}</Fact>
          <Fact label="Created">{formatTimestamp(record.createdAt)}</Fact>
          <Fact label="Updated">{formatTimestamp(record.updatedAt)}</Fact>
        </dl>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Source</h2>
        {redacted ? (
          <p style={mutedStyle}>
            This record is restricted and its source details aren&apos;t visible to you.
          </p>
        ) : (
          <dl style={dlStyle}>
            <Fact label="Source type">{record.sourceType ?? "—"}</Fact>
            <Fact label="Location">{record.location ?? "—"}</Fact>
          </dl>
        )}
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Confidentiality</h2>
        <dl style={dlStyle}>
          <Fact label="Confidentiality">
            <StatusBadge status={confidentialityBadge.token} label={confidentialityBadge.label} />
          </Fact>
          <Fact label="Related entities">
            {record.relatedEntityIds.length > 0 ? record.relatedEntityIds.join(", ") : "None"}
          </Fact>
        </dl>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Notes</h2>
        {redacted ? (
          <p style={mutedStyle}>
            This record is restricted and its notes aren&apos;t visible to you.
          </p>
        ) : record.notes ? (
          <SanitizedRichText html={record.notes} style={richContentStyle} />
        ) : (
          <p style={mutedStyle}>Not set.</p>
        )}
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Status</h2>
        <dl style={dlStyle}>
          <Fact label="Status">
            <StatusBadge status={statusBadge.token} label={statusBadge.label} />
          </Fact>
        </dl>
      </section>
    </ContentContainer>
  );
}
