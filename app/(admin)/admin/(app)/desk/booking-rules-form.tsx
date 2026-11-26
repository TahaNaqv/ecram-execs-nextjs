"use client";

import { useState } from "react";
import { ActionForm } from "../../_components/action-feedback";
import { btn, field, fieldLabel } from "../../_components/ui";
import type { SettingsResult } from "./actions";

type Rules = { minNoticeHours: number; waitingMinutes: number; cancellationHours: number };

const FIELDS: { name: keyof Rules; label: string; hint: string; max: number }[] = [
  { name: "minNoticeHours", label: "Minimum notice (hours)", hint: "How far ahead a booking must be made, 0 to 72.", max: 72 },
  { name: "waitingMinutes", label: "Included waiting time (minutes)", hint: "Waiting at pickup that is included, 0 to 120.", max: 120 },
  { name: "cancellationHours", label: "Cancellation window (hours)", hint: "Hours before pickup, 0 to 168 (one week).", max: 168 },
];

export function BookingRulesForm({ rules, action }: { rules: Rules; action: (formData: FormData) => Promise<SettingsResult> }) {
  // Controlled, so a refused value stays on screen to be corrected
  const [values, setValues] = useState(() => ({
    minNoticeHours: String(rules.minNoticeHours),
    waitingMinutes: String(rules.waitingMinutes),
    cancellationHours: String(rules.cancellationHours),
  }));

  return (
    <ActionForm action={action} success="Booking rules saved!" className="flex flex-col gap-4 px-5 py-4">
      {FIELDS.map((item) => (
        <label key={item.name} className="flex flex-col gap-1.5">
          <span className={fieldLabel}>{item.label}</span>
          <input
            name={item.name}
            type="number"
            inputMode="numeric"
            min={0}
            max={item.max}
            step={1}
            required
            value={values[item.name]}
            onChange={(event) => setValues((prev) => ({ ...prev, [item.name]: event.target.value }))}
            className={`${field} h-10`}
          />
          <span className="text-xs text-zinc-500">{item.hint}</span>
        </label>
      ))}
      <button className={`${btn.base} ${btn.primary} ${btn.md} self-start`}>Save rules</button>
    </ActionForm>
  );
}
