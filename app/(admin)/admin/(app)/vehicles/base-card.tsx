"use client";

import { useActionState, useState } from "react";
import { AddressField } from "@/app/[locale]/_components/booking/address-field";
import type { Place } from "@/app/[locale]/_components/booking/trip";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { AlertIcon, CheckIcon } from "../../_components/icons";
import { btn, Card, CardHeader } from "../../_components/ui";
import { saveFleetBase, type BaseState } from "./base-actions";

type Copy = Dictionary["admin"]["vehicles"];

/**
 * Where the cars live, set by the team (the client, 8 Nov 2026). With the same address search as the booking form, so a
 * picked suggestion keeps Google's place id and the drive home is measured to exactly that place.
 */
export function FleetBaseCard({
  base,
  saved,
  locale,
  copy: t,
}: {
  base: { address: string; placeId: string | null } | null;
  /** "Saved by Ali, 9 Nov 2026 14:02", or null when never saved */
  saved: string | null;
  locale: string;
  copy: Copy;
}) {
  const [place, setPlace] = useState<Place>({ text: base?.address ?? "", id: base?.placeId ?? null, kind: null });
  const [state, action, pending] = useActionState<BaseState, FormData>(saveFleetBase, {});
  const unchanged = place.text.trim() === (base?.address ?? "") && (place.id ?? null) === (base?.placeId ?? null);

  return (
    <Card>
      <CardHeader title={t.baseTitle} description={t.baseNote} />
      <form action={action} className="flex flex-col gap-4 p-5">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="fleet-base" className="text-sm font-medium text-zinc-900">
            {t.baseLabel}
          </label>
          <AddressField
            id="fleet-base"
            value={place}
            // Typing clears the place id; picking a suggestion sets it
            onChange={setPlace}
            placeholder={t.basePlaceholder}
            locale={locale}
            copy={{ suggestions: t.baseSuggestions }}
            tone="light"
            describedBy="fleet-base-help"
          />
          <p id="fleet-base-help" className="m-0 text-[13px] text-zinc-500">
            {base ? t.baseHelp : t.baseUnset}
          </p>
        </div>
        <input type="hidden" name="address" value={place.text} />
        <input type="hidden" name="placeId" value={place.id ?? ""} />
        {state.error && (
          <p role="alert" className="m-0 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-800 ring-1 ring-inset ring-red-200">
            <AlertIcon className="mt-0.5 shrink-0" />
            {state.error}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <button disabled={pending || unchanged} className={`${btn.base} ${btn.primary} ${btn.md}`}>
            {pending ? t.baseSaving : t.baseSave}
          </button>
          {/* After a save the card is drawn again from the saved address, so this line then says who saved it and when */}
          <span aria-live="polite" className="inline-flex items-center gap-1.5 text-[13px] text-zinc-500">
            {saved && unchanged && <CheckIcon className="text-emerald-700" />}
            {saved}
          </span>
        </div>
      </form>
    </Card>
  );
}
