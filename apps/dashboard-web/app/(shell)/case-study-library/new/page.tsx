import Link from "next/link";
import { ContentContainer, PageHeader } from "@webdesk/ui";
import { CaseStudyLibraryForm } from "@/components/case-study-library-form";
import { getCaseStudiesForLibraryPicker } from "@/lib/case-study-library";
import { getServerSession } from "@/lib/server-session";

export const dynamic = "force-dynamic";

export default async function NewCaseStudyLibraryRecordPage() {
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const caseStudies = await getCaseStudiesForLibraryPicker();

  return (
    <ContentContainer>
      <PageHeader
        title="New library record"
        breadcrumbs={[
          { label: "Case Study Library", href: "/case-study-library" },
          { label: "New library record" },
        ]}
        linkComponent={Link}
      />
      <CaseStudyLibraryForm mode="create" caseStudies={caseStudies} />
    </ContentContainer>
  );
}
