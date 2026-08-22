import Link from "next/link";
import { notFound } from "next/navigation";
import { ContentContainer, PageHeader } from "@webdesk/ui";
import { PersonaLibraryForm } from "@/components/persona-library-form";
import { getServerSession } from "@/lib/server-session";
import { getPersona, getServicesForPersonaPicker } from "@/lib/persona-library";

export const dynamic = "force-dynamic";

interface EditPersonaPageProps {
  readonly params: Promise<{ personaId: string }>;
}

export default async function EditPersonaPage({ params }: EditPersonaPageProps) {
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const { personaId } = await params;
  const [persona, services] = await Promise.all([
    getPersona(personaId),
    getServicesForPersonaPicker(),
  ]);
  if (!persona) {
    notFound();
  }

  return (
    <ContentContainer>
      <PageHeader
        title={`Edit ${persona.name}`}
        breadcrumbs={[
          { label: "Persona Library", href: "/persona-library" },
          { label: persona.name, href: `/persona-library/${persona.id}` },
          { label: "Edit" },
        ]}
        linkComponent={Link}
      />
      <PersonaLibraryForm
        mode="edit"
        personaId={persona.id}
        initial={persona}
        services={services}
      />
    </ContentContainer>
  );
}
