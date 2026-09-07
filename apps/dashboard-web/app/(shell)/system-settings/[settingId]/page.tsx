import Link from "next/link";
import { notFound } from "next/navigation";
import { ContentContainer, Fact, PageHeader, StatusBadge } from "@webdesk/ui";
import { SystemSettingActiveStateActions } from "@/components/system-setting-active-state-actions";
import { primaryActionLinkStyle } from "@/lib/action-link-style";
import {
  dlStyle,
  h2Style,
  h3Style,
  mutedStyle,
  richContentStyle,
  sectionStyle,
  subsectionStyle,
} from "@/lib/detail-section-styles";
import { getServerSession } from "@/lib/server-session";
import {
  formatTimestamp,
  getSystemSetting,
  SETTING_TYPE_LABEL,
  systemSettingActiveBadge,
} from "@/lib/system-settings";

export const dynamic = "force-dynamic";

interface SystemSettingDetailPageProps {
  readonly params: Promise<{ settingId: string }>;
}

/**
 * No approved wireframe exists for this module — sections mirror
 * `03_Detailed_Module_Specifications.md §42`'s own field grouping (Identity, Value, Status),
 * rendered as sections rather than client-side tabs, the same simplification the Brand/Content
 * Template/Persona Library detail pages already establish.
 */
export default async function SystemSettingDetailPage({ params }: SystemSettingDetailPageProps) {
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const { settingId } = await params;
  const setting = await getSystemSetting(settingId);
  if (!setting) {
    notFound();
  }

  const activeBadge = systemSettingActiveBadge(setting.isActive);

  return (
    <ContentContainer>
      <PageHeader
        title={setting.key}
        breadcrumbs={[
          { label: "System Settings", href: "/system-settings" },
          { label: setting.key },
        ]}
        linkComponent={Link}
        statusBadge={<StatusBadge status={activeBadge.token} label={activeBadge.label} />}
        contextActions={
          <>
            <SystemSettingActiveStateActions settingId={setting.id} isActive={setting.isActive} />
            <Link href={`/system-settings/${setting.id}/edit`} style={primaryActionLinkStyle}>
              Edit
            </Link>
          </>
        }
      />

      <section style={sectionStyle}>
        <h2 style={h2Style}>Identity</h2>
        <dl style={dlStyle}>
          <Fact label="Public ID">{setting.publicId}</Fact>
          <Fact label="Setting type">{SETTING_TYPE_LABEL[setting.settingType]}</Fact>
          <Fact label="Key">{setting.key}</Fact>
          <Fact label="Created">{formatTimestamp(setting.createdAt)}</Fact>
          <Fact label="Updated">{formatTimestamp(setting.updatedAt)}</Fact>
        </dl>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Value</h2>
        <div style={subsectionStyle}>
          <h3 style={h3Style}>Value (JSON)</h3>
          <pre style={{ ...richContentStyle, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
            {JSON.stringify(setting.value, null, 2)}
          </pre>
        </div>
        <div style={subsectionStyle}>
          <h3 style={h3Style}>Description</h3>
          {setting.description ? (
            <p style={{ whiteSpace: "pre-wrap" }}>{setting.description}</p>
          ) : (
            <p style={mutedStyle}>Not set.</p>
          )}
        </div>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Status</h2>
        <dl style={dlStyle}>
          <Fact label="Active state">
            <StatusBadge status={activeBadge.token} label={activeBadge.label} />
          </Fact>
        </dl>
      </section>
    </ContentContainer>
  );
}
