import Link from "next/link";
import { ContentContainer, PageHeader } from "@webdesk/ui";
import { SectionAndPatternLibraryForm } from "@/components/section-and-pattern-library-form";
import { getServerSession } from "@/lib/server-session";

export const dynamic = "force-dynamic";

export default async function NewSectionPatternPage() {
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  return (
    <ContentContainer>
      <PageHeader
        title="New record"
        breadcrumbs={[
          { label: "Section and Pattern Library", href: "/section-and-pattern-library" },
          { label: "New record" },
        ]}
        linkComponent={Link}
      />
      <SectionAndPatternLibraryForm mode="create" />
    </ContentContainer>
  );
}
