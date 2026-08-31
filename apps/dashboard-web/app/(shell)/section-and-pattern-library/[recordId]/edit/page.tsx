import Link from "next/link";
import { notFound } from "next/navigation";
import { ContentContainer, PageHeader } from "@webdesk/ui";
import { SectionAndPatternLibraryForm } from "@/components/section-and-pattern-library-form";
import { getSectionPattern } from "@/lib/section-and-pattern-library";
import { getServerSession } from "@/lib/server-session";

export const dynamic = "force-dynamic";

interface EditSectionPatternPageProps {
  readonly params: Promise<{ recordId: string }>;
}

export default async function EditSectionPatternPage({ params }: EditSectionPatternPageProps) {
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const { recordId } = await params;
  const record = await getSectionPattern(recordId);
  if (!record) {
    notFound();
  }

  return (
    <ContentContainer>
      <PageHeader
        title={`Edit ${record.name}`}
        breadcrumbs={[
          { label: "Section and Pattern Library", href: "/section-and-pattern-library" },
          { label: record.name, href: `/section-and-pattern-library/${record.recordId}` },
          { label: "Edit" },
        ]}
        linkComponent={Link}
      />
      <SectionAndPatternLibraryForm mode="edit" recordId={record.recordId} initial={record} />
    </ContentContainer>
  );
}
