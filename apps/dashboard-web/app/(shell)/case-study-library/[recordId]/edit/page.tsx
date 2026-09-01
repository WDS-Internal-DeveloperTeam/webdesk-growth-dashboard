import Link from "next/link";
import { notFound } from "next/navigation";
import { ContentContainer, PageHeader } from "@webdesk/ui";
import { CaseStudyLibraryForm } from "@/components/case-study-library-form";
import { getCaseStudyLibraryRecord } from "@/lib/case-study-library";
import { getServerSession } from "@/lib/server-session";

export const dynamic = "force-dynamic";

interface EditCaseStudyLibraryRecordPageProps {
  readonly params: Promise<{ recordId: string }>;
}

export default async function EditCaseStudyLibraryRecordPage({
  params,
}: EditCaseStudyLibraryRecordPageProps) {
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const { recordId } = await params;
  const record = await getCaseStudyLibraryRecord(recordId);
  if (!record) {
    notFound();
  }

  return (
    <ContentContainer>
      <PageHeader
        title={`Edit ${record.publicId}`}
        breadcrumbs={[
          { label: "Case Study Library", href: "/case-study-library" },
          { label: record.publicId, href: `/case-study-library/${record.id}` },
          { label: "Edit" },
        ]}
        linkComponent={Link}
      />
      <CaseStudyLibraryForm
        mode="edit"
        recordId={record.id}
        initial={record}
        caseStudies={[]}
        initialCaseStudy={record.caseStudy ?? undefined}
      />
    </ContentContainer>
  );
}
