import Link from "next/link";
import { ContentContainer, PageHeader } from "@webdesk/ui";
import { WebsiteStrategyCenterForm } from "@/components/website-strategy-center-form";
import { getServerSession } from "@/lib/server-session";

export const dynamic = "force-dynamic";

export default async function NewWebsiteStrategyRecordPage() {
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  return (
    <ContentContainer>
      <PageHeader
        title="New record"
        breadcrumbs={[
          { label: "Website Strategy Center", href: "/website-strategy-center" },
          { label: "New record" },
        ]}
        linkComponent={Link}
      />
      <WebsiteStrategyCenterForm mode="create" />
    </ContentContainer>
  );
}
