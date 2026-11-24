"use client";

import { useActionState } from "react";
import { btn, field, fieldLabel } from "../../_components/ui";
import { saveEmailTemplate, type TemplateState } from "./actions";

export function TemplateForm({
  row,
  title,
  copy,
}: {
  row: { key: string; subject: string; body: string };
  title: string;
  copy: { subject: string; body: string; save: string; saved: string };
}) {
  const [state, action, pending] = useActionState<TemplateState, FormData>(saveEmailTemplate, {});
  return (
    <form action={action} className="flex flex-col gap-3">
      <h2 className="m-0 text-base font-semibold text-zinc-950">{title}</h2>
      <input type="hidden" name="key" value={row.key} />
      <label className="flex flex-col gap-1.5">
        <span className={fieldLabel}>{copy.subject}</span>
        <input name="subject" required defaultValue={row.subject} className={`${field} h-10`} />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className={fieldLabel}>{copy.body}</span>
        <textarea name="body" required rows={4} defaultValue={row.body} className={`${field} resize-y py-2.5 leading-relaxed`} />
      </label>
      {state.ok && <p className="m-0 text-sm text-emerald-700">{copy.saved}</p>}
      <button disabled={pending} className={`${btn.base} ${btn.primary} ${btn.md} self-start`}>{copy.save}</button>
    </form>
  );
}
