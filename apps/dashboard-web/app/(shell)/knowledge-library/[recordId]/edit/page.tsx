import Link from "next/link";
import { notFound } from "next/navigation";
import { ContentContainer, PageHeader } from "@webdesk/ui";
import type { UserSummary } from "@webdesk/shared-types";
import { KnowledgeLibraryForm } from "@/components/knowledge-library-form";
import { getKnowledgeLibraryRecord } from "@/lib/knowledge-library";
import { getServerSession } from "@/lib/server-session";
import { getUser } from "@/lib/users";

export const dynamic = "force-dynamic";

interface EditKnowledgeLibraryRecordPageProps {
  readonly params: Promise<{ recordId: string }>;
}

/**
 * `deprecated` (terminal, ADR-0016) records reject any edit server-side
 * (`KnowledgeLibraryRecordsService.update()`'s own terminal-state guard), but this route itself
 * renders unconditionally on direct navigation — the same convention every sibling module's own
 * edit route follows (e.g. `SectionAndPatternLibraryEdit`): only the detail page hides its own
 * "Edit" link for a terminal record, rather than this route redirecting away.
 */
export default async function EditKnowledgeLibraryRecordPage({
  params,
}: EditKnowledgeLibraryRecordPageProps) {
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const { recordId } = await params;
  const record = await getKnowledgeLibraryRecord(recordId);
  if (!record) {
    notFound();
  }

  // Resolved server-side, alongside the record itself, so the picker never flashes an empty state
  // before a client-side lookup lands — wrapped in try/catch: this is a secondary, non-essential
  // lookup (the page's primary content doesn't depend on it), so a transient backend failure here
  // must degrade to "owner unresolved" rather than crashing the whole edit page via the error
  // boundary, mirroring `EditProjectPage`'s/`EditPersonaPage`'s own precedent.
  let owner: UserSummary | null = null;
  if (record.ownerUserId) {
    try {
      owner = await getUser(record.ownerUserId);
    } catch (error) {
      console.error("Failed to resolve knowledge library record owner for the edit form", error);
    }
  }

  return (
    <ContentContainer>
      <PageHeader
        title={`Edit ${record.title}`}
        breadcrumbs={[
          { label: "Knowledge Library", href: "/knowledge-library" },
          { label: record.title, href: `/knowledge-library/${record.id}` },
          { label: "Edit" },
        ]}
        linkComponent={Link}
      />
      <KnowledgeLibraryForm
        mode="edit"
        recordId={record.id}
        initial={{
          title: record.title,
          sourceType: record.sourceType,
          location: record.location,
          ownerUserId: record.ownerUserId,
          owner,
          sourceDate: record.sourceDate,
          confidentiality: record.confidentiality,
          approvedForAgentUse: record.approvedForAgentUse,
          notes: record.notes,
          relatedEntityIds: record.relatedEntityIds,
          lastReviewedAt: record.lastReviewedAt,
        }}
      />
    </ContentContainer>
  );
}
