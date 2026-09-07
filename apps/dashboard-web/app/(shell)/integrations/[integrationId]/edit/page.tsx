import Link from "next/link";
import { notFound } from "next/navigation";
import { ContentContainer, PageHeader } from "@webdesk/ui";
import { IntegrationForm } from "@/components/integration-form";
import { getIntegration } from "@/lib/integrations";
import { getServerSession } from "@/lib/server-session";

export const dynamic = "force-dynamic";

interface EditIntegrationPageProps {
  readonly params: Promise<{ integrationId: string }>;
}

export default async function EditIntegrationPage({ params }: EditIntegrationPageProps) {
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const { integrationId } = await params;
  const integration = await getIntegration(integrationId);
  if (!integration) {
    notFound();
  }

  return (
    <ContentContainer>
      <PageHeader
        title={`Edit ${integration.displayName}`}
        breadcrumbs={[
          { label: "Integrations", href: "/integrations" },
          { label: integration.displayName, href: `/integrations/${integration.id}` },
          { label: "Edit" },
        ]}
        linkComponent={Link}
      />
      <IntegrationForm mode="edit" integrationId={integration.id} initial={integration} />
    </ContentContainer>
  );
}
