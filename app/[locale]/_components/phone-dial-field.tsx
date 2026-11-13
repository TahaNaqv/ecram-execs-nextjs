"use client";

import { useEffect, useRef, useState } from "react";
import { COUNTRY_CODES } from "@/lib/quotes/constants";
import { cleanPhoneInput, PASTE_MAX } from "@/lib/phone";

/** A stored `+31 612345678` splits into the dial code and the national number. Anything else is treated as a Dutch number. */
export function splitStoredPhone(stored: string | null | undefined): { country: string; number: string } {
  const match = stored?.trim().match(/^\+(\d{1,4})\s+(.+)$/);
  if (!match) return { country: "31", number: (stored ?? "").replace(/\D/g, "") };
  return { country: match[1], number: match[2].replace(/\D/g, "") };
}

/**
 * Country-code menu plus a digits-only number, the same control as the booking details step.
 * The code is submitted without the plus (`31`); the number is national digits only.
 */
export function PhoneDialField({
  id,
  name = "phone",
  countryName = "phoneCountry",
  countryLabel,
  placeholder,
  defaultCountry = "31",
  defaultNumber = "",
  required = false,
  invalid = false,
  describedBy,
}: {
  id: string;
  name?: string;
  countryName?: string;
  countryLabel: string;
  placeholder: string;
  defaultCountry?: string;
  defaultNumber?: string;
  required?: boolean;
  invalid?: boolean;
  describedBy?: string;
}) {
  const [country, setCountry] = useState(defaultCountry.replace(/^\+/, "") || "31");
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
    <div ref={root} className="relative flex min-w-0 items-center gap-2.5">
      <input type="hidden" name={countryName} value={country} />
      <button
        type="button"
        aria-label={countryLabel}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((value) => !value)}
        className="flex shrink-0 cursor-pointer items-center gap-1 border-0 border-r border-solid border-ink-225 bg-transparent p-0 pr-2 text-[16px] font-medium text-ink-950"
      >
        {current[1]} +{current[0]}
      </button>
      {open && (
        <ul
          role="listbox"
          aria-label={countryLabel}
          className="absolute top-full left-0 z-50 m-0 mt-2 max-h-60 w-[min(11rem,calc(100vw-2.5rem))] list-none overflow-y-auto rounded-xl border border-solid border-[#d5d8e6] bg-[#ffffff] p-1 text-[#10224f] shadow-2xl [color-scheme:light] [scrollbar-width:thin] [scrollbar-color:#d4d4d8_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-300 hover:[&::-webkit-scrollbar-thumb]:bg-zinc-400"
        >
          {COUNTRY_CODES.map(([code, iso]) => (
            <li key={code} role="option" aria-selected={code === country}>
              <button
                type="button"
                onClick={() => {
                  setCountry(code);
                  const typed = document.getElementById(id);
                  if (typed instanceof HTMLInputElement) typed.value = cleanPhoneInput(typed.value, code);
                  setOpen(false);
                }}
                className={`flex w-full cursor-pointer items-center rounded-lg border-0 px-3 py-2 text-left text-[14px] text-[#10224f] ${code === country ? "bg-[#e7edff] font-semibold" : "bg-transparent hover:bg-[#f2f5ff]"}`}
              >
                {iso} +{code}
              </button>
            </li>
          ))}
        </ul>
      )}
      <input
        id={id}
        name={name}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="tel-national"
        required={required}
        maxLength={PASTE_MAX}
        defaultValue={defaultNumber}
        placeholder={placeholder}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onInput={(event) => {
          event.currentTarget.value = cleanPhoneInput(event.currentTarget.value, country);
        }}
        className="min-w-0 flex-1 border-0 bg-transparent p-0 font-sans text-[16px] font-medium text-ink-950 outline-none placeholder:font-normal placeholder:text-ink-475"
      />
    </div>
  );
}
