"use client";

import { useEffect, useRef, useState } from "react";
import { btn } from "../../_components/ui";

type Link = { href: string; label: string };

/**
 * The two CSV download links. The browser does the download itself and is the only one that knows whether it worked, so
 * the page cannot say "downloaded"; it says the download started, and where to look for the file, for a few seconds.
 */
export function ExportButtons({ all, optedIn, notice }: { all: Link; optedIn: Link; notice: string }) {
  const [shown, setShown] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const started = () => {
    setShown(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setShown(false), 6000);
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex gap-2">
        {/* Plain links: these are file downloads from a Route Handler, not pages, so <Link> would try to navigate */}
        {[all, optedIn].map((l) => (
          <a key={l.href} href={l.href} download onClick={started} className={`${btn.base} ${btn.secondary} ${btn.sm}`}>
            {l.label}
          </a>
        ))}
      </div>
      <p role="status" className="m-0 min-h-4 text-xs text-emerald-700">
        {shown ? notice : ""}
      </p>
    </div>
  );
}
