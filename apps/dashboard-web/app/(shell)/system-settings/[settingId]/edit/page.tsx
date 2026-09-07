import Link from "next/link";
import { notFound } from "next/navigation";
import { ContentContainer, PageHeader } from "@webdesk/ui";
import { SystemSettingForm } from "@/components/system-settings-form";
import { getServerSession } from "@/lib/server-session";
import { getSystemSetting } from "@/lib/system-settings";

export const dynamic = "force-dynamic";

interface EditSystemSettingPageProps {
  readonly params: Promise<{ settingId: string }>;
}

export default async function EditSystemSettingPage({ params }: EditSystemSettingPageProps) {
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const { settingId } = await params;
  const setting = await getSystemSetting(settingId);
  if (!setting) {
    notFound();
  }

  return (
    <ContentContainer>
      <PageHeader
        title={`Edit ${setting.key}`}
        breadcrumbs={[
          { label: "System Settings", href: "/system-settings" },
          { label: setting.key, href: `/system-settings/${setting.id}` },
          { label: "Edit" },
        ]}
        linkComponent={Link}
      />
      <SystemSettingForm mode="edit" settingId={setting.id} initial={setting} />
    </ContentContainer>
  );
}
