import Link from "next/link";
import { ContentContainer, PageHeader } from "@webdesk/ui";
import { WireframeLibraryForm } from "@/components/wireframe-library-form";
import { getServerSession } from "@/lib/server-session";

export const dynamic = "force-dynamic";

export default async function NewWireframePage() {
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  return (
    <ContentContainer>
      <PageHeader
        title="New record"
        breadcrumbs={[
          { label: "Wireframe Library", href: "/wireframe-library" },
          { label: "New record" },
        ]}
        linkComponent={Link}
      />
      <WireframeLibraryForm mode="create" />
    </ContentContainer>
  );
}
