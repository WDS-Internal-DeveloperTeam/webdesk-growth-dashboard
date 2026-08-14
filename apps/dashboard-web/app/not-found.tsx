import { ContentContainer, NotFoundState } from "@webdesk/ui";

/**
 * `NotFoundState`'s title renders as a styled `<p>` by default — it's a
 * reusable component meant to work embedded inline within a page that
 * already has its own `<h1>`. This file IS a full-page boundary (Next.js's
 * not-found route), so `titleAs="h1"` gives it the real top-level heading a
 * page needs, replacing what used to be a separate, redundant `<h1>` with
 * different wording than this component's own default title.
 */
export default function NotFound() {
  return (
    <ContentContainer>
      <NotFoundState
        title="Page not found"
        titleAs="h1"
        message="The page you're looking for doesn't exist or may have been removed."
      />
      <p style={{ textAlign: "center" }}>
        <a href="/">Return home</a>
      </p>
    </ContentContainer>
  );
}
