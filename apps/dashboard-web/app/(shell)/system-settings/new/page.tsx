import Link from "next/link";
import { ContentContainer, PageHeader } from "@webdesk/ui";
import { SystemSettingForm } from "@/components/system-settings-form";
import { getServerSession } from "@/lib/server-session";

export const dynamic = "force-dynamic";

export default async function NewSystemSettingPage() {
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  return (
    <ContentContainer>
      <PageHeader
        title="New system setting"
        breadcrumbs={[
          { label: "System Settings", href: "/system-settings" },
          { label: "New system setting" },
        ]}
        linkComponent={Link}
      />
      <SystemSettingForm mode="create" />
    </ContentContainer>
  );
}
