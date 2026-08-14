"use client";

import { useEffect } from "react";
import { ContentContainer, ErrorState } from "@webdesk/ui";
import { logger } from "@/lib/logger";

/**
 * App Router error boundary. Generic message shown to the user regardless
 * of environment — the real error is logged, never rendered to the client
 * (dev-vs-prod detail separation happens in the log, not in what's shown).
 * `error.digest` doubles as a support reference id without leaking any
 * internal detail (brief §22).
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.error("Unhandled client error", { message: error.message, digest: error.digest });
  }, [error]);

  return (
    <ContentContainer>
      <ErrorState
        titleAs="h1"
        message="An unexpected error occurred. The team has been notified."
        correlationId={error.digest}
        action={<button onClick={() => reset()}>Try again</button>}
      />
    </ContentContainer>
  );
}
