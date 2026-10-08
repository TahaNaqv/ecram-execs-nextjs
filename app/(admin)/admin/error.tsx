"use client";

import { useEffect } from "react";

export default function AdminError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      <p className="text-sm text-zinc-600">
        The admin panel couldn&apos;t load this page. This is often a temporary database connection issue.
        {error.digest && <span className="mt-2 block font-mono text-xs text-zinc-400">Ref: {error.digest}</span>}
      </p>
      <div className="flex gap-3">
        <button onClick={() => retry()} className="rounded bg-zinc-950 px-4 py-2 text-sm text-white hover:bg-zinc-800">
          Try again
        </button>
        <a href="/admin" className="rounded border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-100">
          All requests
        </a>
      </div>
    </main>
  );
}
