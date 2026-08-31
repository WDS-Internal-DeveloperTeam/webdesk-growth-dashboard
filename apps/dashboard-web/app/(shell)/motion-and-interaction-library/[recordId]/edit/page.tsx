import Link from "next/link";
import { notFound } from "next/navigation";
import { ContentContainer, PageHeader } from "@webdesk/ui";
import { MotionInteractionLibraryForm } from "@/components/motion-interaction-library-form";
import {
  getComponentsForMotionInteractionPicker,
  getMotionInteractionRecord,
} from "@/lib/motion-and-interaction-library";
import { getServerSession } from "@/lib/server-session";

export const dynamic = "force-dynamic";

interface EditMotionInteractionRecordPageProps {
  readonly params: Promise<{ recordId: string }>;
}

export default async function EditMotionInteractionRecordPage({
  params,
}: EditMotionInteractionRecordPageProps) {
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const { recordId } = await params;
  const [record, components] = await Promise.all([
    getMotionInteractionRecord(recordId),
    getComponentsForMotionInteractionPicker(),
  ]);
  if (!record) {
    notFound();
  }

  return (
    <ContentContainer>
      <PageHeader
        title={`Edit ${record.name}`}
        breadcrumbs={[
          { label: "Motion and Interaction Library", href: "/motion-and-interaction-library" },
          { label: record.name, href: `/motion-and-interaction-library/${record.recordId}` },
          { label: "Edit" },
        ]}
        linkComponent={Link}
      />
      <MotionInteractionLibraryForm
        mode="edit"
        recordId={record.recordId}
        initial={record}
        components={components}
      />
    </ContentContainer>
  );
}
