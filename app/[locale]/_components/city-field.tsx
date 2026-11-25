"use client";

import { useId, useMemo, useState } from "react";
import { BILLING_CITIES, billingCityName } from "@/lib/places/cities";

/** Searchable city list. The submitted value is a city from the list. */
export function CityField({
  id,
  name,
  defaultValue = "",
  placeholder,
  className,
  invalid,
  describedBy,
}: {
  id: string;
  name: string;
  defaultValue?: string;
  placeholder?: string;
  className?: string;
  invalid?: boolean;
  describedBy?: string;
}) {
  const listId = useId();
  const [query, setQuery] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const matches = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("en");
    const rows = needle ? BILLING_CITIES.filter((city) => city.toLocaleLowerCase("en").includes(needle)) : BILLING_CITIES;
    return rows.slice(0, 8);
  }, [query]);

  return (
    <div className="relative">
      <input
        id={id}
        name={name}
        type="text"
        required
        maxLength={100}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        placeholder={placeholder}
        value={query}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        className={className}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          const exact = billingCityName(query);
          if (exact) setQuery(exact);
          setOpen(false);
        }}
      />
      {open && matches.length > 0 && (
        <ul id={listId} role="listbox" className="absolute top-full left-0 z-50 mt-2 box-border max-h-60 w-full overflow-y-auto rounded-xl border border-solid border-[#c5d4ff] bg-[#ffffff] p-1 text-left text-[#10224f] shadow-lg [color-scheme:light]">
          {matches.map((city) => (
            <li key={city} role="option" aria-selected={billingCityName(query) === city}>
              <button
                type="button"
                className={`w-full cursor-pointer rounded-lg border-0 px-3 py-2 text-left text-[15px] text-[#10224f] ${billingCityName(query) === city ? "bg-[#e8eeff] font-semibold" : "bg-[#ffffff] hover:bg-[#f4f7ff]"}`}
                onMouseDown={(event) => {
                  event.preventDefault();
                  setQuery(city);
                  setOpen(false);
                }}
              >
                {city}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
