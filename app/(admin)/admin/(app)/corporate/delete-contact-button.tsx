"use client";

import { useId, useState } from "react";
import { useFormStatus } from "react-dom";
import { btn } from "../../_components/ui";
import { deleteCorporateContact } from "./actions";

type Copy = Record<"delete" | "deleteTitle" | "deleteIntro" | "deleteGone" | "deleteKept" | "deleteBlocked" | "deleteConfirm" | "deleteCancel" | "deleteWorking", string>;

function Confirm({ copy }: { copy: Copy }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="cursor-pointer border-none bg-red-600 px-5 py-2.5 text-[12px] font-semibold tracking-[0.1em] text-white uppercase rounded-xl hover:bg-red-500 transition-colors disabled:opacity-50">
      {pending ? copy.deleteWorking : copy.deleteConfirm}
    </button>
  );
}

/**
 * "Delete" on a partner account, with a proper custom dark confirmation modal.
 */
export function DeleteContactButton({ id, name, gone, kept, upcoming, copy }: { id: string; name: string; gone: number; kept: number; upcoming: number; copy: Copy }) {
  const [open, setOpen] = useState(false);
  const titleId = useId();

  return (
    <>
      <button 
        type="button" 
        onClick={() => setOpen(true)} 
        aria-label={`${copy.delete}: ${name}`} 
        className={`${btn.base} ${btn.ghost} ${btn.sm} text-red-700 hover:text-red-800`}
      >
        {copy.delete}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/60 backdrop-blur-sm p-4">
          <div 
            role="dialog"
            aria-labelledby={titleId}
            className="w-full max-w-[440px] border border-ink-800 bg-ink-900 p-6 shadow-2xl flex flex-col gap-5 rounded-2xl text-white"
          >
            <form 
              action={async (formData) => { 
                await deleteCorporateContact(formData); 
                setOpen(false); 
              }} 
              className="flex flex-col gap-4"
            >
              <input type="hidden" name="id" value={id} />
              <h2 id={titleId} tabIndex={-1} autoFocus className="m-0 font-serif text-[22px] font-normal outline-none">
                {copy.deleteTitle}
              </h2>
              <p className="m-0 text-[14px] text-ink-400">{copy.deleteIntro.replace("{name}", name)}</p>
              <ul className="m-0 flex list-disc flex-col gap-1.5 pl-5 text-[13px] text-ink-300">
                <li>{copy.deleteGone.replace("{count}", String(gone))}</li>
                <li>{copy.deleteKept.replace("{count}", String(kept))}</li>
              </ul>
              {upcoming > 0 && (
                <p role="alert" className="m-0 rounded-xl bg-amber-500/10 px-3 py-2.5 text-[13px] text-amber-200 border border-amber-500/20">
                  {copy.deleteBlocked.replace("{count}", String(upcoming))}
                </p>
              )}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-ink-800">
                <button 
                  type="button" 
                  onClick={() => setOpen(false)} 
                  className="cursor-pointer border border-ink-700 bg-transparent px-4 py-2.5 text-[12px] tracking-[0.1em] text-ink-300 uppercase rounded-xl hover:bg-ink-800 hover:text-white transition-colors"
                >
                  {copy.deleteCancel}
                </button>
                {/* Nothing to confirm while an upcoming booking holds the account */}
                {upcoming === 0 && <Confirm copy={copy} />}
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}