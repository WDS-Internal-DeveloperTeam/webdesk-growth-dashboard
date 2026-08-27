import Link from "next/link";
import { ContentContainer, PageHeader } from "@webdesk/ui";
import { DesignReferenceLibraryForm } from "@/components/design-reference-library-form";
import { getServerSession } from "@/lib/server-session";

export const dynamic = "force-dynamic";

export default async function NewDesignReferenceRecordPage() {
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  return (
    <ContentContainer>
      <PageHeader
        title="New design reference record"
        breadcrumbs={[
          { label: "Design Reference Library", href: "/design-reference-library" },
          { label: "New design reference record" },
        ]}
        linkComponent={Link}
      />
      <DesignReferenceLibraryForm mode="create" />
    </ContentContainer>
  );
}
