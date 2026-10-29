"use client";

import { useActionState, useState } from "react";
import { AlertIcon, PlusIcon } from "../../_components/icons";
import { btn, field, fieldLabel } from "../../_components/ui";
import { addDriver, type AddDriverState } from "./actions";
import { COUNTRY_CODES } from "@/lib/quotes/constants";
import { cleanPhoneInput, PASTE_MAX } from "@/lib/phone";

export type AddDriverFormCopy = { driverName: string; phone: string; namePlaceholder: string; phonePlaceholder: string; adding: string; addDriver: string };

export function AddDriverForm({ copy }: { copy: AddDriverFormCopy }) {
  const [state, action, pending] = useActionState<AddDriverState, FormData>(addDriver, {});
  const [phoneCountry, setPhoneCountry] = useState("31");
  const [phoneNumber, setPhoneNumber] = useState("");

  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="driver-name" className={fieldLabel}>
          {copy.driverName}
        </label>
        <input id="driver-name" name="name" required maxLength={120} autoComplete="off" placeholder={copy.namePlaceholder} className={`${field} h-11 px-3.5`} />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="driver-phone" className={fieldLabel}>
          {copy.phone}
        </label>
        <div className="flex items-stretch rounded-xl border border-solid border-ink-300 bg-white overflow-hidden focus-within:border-ink-950 h-11 px-1">
          <select
            name="phoneCountry"
            aria-label="Country code"
            value={phoneCountry}
            onChange={(e) => {
              setPhoneCountry(e.target.value);
              setPhoneNumber(cleanPhoneInput(phoneNumber, e.target.value));
            }}
            className="w-[104px] shrink-0 cursor-pointer border-0 border-r border-solid border-ink-200 bg-transparent py-0 pr-7 pl-3 text-[14px] text-ink-950 outline-none"
          >
            {COUNTRY_CODES.map(([code, iso]) => (
              <option key={code} value={code}>
                {iso} +{code}
              </option>
            ))}
          </select>
          <input
            id="driver-phone"
            name="phone"
            type="tel"
            required
            maxLength={PASTE_MAX}
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(cleanPhoneInput(e.target.value, phoneCountry))}
            autoComplete="tel-national"
            inputMode="tel"
            placeholder={copy.phonePlaceholder}
            className="w-full min-w-0 border-none bg-transparent px-3.5 py-2 text-[15px] text-ink-950 outline-none placeholder:text-ink-420"
          />
        </div>
      </div>

      {state.error && (
        <p role="alert" className="flex items-start gap-2 text-sm text-red-700">
          <AlertIcon className="mt-0.5 shrink-0" />
          {state.error}
        </p>
      )}
      <button disabled={pending} className={`${btn.base} ${btn.primary} ${btn.lg} mt-1`}>
        <PlusIcon /> {pending ? copy.adding : copy.addDriver}
      </button>
    </form>
  );
}