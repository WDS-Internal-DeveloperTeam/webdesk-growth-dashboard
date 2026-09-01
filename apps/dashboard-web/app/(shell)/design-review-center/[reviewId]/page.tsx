import Link from "next/link";
import { notFound } from "next/navigation";
import type { DesignReviewDecision, UserSummary } from "@webdesk/shared-types";
import { ContentContainer, Fact, PageHeader, StatusBadge, typographyTokens } from "@webdesk/ui";
import { DesignReviewDecisionActions } from "@/components/design-review-decision-actions";
import { SanitizedRichText } from "@/components/sanitized-rich-text";
import {
  DESIGN_REVIEW_DECISION_ACTION_LABEL,
  DESIGN_REVIEW_TYPE_LABEL,
  designReviewStatusBadge,
  formatTimestamp,
  getDesignReview,
  getDesignReviewDecisions,
} from "@/lib/design-review-center";
import { dlStyle, h2Style, mutedStyle, sectionStyle } from "@/lib/detail-section-styles";
import { getServerSession } from "@/lib/server-session";
import { getUsersByIds } from "@/lib/users";

export const dynamic = "force-dynamic";

interface DesignReviewDetailPageProps {
  readonly params: Promise<{ reviewId: string }>;
}

/**
 * No approved wireframe exists for this module — sections mirror the backend's own field/action
 * grouping (Target, Review type, Identity, Version compare, Decisions, Decision history), rendered
 * as sections rather than client-side tabs, mirroring `ReviewDetailPage`'s own structure
 * file-for-file — this module has no comments capability (D1: the spec names none for Design
 * Review Center, unlike Review and Approval Center's own spec line), so no comments section exists
 * here.
 *
 * The 2 fetches (`getDesignReview`/`getDesignReviewDecisions`) run concurrently, not sequentially —
 * `getDesignReviewDecisions()` degrades to an empty array on a malformed id or a 404 rather than
 * throwing, so there's no real data dependency requiring `getDesignReview()` to resolve first; this
 * page gates its own rendering on `getDesignReview()`'s own `null` result regardless.
 *
 * Every identity this page needs (submittedBy, assignedTo, decidedBy, every decision's own actor)
 * is resolved in ONE batched `getUsersByIds()` call rather than N individual `getUser()` calls —
 * mirrors `ReviewDetailPage`'s own precedent, degrading a resolution failure to raw-id fallbacks
 * rather than crashing the page.
 */
export default async function DesignReviewDetailPage({ params }: DesignReviewDetailPageProps) {
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const { reviewId } = await params;
  const [review, decisions] = await Promise.all([
    getDesignReview(reviewId),
    getDesignReviewDecisions(reviewId),
  ]);
  if (!review) {
    notFound();
  }

  const userIds = new Set<string>([review.submittedByUserId]);
  if (review.assignedToUserId) userIds.add(review.assignedToUserId);
  if (review.decidedByUserId) userIds.add(review.decidedByUserId);
  decisions.forEach((decision) => userIds.add(decision.actorUserId));
  const users = await getUsersByIds([...userIds]);

  const badge = designReviewStatusBadge(review.status);
  const assignedToUser = review.assignedToUserId
    ? (users.get(review.assignedToUserId) ?? null)
    : null;
  const hasVersionLabels = review.versionALabel !== null || review.versionBLabel !== null;
  const title = review.targetLabel ?? `${review.targetModuleKey} review`;

  return (
    <ContentContainer>
      <PageHeader
        title={title}
        breadcrumbs={[
          { label: "Design Review Center", href: "/design-review-center" },
          { label: title },
        ]}
        linkComponent={Link}
        statusBadge={<StatusBadge status={badge.token} label={badge.label} />}
      />

      <section style={sectionStyle}>
        <h2 style={h2Style}>Target</h2>
        <dl style={dlStyle}>
          <Fact label="Target module">{review.targetModuleKey}</Fact>
          <Fact label="Target ID">
            <span style={{ fontFamily: typographyTokens.fontFamilyMono }}>{review.targetId}</span>
          </Fact>
          <Fact label="Target label">{review.targetLabel ?? "Not set"}</Fact>
        </dl>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Review type</h2>
        <dl style={dlStyle}>
          <Fact label="Type">{DESIGN_REVIEW_TYPE_LABEL[review.reviewType]}</Fact>
        </dl>
        <p style={mutedStyle}>
          Immutable after creation — a real review-type change is a different review, not an edit.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Identity</h2>
        <dl style={dlStyle}>
          <Fact label="Submitted by">
            {users.get(review.submittedByUserId)?.displayName ?? review.submittedByUserId}
          </Fact>
          <Fact label="Assigned to">
            {review.assignedToUserId
              ? (assignedToUser?.displayName ?? review.assignedToUserId)
              : "Unassigned"}
          </Fact>
          {review.decidedByUserId ? (
            <Fact label="Decided by">
              {users.get(review.decidedByUserId)?.displayName ?? review.decidedByUserId}
            </Fact>
          ) : null}
          {review.decidedAt ? (
            <Fact label="Decided at">{formatTimestamp(review.decidedAt)}</Fact>
          ) : null}
          <Fact label="Created">{formatTimestamp(review.createdAt)}</Fact>
          <Fact label="Updated">{formatTimestamp(review.updatedAt)}</Fact>
        </dl>
      </section>

      {hasVersionLabels ? (
        <section style={sectionStyle}>
          <h2 style={h2Style}>Version compare</h2>
          <p style={mutedStyle}>
            Opaque, human-supplied labels — not a real diff, since this module has no generic
            cross-module comparison capability.
          </p>
          <dl style={dlStyle}>
            <Fact label="Version A">{review.versionALabel ?? "Not set"}</Fact>
            <Fact label="Version B">{review.versionBLabel ?? "Not set"}</Fact>
          </dl>
        </section>
      ) : null}

      <section style={sectionStyle}>
        <h2 style={h2Style}>Decisions</h2>
        <DesignReviewDecisionActions reviewId={review.id} status={review.status} />
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Decision history</h2>
        {decisions.length === 0 ? (
          <p style={mutedStyle}>No decisions recorded yet.</p>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {decisions.map((decision) => (
              <DecisionEntry key={decision.id} decision={decision} users={users} />
            ))}
          </ul>
        )}
      </section>
    </ContentContainer>
  );
}

function DecisionEntry({
  decision,
  users,
}: {
  readonly decision: DesignReviewDecision;
  readonly users: ReadonlyMap<string, UserSummary>;
}) {
  const actor = users.get(decision.actorUserId);
  return (
    <li
      style={{
        border: "1px solid var(--webdesk-dashboard-color-border)",
        borderRadius: "0.5rem",
        padding: "0.75rem 1rem",
        marginBottom: "0.75rem",
        fontSize: "0.875rem",
      }}
    >
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.75rem" }}>
        <span style={{ fontWeight: 600 }}>
          {DESIGN_REVIEW_DECISION_ACTION_LABEL[decision.action]}
        </span>
        <span style={mutedStyle}>by {actor?.displayName ?? decision.actorUserId}</span>
        <span style={mutedStyle}>{formatTimestamp(decision.decidedAt)}</span>
      </div>
      {/* `notes` is real sanitized HTML from RichTextEditor — rendered via the shared
          SanitizedRichText component, never as raw text, matching every other rich-text field in
          this app. A "supersede" row (the automatic side effect of a DIFFERENT review being
          approved) always has null notes — DesignReviewsService.decide() never writes any. */}
      {decision.notes ? (
        <SanitizedRichText html={decision.notes} style={{ marginTop: "0.4rem" }} />
      ) : null}
    </li>
  );
}
