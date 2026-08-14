import { redirect } from "next/navigation";

/**
 * The canonical Home route is `/home` (matching the module registry's own
 * `route` field for the `home` module — one source of truth, not two).
 * The `(shell)` layout's own auth guard handles the unauthenticated case
 * from there, so this redirect doesn't need to duplicate that check.
 */
export default function RootPage() {
  redirect("/home");
}
