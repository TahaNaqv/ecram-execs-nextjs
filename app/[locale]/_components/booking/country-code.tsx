"use client";

import { useEffect, useRef, useState } from "react";
import { COUNTRY_CODES } from "@/lib/quotes/constants";

export function CountryCode({ name, label, country, onChange }: { name: string; label: string; country: string; onChange: (country: string) => void }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const current = COUNTRY_CODES.find(([code]) => code === country) ?? COUNTRY_CODES[0];

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={root} className="relative shrink-0">
      <input type="hidden" name={name} value={country} />
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((value) => !value)}
        className="phone-code flex h-full cursor-pointer items-center gap-1.5 border-0 border-r border-solid border-ink-225 bg-transparent py-0 pr-3 pl-0 text-[16px] font-medium text-ink-950"
      >
        <span className="whitespace-nowrap">{current[1]} +{current[0]}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className={open ? "rotate-180" : ""}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <ul role="listbox" aria-label={label} className="absolute top-full left-0 z-50 m-0 mt-2 max-h-60 w-[min(11rem,calc(100vw-2.5rem))] list-none overflow-y-auto rounded-xl border border-solid border-[#c5d4ff] bg-[#ffffff] p-1 text-[#10224f] shadow-lg [color-scheme:light] [scrollbar-width:thin] [scrollbar-color:#d4d4d8_transparent]">
          {COUNTRY_CODES.map(([code, iso]) => (
            <li key={code} role="option" aria-selected={code === country}>
              <button
                type="button"
                onClick={() => {
                  onChange(code);
                  setOpen(false);
                }}
                className={`flex w-full cursor-pointer items-center rounded-lg border-0 px-3 py-2 text-left text-[14px] text-[#10224f] ${code === country ? "bg-[#e8eeff] font-semibold" : "bg-[#ffffff] hover:bg-[#f4f7ff]"}`}
              >
                {iso} +{code}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
