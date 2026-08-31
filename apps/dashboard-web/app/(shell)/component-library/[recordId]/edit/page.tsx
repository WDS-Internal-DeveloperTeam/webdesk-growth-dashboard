import Link from "next/link";
import { notFound } from "next/navigation";
import { ContentContainer, PageHeader } from "@webdesk/ui";
import { ComponentLibraryForm } from "@/components/component-library-form";
import {
  getComponent,
  getComponentsForReplacementPicker,
  getDesignTokensForComponentPicker,
} from "@/lib/component-library";
import { getServerSession } from "@/lib/server-session";

export const dynamic = "force-dynamic";

interface EditComponentPageProps {
  readonly params: Promise<{ recordId: string }>;
}

export default async function EditComponentPage({ params }: EditComponentPageProps) {
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const { recordId } = await params;
  const [component, designTokens, components] = await Promise.all([
    getComponent(recordId),
    getDesignTokensForComponentPicker(),
    getComponentsForReplacementPicker(),
  ]);
  if (!component) {
    notFound();
  }

  return (
    <ContentContainer>
      <PageHeader
        title={`Edit ${component.name}`}
        breadcrumbs={[
          { label: "Component Library", href: "/component-library" },
          { label: component.name, href: `/component-library/${component.recordId}` },
          { label: "Edit" },
        ]}
        linkComponent={Link}
      />
      <ComponentLibraryForm
        mode="edit"
        recordId={component.recordId}
        initial={component}
        designTokens={designTokens}
        components={components}
      />
    </ContentContainer>
  );
}
