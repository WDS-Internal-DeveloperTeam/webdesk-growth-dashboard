import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReviewDecision, UserSummary } from "@webdesk/shared-types";
import { ContentContainer, Fact, PageHeader, StatusBadge, typographyTokens } from "@webdesk/ui";
import { ReviewCommentsSection } from "@/components/review-comments-section";
import { ReviewDecisionActions } from "@/components/review-decision-actions";
import { ReviewProcessActions } from "@/components/review-process-actions";
import { SanitizedRichText } from "@/components/sanitized-rich-text";
import { dlStyle, h2Style, mutedStyle, sectionStyle } from "@/lib/detail-section-styles";
import {
  formatTimestamp,
  getReview,
  getReviewComments,
  getReviewDecisions,
  REVIEW_DECISION_ACTION_LABEL,
  reviewStatusBadge,
} from "@/lib/review-and-approval-center";
import { getServerSession } from "@/lib/server-session";
import { getUsersByIds } from "@/lib/users";

export const dynamic = "force-dynamic";

interface ReviewDetailPageProps {
  readonly params: Promise<{ reviewId: string }>;
}

/**
 * No approved wireframe exists for this module — sections mirror the backend's own field/action
 * grouping (Target, Identity, Version compare, Decisions, Process, Decision history, Comments),
 * rendered as sections rather than client-side tabs, the same simplification every sibling
 * module's detail page already establishes.
 *
 * The 3 fetches (`getReview`/`getReviewDecisions`/`getReviewComments`) run concurrently, not
 * sequentially — `getReviewDecisions()`/`getReviewComments()` both degrade to an empty array on a
 * malformed id or a 404 rather than throwing (mirroring `getWebsiteStrategyRecordVersions()`'s own
 * precedent), so there's no real data dependency requiring `getReview()` to resolve first; this
 * page gates its own rendering on `getReview()`'s own `null` result regardless.
 *
 * Every identity this page needs (submittedBy, assignedTo, every decision's actor/delegate target,
 * every comment's author) is resolved in ONE batched `getUsersByIds()` call rather than N
 * individual `getUser()` calls — `getUsersByIds()` already degrades a resolution failure (a 403 —
 * most roles lack `users_roles:view` — or a network error) to a missing map entry rather than
 * throwing, so a caller who can view this page but can't resolve identities still gets a fully
 * rendered page with raw-id fallbacks, not a crash.
 */
export default async function ReviewDetailPage({ params }: ReviewDetailPageProps) {
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const { reviewId } = await params;
  const [review, decisions, comments] = await Promise.all([
    getReview(reviewId),
    getReviewDecisions(reviewId),
    getReviewComments(reviewId),
  ]);
  if (!review) {
    notFound();
  }

  const userIds = new Set<string>([review.submittedByUserId]);
  if (review.assignedToUserId) userIds.add(review.assignedToUserId);
  if (review.decidedByUserId) userIds.add(review.decidedByUserId);
  decisions.forEach((decision) => {
    userIds.add(decision.actorUserId);
    if (decision.delegatedToUserId) userIds.add(decision.delegatedToUserId);
  });
  comments.forEach((comment) => userIds.add(comment.authorUserId));
  const users = await getUsersByIds([...userIds]);

  const badge = reviewStatusBadge(review.status);
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
          { label: "Review and Approval Center", href: "/review-and-approval-center" },
          { label: title },
        ]}
        linkComponent={Link}
        statusBadge={
          <span style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <StatusBadge status={badge.token} label={badge.label} />
            {review.isPaused ? <StatusBadge status="notConfigured" label="Paused" /> : null}
          </span>
        }
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
        <ReviewDecisionActions reviewId={review.id} status={review.status} />
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Process</h2>
        <ReviewProcessActions
          reviewId={review.id}
          status={review.status}
          isPaused={review.isPaused}
          assignedToUserId={review.assignedToUserId}
          assignedToUser={assignedToUser}
        />
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

      <section style={sectionStyle}>
        <h2 style={h2Style}>Comments</h2>
        <ReviewCommentsSection reviewId={review.id} comments={comments} authors={users} />
      </section>
    </ContentContainer>
  );
}

function DecisionEntry({
  decision,
  users,
}: {
  readonly decision: ReviewDecision;
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
        <span style={{ fontWeight: 600 }}>{REVIEW_DECISION_ACTION_LABEL[decision.action]}</span>
        <span style={mutedStyle}>by {actor?.displayName ?? decision.actorUserId}</span>
        <span style={mutedStyle}>{formatTimestamp(decision.decidedAt)}</span>
      </div>
      {decision.action === "delegate" && decision.delegatedToUserId ? (
        <p style={{ ...mutedStyle, marginTop: "0.4rem" }}>
          Delegated to{" "}
          {users.get(decision.delegatedToUserId)?.displayName ?? decision.delegatedToUserId}
        </p>
      ) : null}
      {/* `notes` is real sanitized HTML from RichTextEditor (2026-08-22 standing rule,
          code-review finding on this branch) — rendered via the shared SanitizedRichText
          component, never as raw text, matching every other rich-text field in this app. */}
      {decision.notes ? (
        <SanitizedRichText html={decision.notes} style={{ marginTop: "0.4rem" }} />
      ) : null}
    </li>
  );
}
