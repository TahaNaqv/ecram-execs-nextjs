"use client";

import { useEffect, useRef } from "react";
import { MAX_GALLERY_IMAGES, type Amenity, type FleetVehicle } from "@/lib/fleet/vehicles";
import { interpolate } from "@/lib/i18n/interpolate";
import type { Locale } from "@/lib/i18n/config";
import { VehicleGallery } from "../vehicle-gallery";

export type FleetDictionary = Record<string, string>;

const AMENITY_KEY = {
  executive_seating: "amenityExecutiveSeating",
  in_car_screens: "amenityInCarScreens",
  entertainment: "amenityEntertainment",
  climate_control: "amenityClimateControl",
  refreshments: "amenityRefreshments",
} as const satisfies Record<Amenity, string>;

/** The questions a guest asks about a car, answered only from confirmed specs (see lib/fleet/vehicles.ts). */
export function questionsFor(vehicle: FleetVehicle, t: FleetDictionary, locale: Locale): [question: string, answer: string][] {
  const { specs } = vehicle;
  const items: [string, string][] = [];
  if (specs) items.push([t.qaPassengersQ, interpolate(t.qaPassengersA, { count: specs.passengers })]);
  if (specs && vehicle.drivetrain !== "ice") {
    items.push([t.qaRangeQ, interpolate(t.qaRangeA, { km: specs.rangeKm, standard: specs.rangeStandard })]);
  }
  items.push([t.qaDurationQ, t.qaDurationA]);
  if (specs && specs.amenities.length > 0) {
    items.push([t.qaFeaturesQ, interpolate(t.qaFeaturesA, { list: specs.amenities.map((a) => t[AMENITY_KEY[a]]).join(", ") })]);
  }
  if (specs?.luggage) items.push([t.qaLuggageQ, specs.luggage[locale]]);
  return items.slice(0, 5);
}

/**
 * Photos and answers for one car, in a modal dialog (focus stays inside it; Escape and the backdrop close it).
 * Opened from the car step's cards; `vehicle` null means closed.
 */
export function VehicleDetails({ vehicle, onClose, fleetDict: t, locale, closeLabel }: {
  vehicle: FleetVehicle | null;
  onClose: () => void;
  fleetDict: FleetDictionary;
  locale: Locale;
  closeLabel: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (vehicle && !d.open) d.showModal();
    if (!vehicle && d.open) d.close();
  }, [vehicle]);

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      onClick={(e) => e.target === dialog.current && dialog.current?.close()}
      aria-label={vehicle?.name}
      className="m-auto max-h-[calc(100dvh-24px)] w-[min(960px,calc(100vw-24px))] max-w-none overflow-y-auto overscroll-contain rounded-3xl border-0 bg-white p-0 text-ink-950 shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
    >
      {vehicle && (
        <div className="relative flex flex-col gap-8 p-6 md:flex-row md:p-10">
          {/* Close button inside the top-right corner: the dialog scrolls on a small screen, which would clip a button hanging outside it */}
          <button
            type="button"
            onClick={() => dialog.current?.close()}
            aria-label={closeLabel}
            className="absolute top-3 right-3 z-30 grid size-11 cursor-pointer place-items-center rounded-full bg-white text-ink-700 transition-all hover:bg-ink-100 hover:text-ink-950 shadow-lg border border-ink-200"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>

          {/* Left Column: Image Gallery & Title */}
          <div className="w-full shrink-0 md:w-[380px] pt-2">
            <div className="relative aspect-[16/10] w-full overflow-hidden rounded-2xl shadow-md">
              <VehicleGallery
                name={vehicle.name}
                images={vehicle.images.slice(0, MAX_GALLERY_IMAGES)}
                alt={interpolate(t.imageAlt ?? "{name}", { name: vehicle.name })}
                copy={{
                  label: t.galleryLabel,
                  prev: t.galleryPrev,
                  next: t.galleryNext,
                  enlarge: t.galleryEnlarge,
                  close: t.galleryClose,
                  counter: t.galleryCounter,
                  lightbox: t.galleryLightbox,
                }}
              />
            </div>
            <h3 className="m-0 mt-4 font-serif text-[26px] font-normal tracking-tight text-ink-950">{vehicle.name}</h3>
          </div>

          {/* Right Column: Individual padded and rounded card borders with smaller fonts */}
          <div className="flex min-w-0 flex-1 flex-col gap-3 justify-center">
            {questionsFor(vehicle, t, locale).map(([question, answer]) => (
              <details key={question} name="vehicle-questions" className="group rounded-xl border border-solid border-ink-225 bg-white p-3.5 transition-all hover:border-ink-400">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[13.5px] font-medium text-ink-900 transition-colors hover:text-ink-950 [&::-webkit-details-marker]:hidden">
                  <span className="pr-2">{question}</span>
                  <svg className="shrink-0 text-ink-500 transition-transform duration-300 group-open:rotate-45" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </summary>
                <p className="m-0 pt-2.5 pr-4 text-[12.5px] leading-relaxed text-ink-600 border-t border-ink-100 mt-2.5">{answer}</p>
              </details>
            ))}
          </div>
        </div>
      )}
    </dialog>
  );
}