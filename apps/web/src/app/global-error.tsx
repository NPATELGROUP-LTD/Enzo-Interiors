"use client";

/**
 * The last resort: the root layout itself failed, so this brings its own
 * <html> and plain styles (the site's CSS is not loaded here).
 */
export default function GlobalError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="en-GB">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#f6f1e7", color: "#1d2b24" }}>
        <main style={{ minHeight: "100dvh", display: "grid", placeContent: "center", padding: "2rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "2rem", margin: 0 }}>Enzo Interiors</h1>
          <p style={{ maxWidth: "36ch", margin: "1rem auto 1.5rem", lineHeight: 1.5 }}>
            The site did not load. Please try again in a moment.
          </p>
          <button
            type="button"
            onClick={() => retry()}
            style={{ minHeight: 48, padding: "0 1.5rem", borderRadius: 999, border: 0, background: "#1d3a2c", color: "#f6f1e7", fontSize: 16, cursor: "pointer" }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
