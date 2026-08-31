import Link from "next/link";
import { notFound } from "next/navigation";
import type { UserSummary } from "@webdesk/shared-types";
import { ContentContainer, PageHeader } from "@webdesk/ui";
import { WireframeLibraryForm } from "@/components/wireframe-library-form";
import { getUser } from "@/lib/users";
import { getWireframe } from "@/lib/wireframe-library";
import { getServerSession } from "@/lib/server-session";

export const dynamic = "force-dynamic";

interface EditWireframePageProps {
  readonly params: Promise<{ recordId: string }>;
}

export default async function EditWireframePage({ params }: EditWireframePageProps) {
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const { recordId } = await params;
  const record = await getWireframe(recordId);
  if (!record) {
    notFound();
  }

  // Resolved before rendering the form so the reviewer picker starts pre-populated with a real
  // display summary, rather than just the raw id — mirrors `ProjectForm`'s/`InternalLinkForm`'s
  // own edit-page owner/approver-resolution precedent. A secondary, non-essential lookup, so a
  // transient backend failure here must degrade to "reviewer unresolved" rather than crashing the
  // whole edit page; the raw record.reviewerUserId is still passed through separately below
  // regardless of resolution success, so WireframeLibraryForm can preserve an unresolvable
  // reviewer assignment rather than silently clearing it.
  let reviewer: UserSummary | null = null;
  if (record.reviewerUserId) {
    try {
      reviewer = await getUser(record.reviewerUserId);
    } catch (error) {
      console.error("Failed to resolve wireframe record reviewer for the edit form", error);
    }
  }

  return (
    <ContentContainer>
      <PageHeader
        title={`Edit ${record.pageOrModule}`}
        breadcrumbs={[
          { label: "Wireframe Library", href: "/wireframe-library" },
          { label: record.pageOrModule, href: `/wireframe-library/${record.recordId}` },
          { label: "Edit" },
        ]}
        linkComponent={Link}
      />
      <WireframeLibraryForm
        mode="edit"
        recordId={record.recordId}
        initial={record}
        initialReviewer={reviewer}
      />
    </ContentContainer>
  );
}
