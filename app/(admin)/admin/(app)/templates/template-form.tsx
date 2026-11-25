"use client";

import { useRef, useState } from "react";
import { useActionState } from "react";
import { toFriendly, type TemplateToken } from "@/lib/admin/template-tags";
import { btn, field, fieldLabel } from "../../_components/ui";
import { saveEmailTemplate, type TemplateState } from "./actions";

type Copy = {
  subject: string;
  body: string;
  save: string;
  saved: string;
  tagsHint: string;
  tagReference: string;
  tagName: string;
  tagAmount: string;
  tagIntroducer: string;
  tagMonth: string;
  tagCommission: string;
  tagNet: string;
};

const TOKENS: { token: TemplateToken; labelKey: keyof Pick<Copy, "tagReference" | "tagName" | "tagAmount" | "tagIntroducer" | "tagMonth" | "tagCommission" | "tagNet"> }[] = [
  { token: "reference", labelKey: "tagReference" },
  { token: "name", labelKey: "tagName" },
  { token: "amount", labelKey: "tagAmount" },
  { token: "introducerName", labelKey: "tagIntroducer" },
  { token: "monthYear", labelKey: "tagMonth" },
  { token: "commission", labelKey: "tagCommission" },
  { token: "netTotal", labelKey: "tagNet" },
];

export function TemplateForm({
  row,
  title,
  copy,
}: {
  row: { key: string; subject: string; body: string };
  title: string;
  copy: Copy;
}) {
  const labels = {
    reference: copy.tagReference,
    name: copy.tagName,
    amount: copy.tagAmount,
    introducerName: copy.tagIntroducer,
    monthYear: copy.tagMonth,
    commission: copy.tagCommission,
    netTotal: copy.tagNet,
  };
  const [subject, setSubject] = useState(() => toFriendly(row.subject, labels));
  const [body, setBody] = useState(() => toFriendly(row.body, labels));
  const [focus, setFocus] = useState<"subject" | "body">("subject");
  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const [state, action, pending] = useActionState<TemplateState, FormData>(saveEmailTemplate, {});

  function insert(label: string) {
    const token = `[${label}]`;
    const el = focus === "body" ? bodyRef.current : subjectRef.current;
    const current = focus === "body" ? body : subject;
    const start = el?.selectionStart ?? current.length;
    const end = el?.selectionEnd ?? start;
    const next = `${current.slice(0, start)}${token}${current.slice(end)}`;
    if (focus === "body") setBody(next);
    else setSubject(next);
    const pos = start + token.length;
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(pos, pos);
    });
  }

  return (
    <form action={action} className="flex flex-col gap-3">
      <h2 className="m-0 text-base font-semibold text-zinc-950">{title}</h2>
      <input type="hidden" name="key" value={row.key} />
      <div className="flex flex-col gap-2">
        <p className="m-0 text-[13px] text-zinc-500">{copy.tagsHint}</p>
        <div className="flex flex-wrap gap-2">
          {TOKENS.map((tag) => (
            <button
              key={tag.token}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => insert(copy[tag.labelKey])}
              className="cursor-pointer rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-[13px] font-medium text-zinc-800 hover:border-zinc-300 hover:bg-white"
            >
              [{copy[tag.labelKey]}]
            </button>
          ))}
        </div>
      </div>
      <label className="flex flex-col gap-1.5">
        <span className={fieldLabel}>{copy.subject}</span>
        <input
          ref={subjectRef}
          name="subject"
          required
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          onFocus={() => setFocus("subject")}
          className={`${field} h-10`}
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className={fieldLabel}>{copy.body}</span>
        <textarea
          ref={bodyRef}
          name="body"
          required
          rows={4}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          onFocus={() => setFocus("body")}
          className={`${field} resize-y py-2.5 leading-relaxed`}
        />
      </label>
      {state.ok && <p className="m-0 text-sm text-emerald-700">{copy.saved}</p>}
      <button disabled={pending} className={`${btn.base} ${btn.primary} ${btn.md} self-start`}>{copy.save}</button>
    </form>
  );
}
