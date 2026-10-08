import type { Metadata } from "next";
import Link from "next/link";
import { fontVariables } from "@/lib/fonts";

export const metadata: Metadata = {
  title: "Page not found — Ecram Execs",
  robots: { index: false },
};

export default function GlobalNotFound() {
  return (
    <html lang="en" className={fontVariables}>
      <body style={{ margin: 0, background: "#0a0a0b", color: "#e4e4e7", fontFamily: "var(--font-manrope), sans-serif" }}>
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
            boxSizing: "border-box",
          }}
        >
          <span style={{ fontFamily: "var(--font-cinzel), serif", fontSize: "12px", letterSpacing: "0.42em", color: "#8e8e96" }}>
            ECRAM EXECS · 404
          </span>
          <h1
            style={{
              margin: 0,
              fontFamily: "var(--font-cormorant), serif",
              fontWeight: 300,
              fontSize: "clamp(36px, 7vw, 64px)",
              lineHeight: 1.1,
              color: "#ffffff",
              textWrap: "balance",
            }}
          >
            This road doesn&apos;t lead <em style={{ fontStyle: "italic", color: "#c9c9cf" }}>anywhere.</em>
          </h1>
          <p style={{ margin: 0, maxWidth: "460px", color: "#a6a6ad", fontWeight: 400 }}>
            The page you were looking for has moved or no longer exists.
          </p>
          <Link
            href="/"
            style={{
              display: "inline-flex",
              alignItems: "center",
              minHeight: "52px",
              padding: "0 34px",
              background: "#f4f4f5",
              color: "#0a0a0b",
              textDecoration: "none",
              fontSize: "12px",
              letterSpacing: "0.24em",
              textTransform: "uppercase",
              fontWeight: 600,
            }}
          >
            Return home
          </Link>
        </main>
      </body>
    </html>
  );
}
