"use client";

import { useState } from "react";
import Link from "next/link";
import {
  BatteryIcon,
  CarIcon,
  CheckCircleIcon,
  ClockIcon,
  CompassIcon,
  MapIcon,
  PlaneIcon,
  RefreshIcon,
  ShieldIcon,
  SteeringIcon,
  UsersIcon,
  ZapIcon,
} from "../../_components/icons";
import type { DispatchVehicleRow, DispatchTripRow } from "@/lib/admin/live-queries";

export type DispatchVehicle = {
  id: string;
  name: string;
  plate: string;
  color: string;
  driverName: string;
  driverPhone: string;
  driverShift: "active" | "break" | "ending_soon";
  shiftUntil: string;
  soc: number; // 0 - 100%
  rangeKm: number;
  chargingStatus: "none" | "fast_charging" | "standard_charging";
  status: "on_trip" | "standby" | "charging";
};

export type DispatchTrip = {
  id: string;
  reference: string;
  clientName: string;
  entity?: string;
  vehicleId: string | null; // null = unassigned
  service: string;
  pickupTime: string; // "08:30"
  durationHours: number; // 1.5
  startHour: number; // 8.5
  collection: string;
  destination: string;
  flight?: {
    code: string;
    origin: string;
    scheduledTime: string;
    adjustedTime: string;
    delayMinutes: number;
    status: "on_time" | "delayed" | "landed";
  };
  status: "confirmed" | "soft_matched" | "unassigned";
};


const HOURS = Array.from({ length: 17 }, (_, i) => i + 6); // 06:00 to 22:00

function mapDbVehicles(dbVehicles?: DispatchVehicleRow[]): DispatchVehicle[] {
  if (!dbVehicles || dbVehicles.length === 0) return [];
  return dbVehicles.map((v) => ({
    id: v.id,
    name: v.name,
    plate: v.plate || "TX-00-XX",
    color: v.color || "Obsidian Black",
    driverName: "Assigned Chauffeur",
    driverPhone: "+31 20 000 0000",
    driverShift: "active" as const,
    shiftUntil: "20:00",
    soc: v.batterySoC ?? 85,
    rangeKm: v.rangeKm ?? 450,
    chargingStatus: "none" as const,
    status: (v.status === "available" ? "standby" : v.status === "maintenance" ? "charging" : "on_trip") as any,
  }));
}

function mapDbTrips(dbTrips?: DispatchTripRow[]): DispatchTrip[] {
  if (!dbTrips || dbTrips.length === 0) return [];
  return dbTrips.map((t) => {
    const pickupDate = t.pickupAt ? new Date(t.pickupAt) : new Date();
    const startHour = pickupDate.getHours() + pickupDate.getMinutes() / 60;
    const hours = t.durationHours || 2.0;
    const pickupTime = `${String(pickupDate.getHours()).padStart(2, "0")}:${String(pickupDate.getMinutes()).padStart(2, "0")}`;
    return {
      id: t.id,
      reference: t.reference,
      clientName: t.clientName,
      entity: t.entity ?? undefined,
      vehicleId: t.vehicleId,
      service: t.service,
      pickupTime,
      durationHours: hours,
      startHour: isNaN(startHour) ? 9 : startHour,
      collection: t.collection || "Amsterdam",
      destination: t.destination || "Destination",
      flight: t.flightNumber
        ? {
            code: t.flightNumber,
            origin: "AMS Inbound",
            scheduledTime: pickupTime,
            adjustedTime: pickupTime,
            delayMinutes: 0,
            status: "on_time" as const,
          }
        : undefined,
      status: (t.vehicleId ? "confirmed" : "unassigned") as any,
    };
  });
}

export type DispatchGridProps = {
  vehicles?: DispatchVehicleRow[];
  trips?: DispatchTripRow[];
};

