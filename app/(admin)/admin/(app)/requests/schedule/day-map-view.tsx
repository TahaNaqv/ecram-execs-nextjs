"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { APIProvider, Map, useMap } from "@vis.gl/react-google-maps";
import { decodePolyline, type LatLng } from "@/lib/fleet/polyline";

export type MapRoute = {
  id: string;
  reference: string;
  name: string;
  car: string;
  colour: string;
  /** "09:00" */
  time: string;
  from: string;
  to: string;
  /** Google's encoded polyline */
  path: string;
};

type Drawn = MapRoute & { points: LatLng[] };

const NETHERLANDS = { lat: 52.1, lng: 5.2 };

/** Draws every route as a line in its car's colour, and gives the selected one weight. */
function Lines({ routes, selected, onSelect }: { routes: Drawn[]; selected: string | null; onSelect: (id: string) => void }) {
  const map = useMap();

  // Show all of the routes when they change, and the selected one when it is picked
  useEffect(() => {
    if (!map) return;
    const shown = selected ? routes.filter((r) => r.id === selected) : routes;
    const bounds = new google.maps.LatLngBounds();
    for (const r of shown) for (const p of r.points) bounds.extend(p);
    if (!bounds.isEmpty()) map.fitBounds(bounds, 48);
  }, [map, routes, selected]);

  useEffect(() => {
    if (!map) return;
    const lines = routes.map((r) => {
      const on = selected === null || selected === r.id;
      const line = new google.maps.Polyline({
        map,
        path: r.points,
        strokeColor: r.colour,
        strokeOpacity: on ? 0.95 : 0.35,
        strokeWeight: selected === r.id ? 7 : 4,
        zIndex: selected === r.id ? 10 : 1,
        icons: [
          // A dot where the trip starts, an arrow where it ends
          { icon: { path: google.maps.SymbolPath.CIRCLE, scale: 6, fillColor: r.colour, fillOpacity: 1, strokeColor: "#ffffff", strokeWeight: 2 }, offset: "0%" },
          { icon: { path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW, scale: 3.5, fillColor: r.colour, fillOpacity: 1, strokeColor: "#ffffff", strokeWeight: 1.5 }, offset: "100%" },
        ],
      });
      line.addListener("click", () => onSelect(r.id));
      return line;
    });
    return () => lines.forEach((l) => l.setMap(null));
  }, [map, routes, selected, onSelect]);

  return null;
}

export function DayMapView({
  apiKey,
  routes,
  locale,
  copy,
}: {
  apiKey: string;
  locale: "en" | "nl";
  routes: MapRoute[];
  copy: { frame: string; trips: string; open: string; showAll: string };
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const drawn = useMemo<Drawn[]>(() => routes.map((r) => ({ ...r, points: decodePolyline(r.path) })).filter((r) => r.points.length > 1), [routes]);

  return (
    <div>
      <div role="region" aria-label={copy.frame} className="h-72 w-full bg-zinc-100 sm:h-96">
        <APIProvider apiKey={apiKey} language={locale} region="NL">
          <Map defaultCenter={NETHERLANDS} defaultZoom={7} gestureHandling="cooperative" mapTypeControl={false} streetViewControl={false} className="h-full w-full">
            <Lines routes={drawn} selected={selected} onSelect={setSelected} />
          </Map>
        </APIProvider>
      </div>
      <div className="border-t border-zinc-100 px-5 py-4">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h3 className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">{copy.trips}</h3>
          {selected && (
            <button type="button" onClick={() => setSelected(null)} className="text-xs font-medium text-zinc-700 underline-offset-2 hover:underline">
              {copy.showAll}
            </button>
          )}
        </div>
        <ul className="grid gap-2 sm:grid-cols-2">
          {drawn.map((r) => (
            <li key={r.id}>
              <div className={`flex items-start gap-3 rounded-lg border px-3 py-2 text-xs ${selected === r.id ? "border-zinc-900 bg-zinc-50" : "border-zinc-200 bg-white"}`}>
                <span aria-hidden="true" className="mt-1 size-3 shrink-0 rounded-full" style={{ backgroundColor: r.colour }} />
                <button type="button" aria-pressed={selected === r.id} onClick={() => setSelected(selected === r.id ? null : r.id)} className="min-w-0 flex-1 text-left">
                  <span className="block font-semibold tabular-nums text-zinc-900">
                    {r.time} <span className="font-mono font-medium text-zinc-600">{r.reference}</span>
                  </span>
                  <span className="block truncate text-zinc-700">
                    {r.name} · {r.car}
                  </span>
                  <span className="block truncate text-zinc-500">
                    {r.from} → {r.to}
                  </span>
                </button>
                <Link href={`/admin/requests/${r.id}`} className="shrink-0 font-medium text-zinc-700 underline-offset-2 hover:underline">
                  {copy.open}
                </Link>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
