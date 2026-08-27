import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ContentContainer, PageHeader } from "@webdesk/ui";
import { BrandLibraryForm } from "@/components/brand-library-form";
import { getBrandLibraryRecord } from "@/lib/brand-library";
import { getServerSession } from "@/lib/server-session";

export const dynamic = "force-dynamic";

interface EditBrandLibraryRecordPageProps {
  readonly params: Promise<{ recordId: string }>;
}

export default async function EditBrandLibraryRecordPage({
  params,
}: EditBrandLibraryRecordPageProps) {
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const { recordId } = await params;
  const record = await getBrandLibraryRecord(recordId);
  if (!record) {
    notFound();
  }

  // archived/superseded are terminal — the backend rejects any edit outright
  // (brand-library.service.ts's own update() guard). The detail page already hides its own Edit
  // link for these two statuses, but that only stops a normal click-through — this route itself
  // needs the same guard for a stale bookmark, a second tab open from before the record was
  // archived, or a browser back-button return, matching content-template-library's own identical
  // guard.
  if (record.approvalStatus === "archived" || record.approvalStatus === "superseded") {
    redirect(`/brand-library/${record.id}`);
  }

  return (
    <ContentContainer>
      <PageHeader
        title={`Edit ${record.title}`}
        breadcrumbs={[
          { label: "Brand Library", href: "/brand-library" },
          { label: record.title, href: `/brand-library/${record.id}` },
          { label: "Edit" },
        ]}
        linkComponent={Link}
      />
      <BrandLibraryForm mode="edit" recordId={record.id} initial={record} />
    </ContentContainer>
  );
}
