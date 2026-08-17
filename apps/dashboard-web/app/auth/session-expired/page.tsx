import styles from "../auth.module.css";

export default function SessionExpiredPage() {
  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>Session expired</h1>
        <p className={styles.body}>Your session has ended. Please sign in again.</p>
        <p>
          <a href="/auth/sign-in" className={styles.link}>
            Sign in
          </a>
        </p>
      </div>
    </main>
  );
}
