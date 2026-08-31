import Link from "next/link";
import { notFound } from "next/navigation";
import { ContentContainer, PageHeader } from "@webdesk/ui";
import { DesignTokenLibraryForm } from "@/components/design-token-library-form";
import { getDesignToken } from "@/lib/design-token-library";
import { getServerSession } from "@/lib/server-session";

export const dynamic = "force-dynamic";

interface EditDesignTokenPageProps {
  readonly params: Promise<{ recordId: string }>;
}

export default async function EditDesignTokenPage({ params }: EditDesignTokenPageProps) {
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const { recordId } = await params;
  const token = await getDesignToken(recordId);
  if (!token) {
    notFound();
  }

  return (
    <ContentContainer>
      <PageHeader
        title={`Edit ${token.name}`}
        breadcrumbs={[
          { label: "Design Token Library", href: "/design-token-library" },
          { label: token.name, href: `/design-token-library/${token.recordId}` },
          { label: "Edit" },
        ]}
        linkComponent={Link}
      />
      <DesignTokenLibraryForm mode="edit" recordId={token.recordId} initial={token} />
    </ContentContainer>
  );
}
