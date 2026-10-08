import type { Metadata } from "next";
import Link from "next/link";
import { fontVariables } from "@/lib/fonts";
import "./(site)/site.css";

export const metadata: Metadata = {
  title: "Page not found — Ecram Execs",
  robots: { index: false },
};

export default function GlobalNotFound() {
  return (
    <html lang="en" className={fontVariables}>
      <body className="bg-ink-950 font-sans text-ink-150">
        <main className="box-border flex min-h-svh flex-col items-center justify-center gap-6 px-5 py-12 text-center">
          <span className="font-display text-[12px] tracking-[0.42em] text-ink-450">ECRAM EXECS · 404</span>
          <h1 className="m-0 font-serif text-[clamp(36px,7vw,64px)] leading-[1.1] font-light text-white">
            This road doesn&apos;t lead <em className="text-ink-250 italic">anywhere.</em>
          </h1>
          <p className="m-0 max-w-[460px] text-ink-400">The page you were looking for has moved or no longer exists.</p>
          <Link
            href="/"
            className="btn-fill inline-flex min-h-[52px] items-center bg-ink-50 px-[34px] text-[12px] font-semibold tracking-[0.24em] text-ink-950 no-underline uppercase"
          >
            Return home
          </Link>
        </main>
      </body>
    </html>
  );
}