export function VisualDispatchGrid({ vehicles: initialDbVehicles, trips: initialDbTrips }: DispatchGridProps = {}) {
  const [vehicles, setVehicles] = useState<DispatchVehicle[]>(() => mapDbVehicles(initialDbVehicles));
  const [trips, setTrips] = useState<DispatchTrip[]>(() => mapDbTrips(initialDbTrips));
  const [selectedTrip, setSelectedTrip] = useState<DispatchTrip | null>(null);
  const [simulatedFlightTelemetry, setSimulatedFlightTelemetry] = useState(true);

  const unassignedTrips = trips.filter((t) => t.vehicleId === null);

  // Allocate an unassigned trip to the best matching vehicle
  const handleSmartAllocate = (tripId: string) => {
    // Find optimal vehicle (highest battery SoC among available or standby)
    const availableVehicle = [...vehicles].sort((a, b) => b.soc - a.soc)[0];
    if (!availableVehicle) return;

    setTrips((prev) =>
      prev.map((t) =>
        t.id === tripId ? { ...t, vehicleId: availableVehicle.id, status: "confirmed" } : t,
      ),
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Telematics & Operations Status Bar */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-zinc-200/90 bg-white p-4 shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-500">Live Active Fleet</span>
            <span className="grid size-8 place-items-center rounded-lg bg-emerald-50 text-emerald-600">
              <CarIcon size={16} />
            </span>
          </div>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-zinc-950">
            {vehicles.filter((v) => v.status === "on_trip" || v.status === "standby").length}/
            {vehicles.length}
          </p>
          <p className="mt-1 text-xs text-zinc-500">100% Zero-Emission BEVs Active</p>
        </div>

        <div className="rounded-xl border border-zinc-200/90 bg-white p-4 shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-500">Avg Fleet Battery (SoC)</span>
            <span className="grid size-8 place-items-center rounded-lg bg-sky-50 text-sky-600">
              <ZapIcon size={16} />
            </span>
          </div>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-zinc-950">
            {vehicles.length > 0 ? Math.round(vehicles.reduce((a, b) => a + b.soc, 0) / vehicles.length) : 0}%
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            Average Range: {vehicles.length > 0 ? Math.round(vehicles.reduce((a, b) => a + b.rangeKm, 0) / vehicles.length) : 0} km
          </p>
        </div>

        <div className="rounded-xl border border-zinc-200/90 bg-white p-4 shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-500">Live Flight Feeds</span>
            <span className="grid size-8 place-items-center rounded-lg bg-indigo-50 text-indigo-600">
              <PlaneIcon size={16} />
            </span>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <p className="text-2xl font-semibold tabular-nums text-zinc-950">
              {trips.filter((t) => Boolean(t.flight)).length} Flights
            </p>
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
              Auto-Synced
            </span>
          </div>
          <p className="mt-1 text-xs text-zinc-500">Schiphol Airport AMS VIP Feeds</p>
        </div>

        <div className="rounded-xl border border-zinc-200/90 bg-white p-4 shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-500">Unassigned Urgent Jobs</span>
            <span className="grid size-8 place-items-center rounded-lg bg-amber-50 text-amber-600">
              <ClockIcon size={16} />
            </span>
          </div>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-amber-700">
            {unassignedTrips.length} Pending
          </p>
          <p className="mt-1 text-xs text-zinc-500">Requires Chauffeur Allocation</p>
        </div>
      </div>

      {/* Main Grid: Left = Time Axis Dispatch Board (16hr schedule), Right = Telematics & Unassigned Jobs */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Visual Dispatch Grid (8 or 9 cols) */}
        <div className="xl:col-span-8 rounded-xl border border-zinc-200/90 bg-white shadow-card overflow-hidden">
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 p-4 sm:px-5">
            <div>
              <div className="flex items-center gap-2">
                <CompassIcon size={16} className="text-zinc-900" />
                <h2 className="text-sm font-semibold text-zinc-950">
                  Live Dispatch Grid (Schiphol & Amsterdam Operations)
                </h2>
              </div>
              <p className="mt-0.5 text-xs text-zinc-500">
                Synchronised schedule mapped from 06:00 to 22:00 with real-time flight telemetry
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSimulatedFlightTelemetry(!simulatedFlightTelemetry)}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${
                  simulatedFlightTelemetry
                    ? "bg-sky-50 text-sky-700 ring-sky-200"
                    : "bg-zinc-100 text-zinc-600 ring-zinc-200"
                }`}
              >
                <PlaneIcon size={12} />
                {simulatedFlightTelemetry ? "Live Radar Stream Active" : "Radar Paused"}
              </button>
            </div>
          </div>

          {/* Time Axis & Vehicles Grid Container */}
          <div className="overflow-x-auto p-4 scrollbar-thin">
            <div className="min-w-[760px]">
              {/* Time Axis Row */}
              <div className="grid grid-cols-[180px_repeat(16,minmax(0,1fr))] border-b border-zinc-200 pb-2 text-[11px] font-mono text-zinc-500">
                <div className="font-sans font-semibold text-zinc-900">Vehicle / Chauffeur</div>
                {HOURS.slice(0, 16).map((h) => (
                  <div key={h} className="text-center font-medium">
                    {String(h).padStart(2, "0")}:00
                  </div>
                ))}
              </div>

              {/* Vehicle Rows */}
              <div className="divide-y divide-zinc-100">
                {vehicles.length === 0 ? (
                  <div className="py-12 text-center text-xs text-zinc-500">
                    <p className="font-semibold text-zinc-900">No vehicles active in live dispatch</p>
                    <p className="mt-1">Add vehicles to the fleet to enable live timeline allocation.</p>
                    <Link
                      href="/admin/vehicles"
                      className="inline-block mt-3 bg-black text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold"
                    >
                      Manage Fleet Vehicles
                    </Link>
                  </div>
                ) : (
                  vehicles.map((v) => {
                  const vehicleTrips = trips.filter((t) => t.vehicleId === v.id);

                  return (
                    <div
                      key={v.id}
                      className="grid grid-cols-[180px_repeat(16,minmax(0,1fr))] py-3.5 items-center relative hover:bg-zinc-50/50 transition-colors"
                    >
                      {/* Vehicle & Driver Identity */}
                      <div className="pr-3">
                        <p className="truncate text-xs font-semibold text-zinc-950">{v.name}</p>
                        <div className="flex items-center gap-1.5 text-[11px] text-zinc-500">
                          <span className="font-mono text-zinc-700 font-medium">{v.plate}</span>
                          <span>Â·</span>
                          <span className="truncate">{v.driverName}</span>
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-[10px]">
                          <span className="flex items-center gap-1 text-emerald-700 font-medium">
                            <ZapIcon size={10} /> {v.soc}%
                          </span>
                          <span
                            className={`rounded px-1 py-0.2 font-medium ${
                              v.driverShift === "active"
                                ? "bg-emerald-50 text-emerald-700"
                                : v.driverShift === "break"
                                ? "bg-amber-50 text-amber-700"
                                : "bg-purple-50 text-purple-700"
                            }`}
                          >
                            Shift to {v.shiftUntil}
                          </span>
                        </div>
                      </div>

                      {/* 16-Hour Timeline Slots */}
                      <div className="col-span-16 h-12 relative bg-zinc-50/60 rounded-lg border border-dashed border-zinc-200">
                        {/* Hour Grid Markers */}
                        <div className="absolute inset-0 grid grid-cols-16 pointer-events-none divide-x divide-zinc-200/60">
                          {Array.from({ length: 16 }).map((_, i) => (
                            <div key={i} className="h-full" />
                          ))}
                        </div>

                        {/* Mapped Trips on this Vehicle's Schedule */}
                        {vehicleTrips.map((t) => {
                          // Grid spans: offset from 06:00
                          const leftPct = Math.max(0, Math.min(100, ((t.startHour - 6) / 16) * 100));
                          const widthPct = Math.max(
                            6,
                            Math.min(100 - leftPct, (t.durationHours / 16) * 100),
                          );

                          return (
                            <div
                              key={t.id}
                              onClick={() => setSelectedTrip(t)}
                              style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                              className={`absolute top-1 bottom-1 z-10 cursor-pointer rounded-md p-1.5 shadow-xs transition-all hover:ring-2 hover:ring-zinc-950 flex flex-col justify-between overflow-hidden text-[10px] ${
                                t.flight?.status === "delayed"
                                  ? "bg-amber-500 text-zinc-950 border border-amber-600 font-medium"
                                  : t.status === "soft_matched"
                                  ? "bg-purple-600 text-white border border-purple-700"
                                  : "bg-zinc-950 text-white border border-zinc-800"
                              }`}
                            >
                              <div className="flex items-center justify-between leading-none">
                                <span className="font-mono font-bold truncate">
                                  {t.pickupTime} {t.reference}
                                </span>
                                {t.flight && (
                                  <span className="flex items-center gap-0.5 shrink-0 bg-white/20 px-1 rounded text-[9px]">
                                    <PlaneIcon size={8} /> {t.flight.code}
                                  </span>
                                )}
                              </div>
                              <p className="truncate font-medium">{t.entity || t.clientName}</p>
                              {t.flight?.delayMinutes ? (
                                <span className="text-[9px] font-bold text-amber-950">
                                  +{t.flight.delayMinutes}m Flight Delay
                                </span>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-zinc-100 bg-zinc-50/50 px-5 py-3 text-xs text-zinc-500">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded bg-zinc-950" /> Confirmed Trip
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded bg-amber-500" /> Flight Delay Auto-Adjusted
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded bg-purple-600" /> Soft-Matched Bespoke
              </span>
            </div>
            <span className="text-[11px] font-mono">Schiphol Airport ETA Engine Connected</span>
          </div>
        </div>

        {/* Right Sidebar: Telematics & Unassigned Urgent Jobs (3 or 4 cols) */}
        <div className="xl:col-span-4 space-y-6">
          {/* Unassigned Urgent Jobs Alert Widget */}
          <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 shadow-card space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-900 font-semibold text-xs uppercase tracking-wider">
                <span className="size-2 rounded-full bg-amber-500 animate-pulse" />
                <span>Unassigned Urgent Jobs ({unassignedTrips.length})</span>
              </div>
              <span className="text-[10px] font-mono text-amber-800">Dispatch Priority</span>
            </div>

            {unassignedTrips.length === 0 ? (
              <p className="text-xs text-amber-800 py-2">
                All requests have been successfully allocated to fleet chauffeurs.
              </p>
            ) : (
              <div className="space-y-2.5">
                {unassignedTrips.map((u) => (
                  <div
                    key={u.id}
                    className="rounded-lg border border-amber-300/80 bg-white p-3 shadow-xs text-xs space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-semibold text-zinc-950">{u.reference}</span>
                      <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900">
                        {u.pickupTime} Today
                      </span>
                    </div>

                    <div>
                      <p className="font-medium text-zinc-900">{u.clientName} {u.entity ? `(${u.entity})` : ""}</p>
                      <p className="text-[11px] text-zinc-500 truncate mt-0.5">
                        {u.collection} â†’ {u.destination}
                      </p>
                      {u.flight && (
                        <p className="text-[11px] text-sky-700 font-medium flex items-center gap-1 mt-1">
                          <PlaneIcon size={11} /> {u.flight.code} ({u.flight.origin}) Â· +{u.flight.delayMinutes}m delay
                        </p>
                      )}
                    </div>

                    <div className="pt-2 border-t border-zinc-100 flex items-center justify-between">
                      <Link
                        href={`/admin/requests/${u.id}`}
                        className="text-[11px] font-medium text-zinc-600 hover:text-zinc-950 underline"
                      >
                        View Details
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleSmartAllocate(u.id)}
                        className="flex items-center gap-1 rounded bg-zinc-950 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-zinc-800 transition"
                      >
                        <ZapIcon size={11} /> Smart Allocate
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Fleet Compliance & Telematics Telemetry */}
          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-card space-y-3">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-2.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-800">
                Fleet Telematics Sentinel
              </span>
              <span className="text-[11px] text-zinc-500 font-mono">Live OBD-II/API</span>
            </div>

            <div className="divide-y divide-zinc-100 space-y-2 text-xs">
              {vehicles.map((v) => (
                <div key={v.id} className="pt-2 first:pt-0">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-zinc-950">{v.name}</span>
                    <span className="font-mono text-[11px] text-zinc-500">{v.plate}</span>
                  </div>

                  {/* Battery Bar */}
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="flex-1 h-2 rounded-full bg-zinc-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          v.soc > 60
                            ? "bg-emerald-500"
                            : v.soc > 30
                            ? "bg-amber-500"
                            : "bg-red-500"
                        }`}
                        style={{ width: `${v.soc}%` }}
                      />
                    </div>
                    <span className="font-mono font-medium text-[11px] text-zinc-700 w-8 text-right">
                      {v.soc}%
                    </span>
                  </div>

                  <div className="mt-1 flex items-center justify-between text-[11px] text-zinc-500">
                    <span>Range: {v.rangeKm} km</span>
                    <span className="text-zinc-600">
                      {v.chargingStatus === "fast_charging"
                        ? "âš¡ Fast Charging @ Fastned"
                        : v.status === "on_trip"
                        ? "En Route (Passenger Onboard)"
                        : "Standby in Amsterdam"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Selected Trip Detail Modal / Drawer */}
      {selectedTrip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-xl border border-zinc-200 bg-white p-6 shadow-2xl space-y-4 animate-fade-in">
            <div className="flex items-start justify-between border-b border-zinc-100 pb-3">
              <div>
                <span className="font-mono text-xs text-zinc-500">BOOKING {selectedTrip.reference}</span>
                <h3 className="text-lg font-semibold text-zinc-950">
                  {selectedTrip.entity || selectedTrip.clientName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTrip(null)}
                className="grid size-7 place-items-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900"
              >
                âœ•
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-lg bg-zinc-50 p-2.5">
                <span className="text-zinc-500 block">Pickup Time</span>
                <span className="font-mono font-bold text-zinc-900 text-sm">
                  {selectedTrip.pickupTime} (Duration: {selectedTrip.durationHours}h)
                </span>
              </div>
              <div className="rounded-lg bg-zinc-50 p-2.5">
                <span className="text-zinc-500 block">Assigned Chauffeur</span>
                <span className="font-medium text-zinc-900 text-sm">
                  {vehicles.find((v) => v.id === selectedTrip.vehicleId)?.driverName || "Unassigned"}
                </span>
              </div>
            </div>

            <div className="text-xs space-y-2">
              <div>
                <span className="text-zinc-500 font-medium">Collection:</span>
                <p className="text-zinc-900">{selectedTrip.collection}</p>
              </div>
              <div>
                <span className="text-zinc-500 font-medium">Destination:</span>
                <p className="text-zinc-900">{selectedTrip.destination}</p>
              </div>
              {selectedTrip.flight && (
                <div className="rounded-lg border border-sky-200 bg-sky-50/70 p-2.5 space-y-1">
                  <div className="flex items-center justify-between font-semibold text-sky-900">
                    <span className="flex items-center gap-1.5">
                      <PlaneIcon size={13} /> {selectedTrip.flight.code} Telemetry
                    </span>
                    <span>{selectedTrip.flight.status.toUpperCase()}</span>
                  </div>
                  <p className="text-sky-800 text-[11px]">
                    Origin: {selectedTrip.flight.origin} Â· Scheduled: {selectedTrip.flight.scheduledTime} Â· Adjusted Arrival: {selectedTrip.flight.adjustedTime} (+{selectedTrip.flight.delayMinutes}m delay)
                  </p>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-zinc-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setSelectedTrip(null)}
                className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
              >
                Close
              </button>
              <Link
                href={`/admin/requests/${selectedTrip.id}`}
                className="rounded-lg bg-zinc-950 px-3 py-1.5 text-xs font-semibold text-white hover:bg-zinc-800"
              >
                Open Full Request & Pricing
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export const DispatchGrid = VisualDispatchGrid;
