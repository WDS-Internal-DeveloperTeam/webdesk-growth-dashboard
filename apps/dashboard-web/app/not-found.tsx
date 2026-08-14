import { ContentContainer, NotFoundState } from "@webdesk/ui";

export default function NotFound() {
  return (
    <ContentContainer>
      <h1 style={{ textAlign: "center", fontSize: "1.5rem" }}>Page not found</h1>
      <NotFoundState message="The page you're looking for doesn't exist or may have been removed." />
      <p style={{ textAlign: "center" }}>
        <a href="/">Return home</a>
      </p>
    </ContentContainer>
  );
}
