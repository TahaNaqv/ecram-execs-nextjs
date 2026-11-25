"use client";

import { useState } from "react";
import { btn } from "../../../_components/ui";
import { archivePartner } from "./ops-actions";

/** Asks before a partner is archived. The record stays; it only leaves the active list. */
export function ArchivePartner({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="px-5 py-4">
      <button type="button" onClick={() => setOpen(true)} className={`${btn.base} ${btn.danger} ${btn.md}`}>Archive partner</button>
      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-zinc-950/40 p-4" role="presentation" onClick={() => setOpen(false)}>
          <form action={archivePartner} role="dialog" aria-modal="true" aria-labelledby="archive-partner-title" className="grid w-full max-w-md gap-3 rounded-xl bg-white p-5 shadow-card" onClick={(event) => event.stopPropagation()}>
            <h2 id="archive-partner-title" className="m-0 text-base font-semibold text-zinc-950">Archive this partner?</h2>
            <p className="m-0 text-sm text-zinc-600">The record is kept, and the partner leaves the active list. You can restore them later.</p>
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="confirm" value="archive" />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className={`${btn.base} ${btn.ghost} ${btn.md}`}>Cancel</button>
              <button className={`${btn.base} ${btn.danger} ${btn.md}`}>Archive partner</button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
