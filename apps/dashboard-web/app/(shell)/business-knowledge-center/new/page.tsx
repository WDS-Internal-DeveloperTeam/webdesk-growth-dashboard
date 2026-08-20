import Link from "next/link";
import { ContentContainer, PageHeader } from "@webdesk/ui";
import { BusinessKnowledgeRecordForm } from "@/components/business-knowledge-record-form";
import { getServerSession } from "@/lib/server-session";

export const dynamic = "force-dynamic";

export default async function NewBusinessKnowledgeRecordPage() {
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  return (
    <ContentContainer>
      <PageHeader
        title="New business knowledge record"
        breadcrumbs={[
          { label: "Business Knowledge Center", href: "/business-knowledge-center" },
          { label: "New record" },
        ]}
        linkComponent={Link}
      />
      <BusinessKnowledgeRecordForm mode="create" />
    </ContentContainer>
  );
}
