"use client";

import { useEffect } from "react";

export default function SiteError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-ink-950 px-5 py-12 text-center font-sans text-ink-150">
      <h1 className="m-0 font-serif text-[clamp(32px,6vw,52px)] font-light text-white">Something went wrong.</h1>
      <p className="m-0 max-w-[460px] text-ink-400">
        Please try again. If it keeps happening, contact us directly and we will gladly arrange your journey.
      </p>
      <button
        onClick={() => retry()}
        className="btn-fill min-h-[52px] cursor-pointer border-none bg-ink-50 px-[34px] text-[12px] font-semibold tracking-[0.24em] text-ink-950 uppercase"
      >
        Try again
      </button>
    </main>
  );
}
