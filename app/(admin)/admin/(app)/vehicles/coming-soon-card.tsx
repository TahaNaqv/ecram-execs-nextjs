"use client";

import { useState } from "react";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { ActionForm } from "../../_components/action-feedback";
import { btn, field } from "../../_components/ui";
import { saveComingSoon } from "./coming-soon-actions";

type Copy = Dictionary["admin"]["vehicles"];
type Model = { key: string; name: string; expected: string | null };

/**
 * The booking form's models, each bookable or "coming soon" with when it is expected (the client, 27 Nov 2026). A model
 * coming soon is shown greyed out on the booking form and the fleet page, and cannot be booked there or in the chat.
 */
export function ComingSoonCard({ models, max, copy }: { models: Model[]; max: number; copy: Copy }) {
  const [soon, setSoon] = useState<Record<string, boolean>>(() => Object.fromEntries(models.map((model) => [model.key, Boolean(model.expected)])));
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <h2 className="m-0 text-sm font-semibold text-zinc-950">{copy.soonTitle}</h2>
      <p className="m-0 mt-1 text-xs text-zinc-500">{copy.soonDescription}</p>
      <ActionForm action={saveComingSoon} success={copy.soonSaved} className="mt-4 flex flex-col gap-3">
        <ul className="m-0 grid list-none gap-2 p-0 md:grid-cols-2">
          {models.map((model) => {
            const on = soon[model.key] ?? false;
            return (
              <li key={model.key} className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-zinc-200 px-3.5 py-2.5">
                <span className="min-w-0 flex-1 text-sm font-medium text-zinc-950">{model.name}</span>
                <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-700">
                  <input type="checkbox" name={`soon:${model.key}`} checked={on} onChange={(event) => setSoon({ ...soon, [model.key]: event.target.checked })} />
                  {copy.soonToggle}
                </label>
                {on ? (
                  <input
                    name={`expected:${model.key}`}
                    defaultValue={model.expected ?? ""}
                    required
                    maxLength={max}
                    placeholder={copy.soonPlaceholder}
                    aria-label={`${copy.soonExpected}: ${model.name}`}
                    className={`${field} h-9 w-32`}
                  />
                ) : (
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-200 ring-inset">{copy.soonBookable}</span>
                )}
              </li>
            );
          })}
        </ul>
        <button className={`${btn.base} ${btn.primary} ${btn.md} w-fit`}>{copy.soonSave}</button>
      </ActionForm>
    </section>
  );
}
