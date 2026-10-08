"use client";

// Last-resort boundary: replaces the root layout if it fails to render.
export default function GlobalError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#0a0a0b", color: "#e4e4e7", fontFamily: "system-ui, sans-serif" }}>
        <title>Something went wrong — Ecram Execs</title>
        <main style={{ minHeight: "100svh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "20px", padding: "48px 20px", textAlign: "center", boxSizing: "border-box" }}>
          <h1 style={{ margin: 0, fontWeight: 300, fontSize: "32px", color: "#fff" }}>Something went wrong.</h1>
          <p style={{ margin: 0, color: "#a6a6ad" }}>Please try again in a moment.</p>
          <button onClick={() => retry()} style={{ minHeight: "48px", padding: "0 28px", background: "#f4f4f5", color: "#0a0a0b", border: "none", fontSize: "12px", letterSpacing: "0.2em", textTransform: "uppercase", fontWeight: 600, cursor: "pointer" }}>
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
