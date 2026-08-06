"use client";

import { useEffect } from "react";
import { logger } from "@/lib/logger";

/**
 * App Router error boundary. Generic message shown to the user regardless
 * of environment — the real error is logged, never rendered to the client
 * (dev-vs-prod detail separation happens in the log, not in what's shown).
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
    <main style={{ padding: "2rem" }}>
      <h1>Something went wrong</h1>
      <p>An unexpected error occurred. The team has been notified.</p>
      <button onClick={() => reset()}>Try again</button>
    </main>
  );
}
