"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Locale } from "@/lib/i18n/config";

type Option = { locale: Locale; href: string; label: string; aria: string };

/**
 * Renders as two plain links, so switching language works with JavaScript disabled.
 * The only enhancement is carrying the current anchor across the switch (`/en#fleet` →
 * `/nl#fleet`); the hash is appended after hydration, so there is no markup mismatch.
 */
export function LanguageSwitcherLinks({
  label,
  current,
  options,
}: {
  label: string;
  current: Locale;
  options: Option[];
}) {
  const [hash, setHash] = useState("");

  useEffect(() => {
    const sync = () => setHash(window.location.hash);
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  return (
    <nav aria-label={label} className="text-ink-450 flex items-center gap-[6px] text-[12px] tracking-[0.2em]">
      {options.map((option, i) => (
        <span key={option.locale} className="flex items-center gap-[6px]">
          {i > 0 && <span className="text-ink-700" aria-hidden="true">|</span>}
          {option.locale === current ? (
            <span aria-current="true" className="text-white">
              {option.label}
            </span>
          ) : (
            <Link className="navlink" href={`${option.href}${hash}`} hrefLang={option.locale} aria-label={option.aria}>
              {option.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}
