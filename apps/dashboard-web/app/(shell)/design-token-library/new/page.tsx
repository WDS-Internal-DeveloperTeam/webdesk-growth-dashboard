import Link from "next/link";
import { ContentContainer, PageHeader } from "@webdesk/ui";
import { DesignTokenLibraryForm } from "@/components/design-token-library-form";
import { getServerSession } from "@/lib/server-session";

export const dynamic = "force-dynamic";

export default async function NewDesignTokenPage() {
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  return (
    <ContentContainer>
      <PageHeader
        title="New token"
        breadcrumbs={[
          { label: "Design Token Library", href: "/design-token-library" },
          { label: "New token" },
        ]}
        linkComponent={Link}
      />
      <DesignTokenLibraryForm mode="create" />
    </ContentContainer>
  );
}
