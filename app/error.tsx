"use client";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="native-error-page">
      <section className="native-error-card" role="alert">
        <p className="native-error-kicker">STICKNEY FIRE DEPARTMENT</p>
        <h1>This screen could not finish loading</h1>
        <p>
          Your saved records were not removed. Retry the screen, or return to
          the operations portal and choose another task.
        </p>
        <div className="native-error-actions">
          <button type="button" onClick={reset}>Try again</button>
          <button type="button" onClick={() => window.location.assign("/")}>
            Return to operations portal
          </button>
        </div>
      </section>
    </main>
  );
}
