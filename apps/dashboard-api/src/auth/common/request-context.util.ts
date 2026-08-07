import { createHash } from "node:crypto";
import type { Request } from "express";

/** SHA-256 of the client IP — data minimization (nodejs/knowledge/security/05-pii-and-compliance.md); the raw address is never persisted. */
export function getIpHash(req: Request): string | null {
  const ip = req.ip;
  return ip ? createHash("sha256").update(ip).digest("hex") : null;
}

/** Truncated to fit the `sessions`/`auth_events` `user_agent` column (VARCHAR(512), src/migrations/00005/00008). */
export function getUserAgent(req: Request): string | null {
  const userAgent = req.header("user-agent");
  return userAgent ? userAgent.slice(0, 512) : null;
}
