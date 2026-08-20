"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <main className="native-error-page">
          <section className="native-error-card" role="alert">
            <p className="native-error-kicker">STICKNEY FIRE DEPARTMENT</p>
            <h1>The application stopped unexpectedly</h1>
            <p>
              No action was repeated automatically. Retry once, or return to
              the main portal before continuing your work.
            </p>
            <div className="native-error-actions">
              <button type="button" onClick={reset}>Try again</button>
              <button type="button" onClick={() => window.location.assign("/")}>
                Return to operations portal
              </button>
            </div>
          </section>
        </main>
      </body>
    </html>
  );
}
