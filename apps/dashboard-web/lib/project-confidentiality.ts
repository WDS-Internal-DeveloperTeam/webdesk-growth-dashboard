import type { Project } from "@webdesk/shared-types";

/**
 * Shared by the detail page (a Server Component) and the create/edit form (a Client Component) —
 * unlike the rest of `lib/projects.ts`, this file has no `next/headers` dependency, so it's safe
 * to import from client code too.
 */
export const CONFIDENTIALITY_LABEL: Readonly<Record<Project["confidentiality"], string>> = {
  public: "Public",
  internal: "Internal",
  confidential: "Confidential",
  restricted: "Restricted",
};

export const CONFIDENTIALITY_VALUES: readonly Project["confidentiality"][] = [
  "public",
  "internal",
  "confidential",
  "restricted",
];
