import Link from "next/link";
import { notFound } from "next/navigation";
import { ContentContainer, PageHeader } from "@webdesk/ui";
import { WebsiteStrategyCenterForm } from "@/components/website-strategy-center-form";
import { getServerSession } from "@/lib/server-session";
import { getWebsiteStrategyRecord } from "@/lib/website-strategy-center";

export const dynamic = "force-dynamic";

interface EditWebsiteStrategyRecordPageProps {
  readonly params: Promise<{ recordId: string }>;
}

export default async function EditWebsiteStrategyRecordPage({
  params,
}: EditWebsiteStrategyRecordPageProps) {
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const { recordId } = await params;
  const record = await getWebsiteStrategyRecord(recordId);
  if (!record) {
    notFound();
  }

  return (
    <ContentContainer>
      <PageHeader
        title={`Edit ${record.title}`}
        breadcrumbs={[
          { label: "Website Strategy Center", href: "/website-strategy-center" },
          { label: record.title, href: `/website-strategy-center/${record.recordId}` },
          { label: "Edit" },
        ]}
        linkComponent={Link}
      />
      <WebsiteStrategyCenterForm mode="edit" recordId={record.recordId} initial={record} />
    </ContentContainer>
  );
}
