"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button, Input } from "@webdesk/ui";
import { getApiBaseUrl } from "@/lib/auth";
import styles from "../../auth.module.css";

/** Step 2 of 2 (TOTP). Reads the pending session cookie set by the password step automatically — the code is the only thing this form submits. */
export default function EmergencyTotpPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`${getApiBaseUrl()}/auth/emergency/totp`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      if (!response.ok) {
        setError("Invalid code. Please try again.");
        return;
      }
      router.push("/");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className={styles.page}>
      <div className={`${styles.card} ${styles.cardNarrow}`}>
        <h1 className={styles.title}>Enter your authenticator code</h1>
        <form onSubmit={handleSubmit}>
          <div className={styles.fieldGroup}>
            <Input
              id="code"
              label="6-digit code"
              type="text"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              autoComplete="one-time-code"
              required
              value={code}
              onChange={(event) => setCode(event.target.value)}
            />
          </div>
          {error && (
            <p role="alert" className={styles.formError}>
              {error}
            </p>
          )}
          <Button type="submit" variant="primary" disabled={submitting}>
            {submitting ? "Verifying…" : "Verify"}
          </Button>
        </form>
      </div>
    </main>
  );
}
