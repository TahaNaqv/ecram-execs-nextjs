"use client";

import { useState } from "react";
import { toFriendly } from "@/lib/admin/template-tags";
import { ChevronDownIcon } from "../../_components/icons";
import { TemplateForm, type TemplateCopy } from "./template-form";

type Row = { key: string; subject: string; body: string; title: string };

/** One row per template; clicking a row opens its editor below it. One editor open at a time. */
export function TemplateList({ rows, copy }: { rows: Row[]; copy: TemplateCopy }) {
  const [open, setOpen] = useState<string | null>(null);
  const labels = {
    reference: copy.tagReference,
    name: copy.tagName,
    amount: copy.tagAmount,
    introducerName: copy.tagIntroducer,
    monthYear: copy.tagMonth,
    commission: copy.tagCommission,
    netTotal: copy.tagNet,
  };

  return (
    <ul className="m-0 list-none divide-y divide-zinc-100 p-0">
      {rows.map((row) => {
        const expanded = open === row.key;
        const panelId = `template-${row.key}`;
        return (
          <li key={row.key}>
            <button
              type="button"
              aria-expanded={expanded}
              aria-controls={panelId}
              onClick={() => setOpen(expanded ? null : row.key)}
              className={`flex w-full cursor-pointer items-center gap-4 px-5 py-3.5 text-left transition-colors hover:bg-zinc-50 ${expanded ? "bg-zinc-50/70" : ""}`}
            >
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-zinc-950">{row.title}</span>
                <span className="mt-0.5 block truncate text-[13px] text-zinc-500">{toFriendly(row.subject, labels)}</span>
              </span>
              <ChevronDownIcon size={18} className={`shrink-0 text-zinc-400 transition-transform ${expanded ? "rotate-180 text-zinc-700" : ""}`} />
            </button>
            {/* Kept mounted while closed so unsaved edits survive opening another template. */}
            <div id={panelId} hidden={!expanded} className="border-t border-zinc-100 bg-white px-5 py-4">
              <TemplateForm row={row} copy={copy} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
