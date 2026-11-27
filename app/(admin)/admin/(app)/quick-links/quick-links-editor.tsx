"use client";

import { useRef, useState, type FormEvent, type MouseEvent } from "react";
import type { QuickLink } from "@/lib/admin/quick-links";
import { ActionForm } from "../../_components/action-feedback";
import { ChevronDownIcon, PlusIcon, TrashIcon } from "../../_components/icons";
import { btn, field } from "../../_components/ui";
import { saveQuickLinks } from "./actions";

type Row = QuickLink & { key: number };

const snapshot = (links: QuickLink[]) => JSON.stringify(links.map(({ label, href }) => ({ label, href })));

export function QuickLinksEditor({ links }: { links: QuickLink[] }) {
  const nextKey = useRef(1);
  const takeKey = () => nextKey.current++;
  const [rows, setRows] = useState<Row[]>(() => links.map((link) => ({ ...link, key: takeKey() })));
  const [synced, setSynced] = useState(() => snapshot(links));
  const incoming = snapshot(links);
  // Only a new saved list replaces the draft. A refresh of the same links must not wipe an unsaved row.
  if (synced !== incoming) {
    setSynced(incoming);
    setRows(links.map((link) => ({ ...link, key: takeKey() })));
  }

  const update = (key: number, change: Partial<QuickLink>) => setRows((all) => all.map((row) => (row.key === key ? { ...row, ...change } : row)));
  const keepDraft = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };
  const move = (event: MouseEvent<HTMLButtonElement>, index: number, by: number) => {
    keepDraft(event);
    setRows((all) => {
      const next = index + by;
      if (next < 0 || next >= all.length) return all;
      const copy = [...all];
      const [row] = copy.splice(index, 1);
      if (!row) return all;
      copy.splice(next, 0, row);
      return copy;
    });
  };
  const add = (event: MouseEvent<HTMLButtonElement>) => {
    keepDraft(event);
    setRows((all) => [...all, { label: "", href: "", key: takeKey() }]);
  };
  const remove = (event: MouseEvent<HTMLButtonElement>, key: number) => {
    keepDraft(event);
    setRows((all) => all.filter((item) => item.key !== key));
  };

  // Add, reorder and delete stay in this draft. Only the Save button may submit.
  const submitSaved = (event: FormEvent<HTMLFormElement>) => {
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    if (submitter instanceof HTMLButtonElement && submitter.dataset.save !== "links") {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  return (
    <ActionForm action={saveQuickLinks} success="Quick links saved!" className="flex flex-col gap-3 px-5 py-4" onSubmit={submitSaved}>
      <input type="hidden" name="links" value={JSON.stringify(rows.map(({ label, href }) => ({ label, href })))} />
      {rows.map((row, i) => (
        <div key={row.key} className="grid items-center gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto]">
          <input aria-label="Name" placeholder="Name" maxLength={60} value={row.label} onChange={(event) => update(row.key, { label: event.target.value })} className={`${field} h-9`} />
          <input aria-label="Web address" placeholder="https://…" value={row.href} onChange={(event) => update(row.key, { href: event.target.value })} className={`${field} h-9`} />
          <div className="flex gap-1">
            <button type="button" aria-label="Move up" disabled={i === 0} onClick={(event) => move(event, i, -1)} className={`${btn.base} ${btn.ghost} ${btn.sm}`}>
              <ChevronDownIcon size={14} className="rotate-180" />
            </button>
            <button type="button" aria-label="Move down" disabled={i === rows.length - 1} onClick={(event) => move(event, i, 1)} className={`${btn.base} ${btn.ghost} ${btn.sm}`}>
              <ChevronDownIcon size={14} />
            </button>
            <button type="button" aria-label={`Remove ${row.label || "link"}`} onClick={(event) => remove(event, row.key)} className={`${btn.base} ${btn.ghost} ${btn.sm} text-red-700`}>
              <TrashIcon size={14} />
            </button>
          </div>
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={add} className={`${btn.base} ${btn.secondary} ${btn.md}`}>
          <PlusIcon size={14} /> Add a link
        </button>
        <button type="submit" data-save="links" className={`${btn.base} ${btn.primary} ${btn.md}`}>Save links</button>
      </div>
    </ActionForm>
  );
}
