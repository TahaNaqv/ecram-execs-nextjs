"use client";

import { useRef, useState } from "react";
import { prepareInvoiceUpload, recordInvoice } from "./portal-actions";
import { btn } from "../../../_components/ui";

const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Picks a PDF and sends it straight to the document store on a one-time link from the server (the same way driver
 * documents are uploaded), then asks the server to record it. The store checks the type, the size and the bytes again.
 */
export function InvoiceUpload({ requestId, copy }: { requestId: string; copy: { upload: string; uploading: string; notPdf: string; failed: string } }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  async function onPick(file: File | undefined) {
    if (!file) return;
    setError(undefined);
    if (file.type !== "application/pdf" || file.size > MAX_BYTES || file.size === 0) {
      setError(copy.notPdf);
      if (input.current) input.current.value = "";
      return;
    }
    setBusy(true);
    try {
      const prepared = await prepareInvoiceUpload(requestId);
      if (!prepared.ok) throw new Error(prepared.error);
      const put = await fetch(prepared.url, { method: "PUT", headers: { "content-type": "application/pdf", "x-upsert": "false" }, body: file });
      if (!put.ok) throw new Error(copy.failed);
      const recorded = await recordInvoice(requestId, prepared.path, file.name);
      if (!recorded.ok) throw new Error(recorded.error ?? copy.failed);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : copy.failed);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <input ref={input} type="file" accept="application/pdf" hidden onChange={(e) => void onPick(e.target.files?.[0])} />
      <button type="button" disabled={busy} onClick={() => input.current?.click()} className={`${btn.base} ${btn.secondary} ${btn.md} self-start`}>
        {busy ? copy.uploading : copy.upload}
      </button>
      {error && (
        <p role="alert" className="m-0 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
