import { baseEnvSchema, loadEnv } from "@webdesk/configuration";
import { z } from "zod";

/**
 * dashboard-web's own environment schema — extends the shared base with
 * only what this app needs to boot. No integration credentials here at
 * Phase 1A (dashboard-web never holds them anyway — ADR-0002).
 */
const webEnvSchema = baseEnvSchema.extend({
  NEXT_PUBLIC_API_BASE_URL: z.string().url().optional(),
});

export function getWebEnv() {
  return loadEnv(webEnvSchema);
}
