"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { AlertIcon, PlusIcon } from "../../_components/icons";
import { btn, field, fieldLabel } from "../../_components/ui";
import { addDriver, type AddDriverState } from "./actions";
import { COUNTRY_CODES } from "@/lib/quotes/constants";
import { cleanPhoneInput, PASTE_MAX } from "@/lib/phone";

export type AddDriverFormCopy = { driverName: string; phone: string; namePlaceholder: string; phonePlaceholder: string; adding: string; addDriver: string };

export function AddDriverForm({ copy, onRegistered }: { copy: AddDriverFormCopy; onRegistered?: () => void }) {
  const [state, action, pending] = useActionState<AddDriverState, FormData>(addDriver, {});
  const [phoneCountry, setPhoneCountry] = useState("31");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [formKey, setFormKey] = useState(0);
  const closed = useRef(false);
  const onRegisteredRef = useRef(onRegistered);
  onRegisteredRef.current = onRegistered;

  useEffect(() => {
    if (!state.ok || closed.current) return;
    closed.current = true;
    setPhoneNumber("");
    setPhoneCountry("31");
    setFormKey((key) => key + 1);
    onRegisteredRef.current?.();
  }, [state]);

  return (
    <form key={formKey} action={action} className="flex w-full min-w-0 flex-col gap-3">
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
        <div className="box-border flex h-11 min-w-0 w-full items-stretch overflow-hidden rounded-xl border border-solid border-ink-300 bg-white px-1 focus-within:border-ink-950">
          <select
            name="phoneCountry"
            aria-label="Country code"
            value={phoneCountry}
            onChange={(e) => {
              setPhoneCountry(e.target.value);
              setPhoneNumber(cleanPhoneInput(phoneNumber, e.target.value));
            }}
            className="w-[6.5rem] max-w-[40%] shrink-0 cursor-pointer border-0 border-r border-solid border-ink-200 bg-transparent py-0 pr-2 pl-3 text-[14px] text-ink-950 outline-none"
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
            type="text"
            spellCheck={false}
            required
            maxLength={PASTE_MAX}
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(cleanPhoneInput(e.target.value, phoneCountry))}
            autoComplete="tel-national"
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder={copy.phonePlaceholder}
            className="min-w-0 flex-1 border-none bg-transparent px-3.5 py-2 text-[15px] text-ink-950 outline-none [text-overflow:clip] placeholder:text-ink-420"
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