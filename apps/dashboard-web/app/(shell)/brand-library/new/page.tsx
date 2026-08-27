import Link from "next/link";
import { ContentContainer, PageHeader } from "@webdesk/ui";
import { BrandLibraryForm } from "@/components/brand-library-form";
import { getServerSession } from "@/lib/server-session";

export const dynamic = "force-dynamic";

export default async function NewBrandLibraryRecordPage() {
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  return (
    <ContentContainer>
      <PageHeader
        title="New brand library record"
        breadcrumbs={[
          { label: "Brand Library", href: "/brand-library" },
          { label: "New brand library record" },
        ]}
        linkComponent={Link}
      />
      <BrandLibraryForm mode="create" />
    </ContentContainer>
  );
}
