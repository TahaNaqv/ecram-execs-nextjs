"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Locale } from "@/lib/i18n/config";

type Option = { locale: Locale; href: string; aria: string };

/** Flags are decorative: the accessible name comes from the link's `aria-label`. */
function Flag({ locale }: { locale: Locale }) {
  const common = {
    "aria-hidden": true,
    focusable: false,
    width: 28,
    height: 20,
    className: "block rounded-[2px]",
  } as const;

  if (locale === "nl") {
    return (
      <svg {...common} viewBox="0 0 9 6">
        <rect width="9" height="2" fill="#AE1C28" />
        <rect y="2" width="9" height="2" fill="#fff" />
        <rect y="4" width="9" height="2" fill="#21468B" />
      </svg>
    );
  }

  return (
    <svg {...common} viewBox="0 0 60 30" preserveAspectRatio="xMidYMid slice">
      <rect width="60" height="30" fill="#012169" />
      <path d="M0 0 60 30M60 0 0 30" stroke="#fff" strokeWidth="6" />
      <path d="M0 0 60 30M60 0 0 30" stroke="#C8102E" strokeWidth="2" />
      <path d="M30 0v30M0 15h60" stroke="#fff" strokeWidth="10" />
      <path d="M30 0v30M0 15h60" stroke="#C8102E" strokeWidth="6" />
    </svg>
  );
}

/**
 * Renders as plain links (one flag per language), so switching works with JavaScript disabled.
 * The only enhancement is carrying the current anchor across the switch (`/en#fleet` →
 * `/nl#fleet`); the hash is appended after hydration, so there is no markup mismatch.
 * The current language is the full-strength, ringed flag; the other is dimmed and is the link.
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
    <nav aria-label={label} className="flex items-center">
      {options.map((option) => (
        <span key={option.locale} className="flex items-center">
          {option.locale === current ? (
            <span aria-current="true" aria-label={option.aria} className="inline-flex h-11 w-9 items-center justify-center">
              <span className="rounded-[3px] outline outline-1 outline-offset-[3px] outline-white/80">
                <Flag locale={option.locale} />
              </span>
            </span>
          ) : (
            <Link
              className="inline-flex h-11 w-9 items-center justify-center opacity-60 transition-opacity hover:opacity-100 focus-visible:opacity-100 focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-[-4px] focus-visible:outline-white"
              href={`${option.href}${hash}`}
              hrefLang={option.locale}
              aria-label={option.aria}
            >
              <Flag locale={option.locale} />
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}
