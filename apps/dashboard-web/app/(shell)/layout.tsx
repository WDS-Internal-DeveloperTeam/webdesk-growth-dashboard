import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { CURRENT_PROJECT_COOKIE } from "@/lib/current-project";
import { getServerSession } from "@/lib/server-session";

/**
 * The authenticated application shell (Phase 1F brief §8). Every route
 * under this group requires a real session — resolved server-side via
 * `getServerSession()`, which forwards the session cookie to
 * `dashboard-api` and trusts only its 401 as "not authenticated." An API
 * outage (any other failure) throws and is caught by the nearest
 * `error.tsx` boundary, not silently shown as a login prompt.
 *
 * `force-dynamic`: every page here depends on the caller's own session
 * and permission-filtered navigation — never a build-time-static value.
 */
export const dynamic = "force-dynamic";

export default async function ShellLayout({ children }: { children: ReactNode }) {
  const session = await getServerSession();
  if (!session) {
    redirect("/auth/sign-in");
  }

  const cookieStore = await cookies();
  const initialProjectId = cookieStore.get(CURRENT_PROJECT_COOKIE)?.value ?? null;

  return (
    <AppShell
      me={session.me}
      navigation={session.navigation}
      projects={session.projects}
      initialProjectId={initialProjectId}
      systemStatus={session.systemStatus}
    >
      {children}
    </AppShell>
  );
}
