import Link from "next/link";
import { ContentContainer, PageHeader } from "@webdesk/ui";
import { ComponentLibraryForm } from "@/components/component-library-form";
import {
  getComponentsForReplacementPicker,
  getDesignTokensForComponentPicker,
} from "@/lib/component-library";
import { getServerSession } from "@/lib/server-session";

export const dynamic = "force-dynamic";

export default async function NewComponentPage() {
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  // Independent fetches (neither depends on the other's result) — run concurrently rather than
  // as sequential round trips, mirroring PersonasService.create()'s own Promise.all reasoning.
  const [designTokens, components] = await Promise.all([
    getDesignTokensForComponentPicker(),
    getComponentsForReplacementPicker(),
  ]);

  return (
    <ContentContainer>
      <PageHeader
        title="New component"
        breadcrumbs={[
          { label: "Component Library", href: "/component-library" },
          { label: "New component" },
        ]}
        linkComponent={Link}
      />
      <ComponentLibraryForm mode="create" designTokens={designTokens} components={components} />
    </ContentContainer>
  );
}
