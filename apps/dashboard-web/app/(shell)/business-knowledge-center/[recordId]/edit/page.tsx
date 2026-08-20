import Link from "next/link";
import { notFound } from "next/navigation";
import { ContentContainer, PageHeader } from "@webdesk/ui";
import { BusinessKnowledgeRecordForm } from "@/components/business-knowledge-record-form";
import { getBusinessKnowledgeRecord } from "@/lib/business-knowledge";
import { getServerSession } from "@/lib/server-session";

export const dynamic = "force-dynamic";

interface EditBusinessKnowledgeRecordPageProps {
  readonly params: Promise<{ recordId: string }>;
}

export default async function EditBusinessKnowledgeRecordPage({
  params,
}: EditBusinessKnowledgeRecordPageProps) {
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const { recordId } = await params;
  const record = await getBusinessKnowledgeRecord(recordId);
  if (!record) {
    notFound();
  }

  return (
    <ContentContainer>
      <PageHeader
        title={`Edit ${record.title}`}
        breadcrumbs={[
          { label: "Business Knowledge Center", href: "/business-knowledge-center" },
          { label: record.title, href: `/business-knowledge-center/${record.id}` },
          { label: "Edit" },
        ]}
        linkComponent={Link}
      />
      <BusinessKnowledgeRecordForm
        mode="edit"
        recordId={record.id}
        initial={{
          recordType: record.recordType,
          title: record.title,
          content: record.content,
          notes: record.notes,
        }}
      />
    </ContentContainer>
  );
}
