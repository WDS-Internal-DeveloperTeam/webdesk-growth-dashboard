"use client";

import { useEffect, useState } from "react";
import { getApiBaseUrl } from "@/lib/auth";
import styles from "../auth.module.css";

/** Fires the logout call on mount — `dashboard-api` revokes the session server-side immediately (knowledge/05: "explicitly revokes the current session ... rather than merely discarding the client-side token"). */
export default function LogoutPage() {
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetch(`${getApiBaseUrl()}/auth/logout`, {
      method: "POST",
      credentials: "include",
    }).finally(() => {
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
