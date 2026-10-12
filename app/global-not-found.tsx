import type { Metadata } from "next";
import Link from "next/link";
import { fontVariables } from "@/lib/fonts";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import "./[locale]/site.css";

export const metadata: Metadata = {
  title: "Page not found · Pagina niet gevonden — Ecram Execs",
  robots: { index: false },
};

/**
 * The 404 for any URL that matches no route. Next.js skips rendering for this file, so it sits
 * outside `app/[locale]/` and cannot know the visitor's language — `next/root-params` is
 * unavailable here and reading a cookie would make it dynamic. A segment-level
 * `app/[locale]/not-found.tsx` is not an option either: `[locale]` matches any first segment, so
 * the locale layout itself calls `notFound()` for an invalid one, and a not-found boundary cannot
 * render inside the layout that threw. Both languages are therefore shown side by side.
 *
 * The Next.js docs name this exact case — a root layout behind a top-level dynamic segment — as
 * the reason `global-not-found` exists.
 */
export default async function GlobalNotFound() {
  const [en, nl] = await Promise.all([getDictionary("en"), getDictionary("nl")]);

  return (
    <html lang="en" className={fontVariables}>
      <body className="bg-ink-950 font-sans text-ink-150">
        <main className="box-border flex min-h-svh flex-col items-center justify-center gap-8 px-5 py-12 text-center">
          <span className="font-display text-[12px] tracking-[0.42em] text-ink-450">{en.notFound.eyebrow}</span>

          <div className="flex flex-col gap-3" lang="en">
            <h1 className="m-0 font-serif text-[clamp(30px,5.5vw,48px)] leading-[1.1] font-light text-white">
              {en.notFound.headingBefore} <em className="text-ink-250 italic">{en.notFound.headingEmphasis}</em>
            </h1>
            <p className="m-0 max-w-[460px] text-[15px] text-ink-400">{en.notFound.body}</p>
          </div>

          <span aria-hidden="true" className="h-px w-16 bg-ink-800" />

          <div className="flex flex-col gap-3" lang="nl">
            <h2 className="m-0 font-serif text-[clamp(30px,5.5vw,48px)] leading-[1.1] font-light text-white">
              {nl.notFound.headingBefore} <em className="text-ink-250 italic">{nl.notFound.headingEmphasis}</em>
            </h2>
            <p className="m-0 max-w-[460px] text-[15px] text-ink-400">{nl.notFound.body}</p>
          </div>

          <div className="mt-2 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/en"
              hrefLang="en"
              className="btn-fill inline-flex min-h-[52px] items-center justify-center bg-ink-50 px-[30px] text-[12px] font-semibold tracking-[0.24em] text-ink-950 no-underline uppercase"
            >
              {en.notFound.cta}
            </Link>
            <Link
              href="/nl"
              hrefLang="nl"
              className="inline-flex min-h-[52px] items-center justify-center border border-ink-700 px-[30px] text-[12px] font-semibold tracking-[0.24em] text-white no-underline uppercase"
            >
              {nl.notFound.cta}
            </Link>
          </div>
        </main>
      </body>
    </html>
  );
}
