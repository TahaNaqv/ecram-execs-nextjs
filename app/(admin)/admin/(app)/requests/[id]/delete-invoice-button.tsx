"use client";

import { btn } from "../../../_components/ui";
import { deleteInvoice } from "./portal-actions";

/** Deleting an invoice takes the file away from the partner for good, so it asks first. */
export function DeleteInvoiceButton({ invoiceId, label, confirm }: { invoiceId: string; label: string; confirm: string }) {
  return (
    <form
      action={deleteInvoice}
      onSubmit={(e) => {
        if (!window.confirm(confirm)) e.preventDefault();
      }}
    >
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <button className={`${btn.base} ${btn.ghost} ${btn.sm}`}>{label}</button>
    </form>
  );
}
