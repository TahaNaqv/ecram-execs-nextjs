"use client";

import { useState } from "react";
import type { QuickLink } from "@/lib/admin/quick-links";
import { ActionForm } from "../../_components/action-feedback";
import { ChevronDownIcon, PlusIcon, TrashIcon } from "../../_components/icons";
import { btn, field } from "../../_components/ui";
import { saveQuickLinks } from "./actions";

type Row = QuickLink & { key: number };

let nextKey = 1;
const withKeys = (links: QuickLink[]): Row[] => links.map((link) => ({ ...link, key: nextKey++ }));

export function QuickLinksEditor({ links }: { links: QuickLink[] }) {
  const [rows, setRows] = useState<Row[]>(() => withKeys(links));
  const [from, setFrom] = useState(links);
  // A save (or another owner's) brings a new list from the server: start again from it
  if (from !== links) {
    setFrom(links);
    setRows(withKeys(links));
  }

  const update = (key: number, change: Partial<QuickLink>) => setRows((all) => all.map((row) => (row.key === key ? { ...row, ...change } : row)));
  const move = (index: number, by: number) =>
    setRows((all) => {
      const next = [...all];
      const [row] = next.splice(index, 1);
      next.splice(index + by, 0, row);
      return next;
    });

  return (
    <ActionForm action={saveQuickLinks} success="Quick links saved!" className="flex flex-col gap-3 px-5 py-4">
      {rows.map((row, i) => (
        <div key={row.key} className="grid items-center gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto]">
          <input name="label" aria-label="Name" placeholder="Name" maxLength={60} value={row.label} onChange={(event) => update(row.key, { label: event.target.value })} className={`${field} h-9`} />
          <input name="href" aria-label="Web address" placeholder="https://…" value={row.href} onChange={(event) => update(row.key, { href: event.target.value })} className={`${field} h-9`} />
          <div className="flex gap-1">
            <button type="button" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)} className={`${btn.base} ${btn.ghost} ${btn.sm}`}>
              <ChevronDownIcon size={14} className="rotate-180" />
            </button>
            <button type="button" aria-label="Move down" disabled={i === rows.length - 1} onClick={() => move(i, 1)} className={`${btn.base} ${btn.ghost} ${btn.sm}`}>
              <ChevronDownIcon size={14} />
            </button>
            <button type="button" aria-label={`Remove ${row.label || "link"}`} onClick={() => setRows((all) => all.filter((item) => item.key !== row.key))} className={`${btn.base} ${btn.ghost} ${btn.sm} text-red-700`}>
              <TrashIcon size={14} />
            </button>
          </div>
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setRows((all) => [...all, { label: "", href: "", key: nextKey++ }])} className={`${btn.base} ${btn.secondary} ${btn.md}`}>
          <PlusIcon size={14} /> Add a link
        </button>
        <button className={`${btn.base} ${btn.primary} ${btn.md}`}>Save links</button>
      </div>
    </ActionForm>
  );
}
