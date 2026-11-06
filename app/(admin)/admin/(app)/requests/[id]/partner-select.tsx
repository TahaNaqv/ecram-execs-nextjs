"use client";

import { useEffect, useRef, useState } from "react";
import { btn, fieldLabel } from "../../../_components/ui";

type PartnerOption = { id: string; name: string; companyName: string | null; email: string };

/** Dark list for "Choose a partner". The chosen id is posted as contactId with the attach action. */
export function PartnerSelect({
  partners,
  requestId,
  action,
  label,
  choose,
  attach,
}: {
  partners: PartnerOption[];
  requestId: string;
  action: (formData: FormData) => void | Promise<void>;
  label: string;
  choose: string;
  attach: string;
}) {
  const [id, setId] = useState("");
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const chosen = partners.find((partner) => partner.id === id);

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

  const caption = (partner: PartnerOption) =>
    `${partner.name}${partner.companyName ? ` — ${partner.companyName}` : ""} (${partner.email})`;

  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="requestId" value={requestId} />
      <input type="hidden" name="contactId" value={id} />
      <span className={fieldLabel}>{label}</span>
      <div ref={root} className="relative">
        <button
          type="button"
          id="attach-partner"
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
          className="flex h-9 w-full cursor-pointer items-center justify-between gap-3 rounded-md border border-gray-200 bg-white px-2.5 text-left text-[13px] font-medium text-gray-900 transition duration-200 hover:bg-gray-50"
        >
          <span className="min-w-0 truncate">{chosen ? caption(chosen) : choose}</span>
          <span aria-hidden="true" className={`shrink-0 text-[10px] text-slate-600 transition-transform duration-200 ${open ? "rotate-180" : ""}`}>
            ▾
          </span>
        </button>
        <ul
          role="listbox"
          aria-label={label}
          className={`absolute z-30 mt-1 max-h-52 w-full origin-top overflow-y-auto rounded-lg border border-gray-100 bg-white py-0.5 shadow-lg transition duration-200 ${
            open ? "visible scale-y-100 opacity-100" : "pointer-events-none invisible scale-y-95 opacity-0"
          }`}
        >
          {partners.map((partner) => {
            const selected = partner.id === id;
            return (
              <li key={partner.id} role="option" aria-selected={selected}>
                <button
                  type="button"
                  onClick={() => {
                    setId(partner.id);
                    setOpen(false);
                  }}
                  className={`w-full cursor-pointer px-2.5 py-1.5 text-left text-[13px] font-medium text-gray-900 transition-colors duration-150 hover:bg-gray-100 ${
                    selected ? "bg-gray-100" : ""
                  }`}
                >
                  {caption(partner)}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      <button type="submit" className={`${btn.base} ${btn.secondary} ${btn.md} self-start`}>
        {attach}
      </button>
    </form>
  );
}
