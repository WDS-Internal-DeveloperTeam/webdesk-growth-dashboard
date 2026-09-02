import Link from "next/link";
import { ContentContainer, PageHeader } from "@webdesk/ui";
import { ExportRunForm } from "@/components/export-run-form";
import { sortModulesForPicker } from "@/lib/import-and-export-center";
import { getServerSession } from "@/lib/server-session";

export const dynamic = "force-dynamic";

export default async function NewExportRunPage() {
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const modules = sortModulesForPicker(session.navigation);

  return (
    <ContentContainer>
      <PageHeader
        title="New export"
        breadcrumbs={[
          { label: "Import and Export Center", href: "/import-and-export-center" },
          { label: "Exports", href: "/import-and-export-center/exports" },
          { label: "New export" },
        ]}
        linkComponent={Link}
      />
      <ExportRunForm modules={modules} />
    </ContentContainer>
  );
}
