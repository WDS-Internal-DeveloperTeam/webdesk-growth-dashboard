import Link from "next/link";
import { ContentContainer, PageHeader } from "@webdesk/ui";
import { IntegrationForm } from "@/components/integration-form";
import { getServerSession } from "@/lib/server-session";

export const dynamic = "force-dynamic";

export default async function NewIntegrationPage() {
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  return (
    <ContentContainer>
      <PageHeader
        title="New integration"
        breadcrumbs={[
          { label: "Integrations", href: "/integrations" },
          { label: "New integration" },
        ]}
        linkComponent={Link}
      />
      <IntegrationForm mode="create" />
    </ContentContainer>
  );
}
