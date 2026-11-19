"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

export const STANDARD_CITIES = [
  // Major Dutch Cities
  "Amsterdam",
  "Rotterdam",
  "The Hague",
  "Utrecht",
  "Eindhoven",
  "Tilburg",
  "Groningen",
  "Almere",
  "Breda",
  "Nijmegen",
  "Enschede",
  "Haarlem",
  "Arnhem",
  "Amersfoort",
  "Zaanstad",
  "'s-Hertogenbosch",
  "Haarlemmermeer",
  "Zwolle",
  "Zoetermeer",
  "Leiden",
  "Leeuwarden",
  "Dordrecht",
  "Alphen aan den Rijn",
  "Alkmaar",
  "Emmen",
  "Delft",
  "Venlo",
  "Deventer",
  "Sittard-Geleen",
  "Helmond",
  "Oss",
  "Amstelveen",
  "Hilversum",
  "Heerlen",
  "Nissewaard",
  "Hengelo",
  "Purmerend",
  "Schiedam",
  "Roosendaal",
  "Lelystad",
  "Gouda",
  "Hoorn",
  "Velsen",
  "Vlaardingen",
  "Assen",
  "Bergen op Zoom",
  "Capelle aan den IJssel",
  "Veenendaal",
  "Katwijk",
  "Zeist",
  "Nieuwegein",
  "Roermond",
  "Doetinchem",
  "Barneveld",
  "Hoogeveen",
  // Major European Business Hubs
  "Antwerp",
  "Basel",
  "Berlin",
  "Birmingham",
  "Brussels",
  "Cologne",
  "Copenhagen",
  "Dublin",
  "Düsseldorf",
  "Edinburgh",
  "Frankfurt am Main",
  "Geneva",
  "Ghent",
  "Hamburg",
  "London",
  "Luxembourg City",
  "Lyon",
  "Madrid",
  "Manchester",
  "Marseille",
  "Milan",
  "Munich",
  "Oslo",
  "Paris",
  "Rome",
  "Stockholm",
  "Stuttgart",
  "Vienna",
  "Zurich",
] as const;

export function CityDropdownField({
  id = "c-billingCity",
  name = "billingCity",
  defaultValue = "",
  placeholder = "Select or search city",
  required = true,
  invalid = false,
  describedBy,
  className = "",
}: {
  id?: string;
  name?: string;
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
  invalid?: boolean;
  describedBy?: string;
  className?: string;
}) {
  const [query, setQuery] = useState(defaultValue);
  const [selected, setSelected] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();

  // Normalize search query
  const filteredCities = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return STANDARD_CITIES;
    return STANDARD_CITIES.filter((city) => city.toLowerCase().includes(q));
  }, [query]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
        // If query doesn't match an allowed city, revert to last valid selected city
        const exactMatch = STANDARD_CITIES.find(
          (c) => c.toLowerCase() === query.trim().toLowerCase()
        );
        if (exactMatch) {
          setSelected(exactMatch);
          setQuery(exactMatch);
        } else if (selected) {
          setQuery(selected);
        } else {
          setQuery("");
          setSelected("");
        }
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [query, selected]);

  const selectCity = (city: string) => {
    setSelected(city);
    setQuery(city);
    setOpen(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter")) {
      e.preventDefault();
      setOpen(true);
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev < filteredCities.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev > 0 ? prev - 1 : filteredCities.length - 1
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filteredCities[highlightedIndex]) {
        selectCity(filteredCities[highlightedIndex]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <input type="hidden" name={name} value={selected} required={required} />
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          id={id}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={open ? listboxId : undefined}
          aria-autocomplete="list"
          aria-invalid={invalid}
          aria-describedby={describedBy}
          autoComplete="off"
          placeholder={placeholder}
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            const val = e.target.value;
            setQuery(val);
            setHighlightedIndex(0);
            setOpen(true);
            const exact = STANDARD_CITIES.find(
              (c) => c.toLowerCase() === val.trim().toLowerCase()
            );
            if (exact) {
              setSelected(exact);
            } else {
              setSelected("");
            }
          }}
          onKeyDown={handleKeyDown}
          className={`${className} pr-8`}
        />
        <button
          type="button"
          tabIndex={-1}
          aria-label="Toggle city list"
          onClick={() => {
            setOpen((prev) => !prev);
            inputRef.current?.focus();
          }}
          className="absolute right-0 flex h-full items-center px-1 text-zinc-400 hover:text-white transition-colors cursor-pointer border-0 bg-transparent"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            aria-hidden="true"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
      </div>

      {open && (
        <ul
          id={listboxId}
          role="listbox"
          aria-label="Cities"
          className="absolute left-0 top-full z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-solid border-[#3f5192] bg-[#081b62] p-1 text-[#f4f4f5] shadow-2xl [scrollbar-width:thin] [scrollbar-color:#3f5192_transparent]"
        >
          {filteredCities.length > 0 ? (
            filteredCities.map((city, idx) => {
              const isSelected = city === selected;
              const isHighlighted = idx === highlightedIndex;
              return (
                <li
                  key={city}
                  role="option"
                  aria-selected={isSelected}
                  onMouseDown={(e) => {
                    e.preventDefault(); // prevent blur
                    selectCity(city);
                  }}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  className={`flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-[14px] transition-colors ${
                    isHighlighted || isSelected
                      ? "bg-[#1c2d6e] font-semibold text-white"
                      : "text-zinc-200 hover:bg-[#152358]"
                  }`}
                >
                  <span>{city}</span>
                  {isSelected && (
                    <span className="text-emerald-400 text-xs">✓</span>
                  )}
                </li>
              );
            })
          ) : (
            <li className="px-3 py-2 text-xs text-zinc-400">
              No matching European city found
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
