"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { btn } from "../../_components/ui";
import { deleteCorporateContact } from "./actions";

type Copy = Record<"delete" | "deleteTitle" | "deleteIntro" | "deleteGone" | "deleteKept" | "deleteBlocked" | "deleteConfirm" | "deleteCancel" | "deleteWorking", string>;

function Confirm({ copy }: { copy: Copy }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={`${btn.base} ${btn.danger} ${btn.md}`}>
      {pending ? copy.deleteWorking : copy.deleteConfirm}
    </button>
  );
}

/**
 * "Delete" on a partner account, with a confirmation that says what will happen to its bookings: which are deleted and
 * which stay (completed or invoiced ones are part of the financial records). The dialog is only mounted while open.
 */
export function DeleteContactButton({ id, name, gone, kept, upcoming, copy }: { id: string; name: string; gone: number; kept: number; upcoming: number; copy: Copy }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label={`${copy.delete}: ${name}`} className={`${btn.base} ${btn.ghost} ${btn.sm} text-red-700 hover:text-red-800`}>
        {copy.delete}
      </button>
      {open && <ConfirmDialog id={id} name={name} gone={gone} kept={kept} upcoming={upcoming} copy={copy} onClose={() => setOpen(false)} />}
    </>
  );
}

function ConfirmDialog({ id, name, gone, kept, upcoming, copy, onClose }: { id: string; name: string; gone: number; kept: number; upcoming: number; copy: Copy; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const el = dialog.current;
    if (el && !el.open) el.showModal();
  }, []);
  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) dialog.current?.close();
      }}
      className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-xl border border-zinc-200 bg-white p-0 text-zinc-900 shadow-xl backdrop:bg-zinc-950/40"
    >
      <form action={async (formData) => { await deleteCorporateContact(formData); dialog.current?.close(); }} className="flex flex-col gap-4 p-6">
        <input type="hidden" name="id" value={id} />
        <h2 id={titleId} tabIndex={-1} autoFocus className="m-0 text-lg font-semibold outline-none">
          {copy.deleteTitle}
        </h2>
        <p className="m-0 text-sm text-zinc-600">{copy.deleteIntro.replace("{name}", name)}</p>
        <ul className="m-0 flex list-disc flex-col gap-1.5 pl-5 text-sm text-zinc-700">
          <li>{copy.deleteGone.replace("{count}", String(gone))}</li>
          <li>{copy.deleteKept.replace("{count}", String(kept))}</li>
        </ul>
        {upcoming > 0 && (
          <p role="alert" className="m-0 rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-900 ring-1 ring-inset ring-amber-200">
            {copy.deleteBlocked.replace("{count}", String(upcoming))}
          </p>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={() => dialog.current?.close()} className={`${btn.base} ${btn.secondary} ${btn.md}`}>
            {copy.deleteCancel}
          </button>
          {/* Nothing to confirm while an upcoming booking holds the account: the server refuses it as well */}
          {upcoming === 0 && <Confirm copy={copy} />}
        </div>
      </form>
    </dialog>
  );
}
