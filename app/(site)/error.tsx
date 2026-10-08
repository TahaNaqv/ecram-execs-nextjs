"use client";

import { useEffect } from "react";

export default function SiteError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main
      style={{
        minHeight: "100svh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "24px",
        padding: "48px 20px",
        textAlign: "center",
        background: "#0a0a0b",
        color: "#e4e4e7",
        fontFamily: "var(--font-manrope), sans-serif",
      }}
    >
      <h1 style={{ margin: 0, fontFamily: "var(--font-cormorant), serif", fontWeight: 300, fontSize: "clamp(32px, 6vw, 52px)", color: "#fff" }}>
        Something went wrong.
      </h1>
      <p style={{ margin: 0, maxWidth: "460px", color: "#a6a6ad" }}>
        Please try again. If it keeps happening, contact us directly and we will gladly arrange your journey.
      </p>
      <button
        onClick={() => retry()}
        className="btn-fill"
        style={{ minHeight: "52px", padding: "0 34px", background: "#f4f4f5", color: "#0a0a0b", border: "none", fontSize: "12px", letterSpacing: "0.24em", textTransform: "uppercase", fontWeight: 600, cursor: "pointer" }}
      >
        Try again
      </button>
    </main>
  );
}
