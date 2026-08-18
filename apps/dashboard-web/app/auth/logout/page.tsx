"use client";

import { useEffect, useState } from "react";
import { getApiBaseUrl } from "@/lib/auth";
import styles from "../auth.module.css";

/**
 * Fires BOTH logout calls on mount — one login now produces two independent sessions (see
 * docs/implementation/session-exchange.md): `dashboard-api`'s own `/auth/logout` revokes the
 * session tied to dashboard-api's own cookie, and this app's own `/auth/session` DELETE route
 * revokes the session tied to dashboard-web's own first-party cookie (the one that actually
 * authenticates every page under `(shell)`). Both must succeed for "Sign out" to actually end the
 * login — knowledge/05: "explicitly revokes the current session ... rather than merely discarding
 * the client-side token".
 */
export default function LogoutPage() {
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void Promise.allSettled([
      fetch(`${getApiBaseUrl()}/auth/logout`, {
        method: "POST",
        credentials: "include",
      }),
      fetch("/auth/session", { method: "DELETE" }),
    ]).finally(() => {
      if (!cancelled) {
        setDone(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>{done ? "Signed out" : "Signing out…"}</h1>
        {done && (
          <p>
            <a href="/auth/sign-in" className={styles.link}>
              Sign in again
            </a>
          </p>
        )}
      </div>
    </main>
  );
}
