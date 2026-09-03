import Link from "next/link";
import { ContentContainer, PageHeader } from "@webdesk/ui";
import { HelpCenterForm } from "@/components/help-center-form";
import { getServerSession } from "@/lib/server-session";

export const dynamic = "force-dynamic";

export default async function NewHelpArticlePage() {
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  return (
    <ContentContainer>
      <PageHeader
        title="New help article"
        breadcrumbs={[{ label: "Help Center", href: "/help-center" }, { label: "New article" }]}
        linkComponent={Link}
      />
      <HelpCenterForm mode="create" />
    </ContentContainer>
  );
}
