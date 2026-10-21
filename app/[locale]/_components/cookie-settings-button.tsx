"use client";

import { OPEN_SETTINGS_EVENT } from "@/lib/consent";

/** "Cookie settings": reopens the preferences dialog at any time, so withdrawing consent is as easy as giving it. */
export function CookieSettingsButton({ label, className }: { label: string; className?: string }) {
  return (
    <button type="button" onClick={() => window.dispatchEvent(new Event(OPEN_SETTINGS_EVENT))} className={className}>
      {label}
    </button>
  );
}
