"use client";

import { useId, useState } from "react";
import { DateTimeField, type DateTimeCopy } from "@/components/date-time-field";

/** The words the prompt needs (the chat's own, the picker's from the booking bar). */
export type DatePromptCopy = {
  /** "Pick-up date and time" */
  label: string;
  use: string;
  picker: DateTimeCopy;
};

/**
 * A question about a date and time, answered in the chat with the booking bar's own calendar and time picker (already open)
 * instead of typing. Pressing Done in the calendar, or the button under it, hands the choice back as "YYYY-MM-DDTHH:mm"
 * (Netherlands time).
 */
export function DatePrompt({ locale, copy, onChoose }: { locale: string; copy: DatePromptCopy; onChoose: (value: string) => void }) {
  const id = useId();
  const [value, setValue] = useState("");
  return (
    <section aria-labelledby={`${id}-label`} className="mt-3 box-border w-full rounded-2xl border border-ink-600 bg-ink-850 p-3.5">
      <label id={`${id}-label`} htmlFor={id} className="mb-2 block text-[12px] text-ink-300">
        {copy.label}
      </label>
      <div className="rounded-xl border border-solid border-ink-600 bg-ink-900 px-3.5 py-2">
        <DateTimeField id={id} locale={locale} copy={copy.picker} tone="dark" size="md" className="text-white placeholder:text-ink-450" defaultOpen onValueChange={setValue} onDone={onChoose} />
      </div>
      <button
        type="button"
        disabled={!value}
        onClick={() => onChoose(value)}
        className="mt-3 cursor-pointer rounded-xl border-0 bg-white px-4 py-2 text-[13px] font-semibold text-ink-950 transition-opacity hover:opacity-90 disabled:cursor-default disabled:opacity-40"
      >
        {copy.use}
      </button>
    </section>
  );
}
