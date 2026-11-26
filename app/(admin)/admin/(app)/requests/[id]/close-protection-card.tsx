"use client";

import { useState, useTransition } from "react";
import { pushToast } from "../../../_components/action-feedback";
import { btn, field, fieldLabel } from "../../../_components/ui";
import { addCloseProtectionAction, cancelChargeAction } from "./charge-actions";

export type ChargeRow = {
  id: string;
  description: string;
  amount: string;
  billing: "balance" | "separate";
  status: "active" | "cancelled";
  accepted: boolean;
  invoiceNumber: string | null;
  invoiceState: string | null;
  invoiceUrl: string | null;
  paid: boolean;
  lastError: string | null;
};

/**
 * Close protection priced after it was arranged (the client, 27 Nov 2026): the team types the amount, and the booking's
 * timing decides how it is collected — more than 30 days before the ride, added to the balance and the booking's invoice;
 * otherwise invoiced on its own. Shown only to staff who can approve bookings.
 */
export function CloseProtectionCharges({
  requestId,
  charges,
  rideSoon,
  confirmed,
  moneybird,
}: {
  requestId: string;
  charges: ChargeRow[];
  rideSoon: boolean;
  /** The booking is confirmed or completed: a separate charge is invoiced now, not later */
  confirmed: boolean;
  moneybird: boolean;
}) {
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("Close protection");
  const [notify, setNotify] = useState(true);
  const [credit, setCredit] = useState<string | null>(null);
  const [credited, setCredited] = useState(false);
  const [pending, start] = useTransition();

  function add() {
    const data = new FormData();
    data.set("requestId", requestId);
    data.set("amount", amount);
    data.set("description", description);
    if (notify) data.set("notify", "on");
    start(async () => {
      const result = await addCloseProtectionAction(data);
      if ("error" in result) return pushToast(result.error, false);
      setAmount("");
      pushToast(result.billing === "balance" ? "Close protection added to the booking's total." : "Close protection added. It is invoiced separately.");
    });
  }

  function cancel(id: string) {
    const data = new FormData();
    data.set("chargeId", id);
    if (credit === id && credited) data.set("credited", "on");
    start(async () => {
      const result = await cancelChargeAction(data);
      if ("error" in result) {
        if (result.needsCredit) setCredit(id);
        return pushToast(result.error, false);
      }
      setCredit(null);
      setCredited(false);
      pushToast("Close protection cancelled.");
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {charges.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {charges.map((charge) => (
            <li key={charge.id} className={`rounded-lg border px-3 py-2.5 text-sm ${charge.status === "cancelled" ? "border-zinc-100 text-zinc-400 line-through" : "border-zinc-200 text-zinc-800"}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">
                  {charge.description} · {charge.amount}
                </span>
                {charge.status === "active" && (
                  <button type="button" disabled={pending} onClick={() => cancel(charge.id)} className={`${btn.base} ${btn.ghost} ${btn.sm} text-red-700`}>
                    Cancel
                  </button>
                )}
              </div>
              {charge.status === "active" && (
                <p className="m-0 mt-1 text-xs text-zinc-500 no-underline">
                  {charge.billing === "balance"
                    ? `In the booking's total, collected with the balance${charge.accepted ? "; the customer agreed to the card charge" : ""}. If the booking's invoice was already sent, use Reissue on the Moneybird card so it includes this.`
                    : charge.paid
                      ? `Invoiced separately${charge.invoiceNumber ? ` (${charge.invoiceNumber})` : ""}, paid.`
                      : charge.invoiceNumber
                        ? `Invoiced separately (${charge.invoiceNumber}, ${charge.invoiceState ?? "open"}).`
                        : charge.lastError
                          ? `Its invoice could not be made yet (${charge.lastError}); it is tried again every 10 minutes.`
                          : !confirmed
                            ? "Invoiced separately once the booking is confirmed."
                            : moneybird
                              ? "Its own invoice is being made in Moneybird (within 10 minutes)."
                              : "Moneybird is not connected: invoice this separately by hand."}
                  {charge.invoiceUrl ? (
                    <>
                      {" "}
                      <a href={charge.invoiceUrl} target="_blank" rel="noopener noreferrer" className="underline">
                        Open invoice
                      </a>
                    </>
                  ) : null}
                </p>
              )}
              {credit === charge.id && (
                <label className="mt-2 flex items-center gap-2 text-xs text-zinc-700 no-underline">
                  <input type="checkbox" checked={credited} onChange={(event) => setCredited(event.target.checked)} />
                  I have credited its invoice in Moneybird
                </label>
              )}
            </li>
          ))}
        </ul>
      )}
      <div className="grid gap-2">
        <label className="flex min-w-0 flex-col gap-1">
          <span className={fieldLabel}>Description</span>
          <input value={description} maxLength={120} onChange={(event) => setDescription(event.target.value)} className={`${field} h-9`} />
        </label>
        <label className="flex min-w-0 flex-col gap-1">
          <span className={fieldLabel}>Amount (€, incl. VAT)</span>
          <input value={amount} inputMode="decimal" placeholder="450.00" onChange={(event) => setAmount(event.target.value)} className={`${field} h-9 max-w-40`} />
        </label>
      </div>
      <p className="m-0 text-xs text-zinc-500">
        {rideSoon
          ? "The ride is 30 days away or less: this is invoiced separately (its own Moneybird invoice, 21% VAT)."
          : "More than 30 days before the ride: added to the booking's total and collected with the balance, unless the booking is already paid in full (then it is invoiced separately). 21% VAT."}
      </p>
      <label className="flex items-center gap-2 text-sm text-zinc-800">
        <input type="checkbox" checked={notify} onChange={(event) => setNotify(event.target.checked)} />
        Email the customer about it
      </label>
      <button type="button" disabled={pending || !amount.trim()} onClick={add} className={`${btn.base} ${btn.secondary} ${btn.sm} self-start`}>
        Add close protection
      </button>
    </div>
  );
}
