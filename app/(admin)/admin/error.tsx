"use client";

import Link from "next/link";
import { useEffect } from "react";
import { AlertIcon, RefreshIcon } from "./_components/icons";
import { btn } from "./_components/ui";

/**
 * An error boundary is a Client Component and cannot read `admin_users.locale` — and the failure
 * may be whatever would have told us it. Both languages are shown, as in `global-not-found` (T9).
 */
const COPY = {
  heading: "Something went wrong · Er is iets misgegaan",
  body:
    "The admin panel couldn't load this page. This is often a temporary database connection issue. · Het beheerpaneel kon deze pagina niet laden. Vaak is dit een tijdelijk probleem met de databaseverbinding.",
  retry: "Try again · Opnieuw",
  back: "All requests · Alle aanvragen",
};

export default function AdminError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-dvh items-center justify-center px-6">
      <div className="w-full max-w-md rounded-xl border border-zinc-200/80 bg-white p-8 text-center shadow-card">
        <span className="mx-auto grid size-11 place-items-center rounded-full bg-red-50 text-red-600 ring-8 ring-red-50/50">
          <AlertIcon size={18} />
        </span>
        <h1 className="mt-5 text-lg font-semibold text-zinc-950">{COPY.heading}</h1>
        <p className="mt-1.5 text-sm text-zinc-500">
          {COPY.body}
        </p>
        {error.digest && <p className="mt-3 font-mono text-xs text-zinc-400">Ref: {error.digest}</p>}
        <div className="mt-6 flex justify-center gap-2">
          <button onClick={() => retry()} className={`${btn.base} ${btn.primary} ${btn.md}`}>
            <RefreshIcon /> {COPY.retry}
          </button>
          <Link href="/admin/requests" className={`${btn.base} ${btn.secondary} ${btn.md}`}>
            {COPY.back}
          </Link>
        </div>
      </div>
    </main>
  );
}
