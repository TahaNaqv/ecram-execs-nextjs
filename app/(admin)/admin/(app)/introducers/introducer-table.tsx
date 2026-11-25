"use client";

import Link from "next/link";
import { useState } from "react";
import { fillTemplate } from "@/lib/admin/template-tags";
import { btn, field } from "../../_components/ui";
import { deleteIntroducer, emailIntroducer, updateIntroducer } from "./actions";

export type IntroducerView = {
  id: string;
  name: string;
  email: string | null;
  commissionPercent: number;
  active: boolean;
  partners: { id: string; name: string }[];
  monthNet: string;
  monthCommission: string;
  monthCommissionCents: number;
  monthNetCents: number;
  monthYear: string;
  notified: string | null;
};

const compact = "inline-flex items-center justify-center rounded-md px-2.5 py-1 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50";

export function IntroducerTable({ rows, subjectTemplate, bodyTemplate }: { rows: IntroducerView[]; subjectTemplate: string; bodyTemplate: string }) {
  const [preview, setPreview] = useState<IntroducerView | null>(null);
  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[64rem] text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-100 text-[12px] tracking-wide text-zinc-500 uppercase">
              <th className="min-w-[22rem] px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Corporate partners</th>
              <th className="px-4 py-2 font-medium">This month</th>
              <th className="px-4 py-2 font-medium">Commission</th>
              <th className="px-4 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-zinc-100 align-bottom last:border-0">
                <td className="min-w-[22rem] px-4 py-3">
                  <form id={`introducer-${row.id}`} action={updateIntroducer} className="flex flex-col gap-4">
                    <input type="hidden" name="id" value={row.id} />
                    <input name="name" required defaultValue={row.name} aria-label="Name" className={`${field} h-10 w-full`} />
                    <input name="email" type="email" defaultValue={row.email ?? ""} aria-label="Email" placeholder="Email" className={`${field} h-10 w-full`} />
                    <div className="flex flex-wrap items-center gap-4">
                      <label className="flex items-center gap-2 text-xs text-zinc-700">
                        <input type="checkbox" name="active" defaultChecked={row.active} />
                        Active
                      </label>
                      <label className="flex items-center gap-2 text-xs text-zinc-700">
                        Percent
                        <input name="percent" type="number" min={0} max={100} defaultValue={row.commissionPercent} aria-label="Percent" className={`${field} h-10 w-20`} />
                      </label>
                      <button className={`${compact} border border-zinc-200 bg-white text-zinc-900`}>Save</button>
                    </div>
                  </form>
                </td>
                <td className="px-4 py-3">
                  {row.partners.length === 0 ? (
                    <span className="text-zinc-400">None yet</span>
                  ) : (
                    <ul className="m-0 flex list-none flex-wrap gap-1.5">
                      {row.partners.map((partner) => (
                        <li key={partner.id}>
                          <Link href={`/admin/corporate/${partner.id}`} className="inline-flex rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-950 no-underline hover:bg-zinc-200">{partner.name}</Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </td>
                <td className="px-4 py-3 tabular-nums">{row.monthNet}</td>
                <td className="px-4 py-3 tabular-nums">{row.monthCommission}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-4">
                    <form action={deleteIntroducer}>
                      <input type="hidden" name="id" value={row.id} />
                      <button className={`${compact} bg-red-50 text-red-700 ring-1 ring-inset ring-red-200`}>Remove</button>
                    </form>
                    <button type="button" disabled={!row.email} onClick={() => setPreview(row)} className={`${compact} border border-zinc-200 bg-white text-zinc-900`}>
                      Email invoice request
                    </button>
                  </div>
                  {row.notified ? <p className="m-0 mt-2 text-[11px] text-zinc-500">Sent {row.notified}</p> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {preview ? (
        <InvoicePreview
          row={preview}
          subject={fillTemplate(subjectTemplate, { amount: preview.monthCommission, name: preview.name, introducerName: preview.name, monthYear: preview.monthYear, commission: preview.monthCommission, netTotal: preview.monthNet })}
          body={fillTemplate(bodyTemplate, { amount: preview.monthCommission, name: preview.name, introducerName: preview.name, monthYear: preview.monthYear, commission: preview.monthCommission, netTotal: preview.monthNet })}
          onClose={() => setPreview(null)}
        />
      ) : null}
    </>
  );
}

function InvoicePreview({ row, subject, body, onClose }: { row: IntroducerView; subject: string; body: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-zinc-950/40 p-4" role="presentation" onClick={onClose}>
      <form
        action={emailIntroducer}
        role="dialog"
        aria-modal="true"
        aria-labelledby="invoice-request-title"
        className="grid w-full max-w-lg gap-3 rounded-xl bg-white p-5 shadow-card"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="invoice-request-title" className="m-0 text-base font-semibold text-zinc-950">Email invoice request</h2>
        <p className="m-0 text-sm text-zinc-600">To {row.email}. bookkeeper@ecramexecs.com is copied.</p>
        <input type="hidden" name="id" value={row.id} />
        <input type="hidden" name="cents" value={row.monthCommissionCents} />
        <input type="hidden" name="netCents" value={row.monthNetCents} />
        <label className="text-xs font-medium text-zinc-700">
          Subject
          <input name="subject" required defaultValue={subject} className={`${field} mt-1 h-10`} />
        </label>
        <label className="text-xs font-medium text-zinc-700">
          Message
          <textarea name="body" required rows={6} defaultValue={body} className={`${field} mt-1 py-2`} />
        </label>
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" onClick={onClose} className={`${compact} ${btn.ghost}`}>Cancel</button>
          <button className={`${compact} ${btn.primary}`}>Send invoice request</button>
        </div>
      </form>
    </div>
  );
}
