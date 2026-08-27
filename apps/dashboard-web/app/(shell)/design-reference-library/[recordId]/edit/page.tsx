import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ContentContainer, PageHeader } from "@webdesk/ui";
import { DesignReferenceLibraryForm } from "@/components/design-reference-library-form";
import { getDesignReferenceRecord } from "@/lib/design-reference-library";
import { getServerSession } from "@/lib/server-session";

export const dynamic = "force-dynamic";

interface EditDesignReferenceRecordPageProps {
  readonly params: Promise<{ recordId: string }>;
}

export default async function EditDesignReferenceRecordPage({
  params,
}: EditDesignReferenceRecordPageProps) {
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const { recordId } = await params;
  const record = await getDesignReferenceRecord(recordId);
  if (!record) {
    notFound();
  }

  // archived/superseded are terminal — the backend rejects any edit outright
  // (design-reference-library.service.ts's own update() guard). The detail page already hides its
  // own Edit link for these two statuses, but that only stops a normal click-through — this route
  // itself needs the same guard for a stale bookmark, a second tab open from before the record was
  // archived, or a browser back-button return, matching every sibling module's own identical
  // guard.
  if (record.approvalStatus === "archived" || record.approvalStatus === "superseded") {
    redirect(`/design-reference-library/${record.id}`);
  }

  return (
    <ContentContainer>
      <PageHeader
        title={`Edit ${record.title}`}
        breadcrumbs={[
          { label: "Design Reference Library", href: "/design-reference-library" },
          { label: record.title, href: `/design-reference-library/${record.id}` },
          { label: "Edit" },
        ]}
        linkComponent={Link}
      />
      <DesignReferenceLibraryForm mode="edit" recordId={record.id} initial={record} />
    </ContentContainer>
  );
}
