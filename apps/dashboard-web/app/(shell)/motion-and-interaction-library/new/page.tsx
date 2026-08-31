import Link from "next/link";
import { ContentContainer, PageHeader } from "@webdesk/ui";
import { MotionInteractionLibraryForm } from "@/components/motion-interaction-library-form";
import { getComponentsForMotionInteractionPicker } from "@/lib/motion-and-interaction-library";
import { getServerSession } from "@/lib/server-session";

export const dynamic = "force-dynamic";

export default async function NewMotionInteractionRecordPage() {
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const components = await getComponentsForMotionInteractionPicker();

  return (
    <ContentContainer>
      <PageHeader
        title="New record"
        breadcrumbs={[
          { label: "Motion and Interaction Library", href: "/motion-and-interaction-library" },
          { label: "New record" },
        ]}
        linkComponent={Link}
      />
      <MotionInteractionLibraryForm mode="create" components={components} />
    </ContentContainer>
  );
}
