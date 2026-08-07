export default function SessionExpiredPage() {
  return (
    <main style={{ padding: "2rem", maxWidth: 420 }}>
      <h1>Session expired</h1>
      <p>Your session has ended. Please sign in again.</p>
      <p>
        <a href="/auth/sign-in">Sign in</a>
      </p>
    </main>
  );
}
