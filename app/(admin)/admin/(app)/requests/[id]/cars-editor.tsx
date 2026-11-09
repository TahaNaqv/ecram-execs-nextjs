"use client";

import { useActionState, useState } from "react";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { interpolate } from "@/lib/i18n/interpolate";
import { AlertIcon, CheckIcon } from "../../../_components/icons";
import { btn, Card, CardHeader } from "../../../_components/ui";
import { updateCars, type CarsState } from "./cars-actions";

type Copy = Dictionary["admin"]["review"];

/** The booking's cars, changed by the booking manager during the review (the client, 8 Nov 2026). Up to `max` of each model. */
export function CarsEditor({
  requestId,
  status,
  cars,
  initial,
  max,
  copy: t,
}: {
  requestId: string;
  status: string;
  cars: { key: string; name: string; seats: number | null }[];
  initial: Record<string, number>;
  max: number;
  copy: Copy;
}) {
  const [counts, setCounts] = useState<Record<string, number>>(initial);
  const [state, action, pending] = useActionState<CarsState, FormData>(updateCars, {});
  const set = (key: string, n: number) => setCounts((c) => ({ ...c, [key]: Math.max(0, Math.min(max, n)) }));
  const value = cars
    .filter((c) => (counts[c.key] ?? 0) > 0)
    .map((c) => `${c.key}:${counts[c.key]}`)
    .join("|");
  const qty = "grid size-8 place-items-center rounded-md border border-zinc-200 bg-white text-base text-zinc-900 hover:border-zinc-400 disabled:opacity-40";

  return (
    <Card>
      <CardHeader title={t.carsTitle} description={t.carsNote} />
      <form action={action} className="flex flex-col gap-4 p-5">
        <input type="hidden" name="requestId" value={requestId} />
        <input type="hidden" name="seenStatus" value={status} />
        <input type="hidden" name="cars" value={value} />
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {cars.map((c) => {
            const n = counts[c.key] ?? 0;
            return (
              <li key={c.key} className="flex items-center justify-between gap-3">
                <span className="min-w-0 text-sm text-zinc-900">
                  {c.name}
                  {c.seats !== null && <span className="text-zinc-500"> · {c.seats}</span>}
                </span>
                <span className="flex items-center gap-2">
                  <button type="button" aria-label={interpolate(t.carsFewer, { car: c.name })} disabled={n === 0} onClick={() => set(c.key, n - 1)} className={qty}>
                    −
                  </button>
                  <output aria-label={interpolate(t.carsCount, { car: c.name })} className="w-6 text-center text-sm font-semibold tabular-nums">
                    {n}
                  </output>
                  <button type="button" aria-label={interpolate(t.carsMore, { car: c.name })} disabled={n >= max} onClick={() => set(c.key, n + 1)} className={qty}>
                    +
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
        {state.error && (
          <p role="alert" className="m-0 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-800 ring-1 ring-inset ring-red-200">
            <AlertIcon className="mt-0.5 shrink-0" />
            {state.error}
          </p>
        )}
        <div className="flex items-center gap-3">
          <button disabled={pending || value === ""} className={`${btn.base} ${btn.primary} ${btn.md}`}>
            {pending ? t.carsSaving : t.carsSave}
          </button>
          <span aria-live="polite" className="text-[13px]">
            {state.ok && !pending && (
              <span className="inline-flex items-center gap-1.5 text-emerald-700">
                <CheckIcon size={14} /> {t.carsSaved}
              </span>
            )}
          </span>
        </div>
      </form>
    </Card>
  );
}
