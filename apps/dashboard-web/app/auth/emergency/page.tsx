"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button, Input } from "@webdesk/ui";
import { getApiBaseUrl } from "@/lib/auth";
import styles from "../auth.module.css";

/**
 * Step 1 of 2 (password). On success, `dashboard-api` has already set a
 * short-lived, pending-MFA session cookie — this page then navigates to
 * the TOTP step, which reads that cookie automatically (no token is ever
 * handled in this page's own JS beyond the fetch call itself).
 */
export default function EmergencyLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`${getApiBaseUrl()}/auth/emergency/login`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!response.ok) {
        setError("Invalid credentials.");
        return;
      }
      router.push("/auth/emergency/totp");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className={styles.page}>
      <div className={`${styles.card} ${styles.cardNarrow}`}>
        <h1 className={styles.title}>Emergency administrator access</h1>
        <p className={styles.body}>
          For authorized administrators only, when Google Workspace SSO is unavailable. Every use of
          this path is logged and reviewed.
        </p>
        <form onSubmit={handleSubmit}>
          <div className={styles.fieldGroup}>
            <Input
              id="email"
              label="Email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <Input
              id="password"
              label="Password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          {error && (
            <p role="alert" className={styles.formError}>
              {error}
            </p>
          )}
          <Button type="submit" variant="primary" disabled={submitting}>
            {submitting ? "Signing in…" : "Continue"}
          </Button>
        </form>
        <p className={styles.secondaryLink}>
          <a href="/auth/sign-in" className={styles.link}>
            Back to normal sign-in
          </a>
        </p>
      </div>
    </main>
  );
}
