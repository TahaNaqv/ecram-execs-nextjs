"use client";

import { APIProvider, Map, AdvancedMarker, Pin } from "@vis.gl/react-google-maps";

export function LiveMap() {
  const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

  return (
    <div className="relative h-64 w-full rounded-xl border border-zinc-200 bg-zinc-950 overflow-hidden shadow-inner">
      <APIProvider apiKey={googleMapsApiKey}>
        <Map
          defaultCenter={{ lat: 52.3676, lng: 4.9041 }} // Amsterdam Center
          defaultZoom={11}
          gestureHandling={'greedy'}
          disableDefaultUI={true}
          colorScheme={'DARK'}
          style={{ width: '100%', height: '100%' }}
        >
          <AdvancedMarker position={{ lat: 52.3105, lng: 4.7683 }} title={"Schiphol Airport VIP Terminal"}>
            <Pin background={'#10b981'} glyphColor={'#000'} borderColor={'#065f46'} />
          </AdvancedMarker>
          <AdvancedMarker position={{ lat: 52.3391, lng: 4.8777 }} title={"Amsterdam Zuidas"}>
            <Pin background={'#38bdf8'} glyphColor={'#000'} borderColor={'#0369a1'} />
          </AdvancedMarker>
        </Map>
      </APIProvider>

      <div className="absolute top-3 left-3 right-3 z-10 flex items-center justify-between pointer-events-none">
        <span className="flex items-center gap-1.5 rounded-md bg-zinc-900/90 border border-zinc-700 px-2.5 py-1 text-xs text-white shadow">
          <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Confirmed Dispatch</span>
        </span>
        <span className="flex items-center gap-1.5 rounded-md bg-zinc-900/90 border border-zinc-700 px-2.5 py-1 text-xs text-white shadow">
          <span className="size-2 rounded-full bg-amber-400" />
          <span>Soft-match</span>
        </span>
      </div>

      <div className="absolute bottom-3 left-3 right-3 z-10 flex items-center justify-between text-[11px] text-zinc-300 bg-zinc-950/90 border border-zinc-800 px-3 py-1.5 rounded-md backdrop-blur">
        <span>Google Maps SDK Active (Amsterdam / Schiphol)</span>
        <span className="font-mono text-emerald-400">● Real-Time GPS Feed</span>
      </div>
    </div>
  );
}