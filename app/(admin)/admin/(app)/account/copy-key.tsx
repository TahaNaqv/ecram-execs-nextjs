"use client";

import { useState } from "react";
import { btn } from "../../_components/ui";

export function CopyKey({ secret }: { secret: string }) {
  const [copied, setCopied] = useState(false);
  const groups = secret.match(/.{1,4}/g)?.join(" ") ?? secret;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <code className="font-mono text-sm tracking-wide text-zinc-950">{groups}</code>
      <button
        type="button"
        className={`${btn.base} ${btn.ghost} ${btn.sm}`}
        onClick={() => {
          void navigator.clipboard?.writeText(secret).then(
            () => {
              setCopied(true);
              window.setTimeout(() => setCopied(false), 2000);
            },
            () => setCopied(false),
          );
        }}
      >
        {copied ? "Copied" : "Copy key"}
      </button>
    </div>
  );
}
