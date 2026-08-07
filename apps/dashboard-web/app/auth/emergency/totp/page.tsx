"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { getApiBaseUrl } from "@/lib/auth";

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
    <main style={{ padding: "2rem", maxWidth: 360 }}>
      <h1>Enter your authenticator code</h1>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: "1rem" }}>
          <label htmlFor="code">6-digit code</label>
          <br />
          <input
            id="code"
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
          <p role="alert" style={{ color: "#b00020" }}>
            {error}
          </p>
        )}
        <button type="submit" disabled={submitting}>
          {submitting ? "Verifying…" : "Verify"}
        </button>
      </form>
    </main>
  );
}
