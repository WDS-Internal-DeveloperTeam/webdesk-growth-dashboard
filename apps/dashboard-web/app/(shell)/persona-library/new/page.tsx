import Link from "next/link";
import { ContentContainer, PageHeader } from "@webdesk/ui";
import { PersonaLibraryForm } from "@/components/persona-library-form";
import { getServicesForPersonaPicker } from "@/lib/persona-library";
import { getServerSession } from "@/lib/server-session";

export const dynamic = "force-dynamic";

export default async function NewPersonaPage() {
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const services = await getServicesForPersonaPicker();

  return (
    <ContentContainer>
      <PageHeader
        title="New persona"
        breadcrumbs={[
          { label: "Persona Library", href: "/persona-library" },
          { label: "New persona" },
        ]}
        linkComponent={Link}
      />
      <PersonaLibraryForm mode="create" services={services} />
    </ContentContainer>
  );
}
