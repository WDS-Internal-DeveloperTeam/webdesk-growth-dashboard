import Link from "next/link";
import { ContentContainer, PageHeader } from "@webdesk/ui";
import { ServiceLibraryForm } from "@/components/service-library-form";
import {
  getDeliverables,
  getEngagementModels,
  getPlatforms,
  getServiceCategories,
} from "@/lib/service-library";
import { getServerSession } from "@/lib/server-session";

export const dynamic = "force-dynamic";

export default async function NewServicePage() {
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const [categories, deliverables, platforms, engagementModels] = await Promise.all([
    getServiceCategories(),
    getDeliverables(),
    getPlatforms(),
    getEngagementModels(),
  ]);

  return (
    <ContentContainer>
      <PageHeader
        title="New service"
        breadcrumbs={[
          { label: "Service Library", href: "/service-library" },
          { label: "New service" },
        ]}
        linkComponent={Link}
      />
      <ServiceLibraryForm
        mode="create"
        categories={categories}
        deliverables={deliverables}
        platforms={platforms}
        engagementModels={engagementModels}
      />
    </ContentContainer>
  );
}
