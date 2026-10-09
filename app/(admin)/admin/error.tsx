"use client";

import { useEffect } from "react";
import { AlertIcon, RefreshIcon } from "./_components/icons";
import { btn } from "./_components/ui";

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
        <h1 className="mt-5 text-lg font-semibold text-zinc-950">Something went wrong</h1>
        <p className="mt-1.5 text-sm text-zinc-500">
          The admin panel couldn&apos;t load this page. This is often a temporary database connection issue.
        </p>
        {error.digest && <p className="mt-3 font-mono text-xs text-zinc-400">Ref: {error.digest}</p>}
        <div className="mt-6 flex justify-center gap-2">
          <button onClick={() => retry()} className={`${btn.base} ${btn.primary} ${btn.md}`}>
            <RefreshIcon /> Try again
          </button>
          <a href="/admin" className={`${btn.base} ${btn.secondary} ${btn.md}`}>
            All requests
          </a>
        </div>
      </div>
    </main>
  );
}
