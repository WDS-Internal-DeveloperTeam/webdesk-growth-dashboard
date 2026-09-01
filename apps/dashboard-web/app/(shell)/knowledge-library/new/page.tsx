import Link from "next/link";
import { ContentContainer, PageHeader } from "@webdesk/ui";
import { KnowledgeLibraryForm } from "@/components/knowledge-library-form";
import { getServerSession } from "@/lib/server-session";

export const dynamic = "force-dynamic";

export default async function NewKnowledgeLibraryRecordPage() {
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  return (
    <ContentContainer>
      <PageHeader
        title="New knowledge library record"
        breadcrumbs={[
          { label: "Knowledge Library", href: "/knowledge-library" },
          { label: "New record" },
        ]}
        linkComponent={Link}
      />
      <KnowledgeLibraryForm mode="create" />
    </ContentContainer>
  );
}
