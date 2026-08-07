"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { getApiBaseUrl } from "@/lib/auth";

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
    <main style={{ padding: "2rem", maxWidth: 360 }}>
      <h1>Emergency administrator access</h1>
      <p style={{ fontSize: "0.85rem", color: "#666" }}>
        For authorized administrators only, when Google Workspace SSO is unavailable. Every use of
        this path is logged and reviewed.
      </p>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: "1rem" }}>
          <label htmlFor="email">Email</label>
          <br />
          <input
            id="email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <div style={{ marginBottom: "1rem" }}>
          <label htmlFor="password">Password</label>
          <br />
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>
        {error && (
          <p role="alert" style={{ color: "#b00020" }}>
            {error}
          </p>
        )}
        <button type="submit" disabled={submitting}>
          {submitting ? "Signing in…" : "Continue"}
        </button>
      </form>
      <p style={{ marginTop: "2rem" }}>
        <a href="/auth/sign-in">Back to normal sign-in</a>
      </p>
    </main>
  );
}
