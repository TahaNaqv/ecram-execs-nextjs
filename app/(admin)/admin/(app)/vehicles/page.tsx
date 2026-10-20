import { FLEET } from "@/lib/fleet/vehicles";
import { requireAdmin } from "@/lib/auth/session";
import type { Metadata } from "next";
import { Suspense } from "react";
import { db } from "@/lib/db";
import { vehicles } from "@/lib/db/schema";
import { addVehicle, toggleVehicleStatus, deleteVehicle } from "@/lib/admin/vehicle-actions";
import { adminDictionary } from "@/lib/i18n/get-dictionary";
import { CarIcon, CheckCircleIcon, AlertIcon, PlusIcon, TrashIcon } from "../../_components/icons";

type Vehicle = typeof vehicles.$inferSelect;

export async function generateMetadata(): Promise<Metadata> {
  const { admin } = await adminDictionary();
  return { title: admin.vehicles.title };
}

async function VehicleMetrics() {
  const { admin } = await adminDictionary();
  const t = admin.vehicles;
  let allVehicles: Vehicle[] = [];
  try {
    allVehicles = await db.select().from(vehicles);
  } catch (error) {
    console.error("Failed to fetch vehicles for metrics:", error);
  }

  const totalCount = allVehicles.length;
  const availableCount = allVehicles.filter((v) => v.status === "available").length;
  const unavailableCount = totalCount - availableCount;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
      {/* Total Card */}
      <div className="bg-black text-white p-6 rounded-2xl shadow-sm flex flex-col justify-between relative overflow-hidden">
        <div className="flex justify-between items-start">
          <span className="text-sm font-medium text-zinc-400">{t.totalFleet}</span>
          <span className="grid size-8 place-items-center rounded-lg bg-white/10 text-white">
            <CarIcon size={18} />
          </span>
        </div>
        <div className="mt-4">
          <span className="text-3xl font-semibold tracking-tight">{totalCount}</span>
          <p className="text-xs text-zinc-400 mt-1">{t.registered}</p>
        </div>
      </div>

      {/* Available Card */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-200/80 flex flex-col justify-between">
        <div className="flex justify-between items-start">
          <span className="text-sm font-medium text-zinc-500">{t.available}</span>
          <span className="grid size-8 place-items-center rounded-lg bg-emerald-50 text-emerald-600">
            <CheckCircleIcon size={18} />
          </span>
        </div>
        <div className="mt-4">
          <span className="text-3xl font-semibold tracking-tight text-zinc-900">{availableCount}</span>
          <p className="text-xs text-zinc-500 mt-1">{t.availableNote}</p>
        </div>
      </div>

      {/* Unavailable Card */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-200/80 flex flex-col justify-between">
        <div className="flex justify-between items-start">
          <span className="text-sm font-medium text-zinc-500">{t.unavailable}</span>
          <span className="grid size-8 place-items-center rounded-lg bg-rose-50 text-rose-600">
            <AlertIcon size={18} />
          </span>
        </div>
        <div className="mt-4">
          <span className="text-3xl font-semibold tracking-tight text-zinc-900">{unavailableCount}</span>
          <p className="text-xs text-zinc-500 mt-1">{t.unavailableNote}</p>
        </div>
      </div>
    </div>
  );
}

async function VehicleGrid() {
  const { admin } = await adminDictionary();
  const t = admin.vehicles;
  let allVehicles: Vehicle[] = [];
  try {
    allVehicles = await db.select().from(vehicles);

    if (allVehicles.length === 0) {
      // The fleet as the website shows it (names and keys from lib/fleet/vehicles.ts)
      const defaultFleet = FLEET.map(({ key, name }) => ({ id: key, name, status: "available" }));

      for (const vehicle of defaultFleet) {
        await db.insert(vehicles).values(vehicle).onConflictDoNothing();
      }

      allVehicles = await db.select().from(vehicles);
    }
  } catch (error) {
    console.error("Failed to fetch or seed vehicles:", error);
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">{t.registeredHeader}</h3>
      {allVehicles.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-zinc-200/80 shadow-sm">
          <div className="mx-auto grid size-12 place-items-center rounded-full bg-zinc-100 text-zinc-400 mb-3">
            <CarIcon size={24} />
          </div>
          <h4 className="text-base font-medium text-zinc-900">{t.noVehicles}</h4>
          <p className="text-sm text-zinc-500 mt-1 max-w-sm mx-auto">
            {t.noVehiclesNote}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {allVehicles.map((vehicle) => {
            const isAvailable = vehicle.status === "available";
            return (
              <div
                key={vehicle.id}
                className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-200/80 flex flex-col justify-between space-y-4 hover:border-zinc-300 transition-all"
              >
                <div>
                  <div className="flex justify-between items-start">
                    <span className="font-mono text-xs text-zinc-400 bg-zinc-100 px-2 py-0.5 rounded">
                      {vehicle.id}
                    </span>
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          isAvailable
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                            : "bg-rose-50 text-rose-700 border border-rose-200/60"
                        }`}
                      >
                        {isAvailable ? t.available : t.unavailable}
                      </span>
                      {/* Delete Vehicle Bin Button */}
                      <form action={deleteVehicle}>
                        <input type="hidden" name="id" value={vehicle.id} />
                        <button
                          type="submit"
                          className="grid size-7 place-items-center rounded-lg bg-zinc-50 text-zinc-400 hover:bg-rose-50 hover:text-rose-600 border border-zinc-200/60 transition-colors shadow-2xs"
                          title={t.removeVehicle}
                        >
                          <TrashIcon size={14} />
                        </button>
                      </form>
                    </div>
                  </div>
                  <h4 className="text-lg font-semibold text-zinc-900 mt-3">{vehicle.name}</h4>
                </div>

                <div className="pt-4 border-t border-zinc-100 flex items-center justify-between">
                  <span className="text-xs text-zinc-500">{t.toggleStatus}</span>
                  <form action={toggleVehicleStatus}>
                    <input type="hidden" name="id" value={vehicle.id} />
                    <input type="hidden" name="status" value={vehicle.status} />
                    <button
                      type="submit"
                      className="group relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2"
                      style={{ backgroundColor: isAvailable ? "#10B981" : "#D1D5DB" }}
                      title={t.toggleStatus}
                    >
                      <span className="sr-only">{t.toggleStatus}</span>
                      <span
                        className={`pointer-events-none inline-block size-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                          isAvailable ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </form>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

async function VehiclesContent() {
  // The proxy only sees that a session cookie exists; every admin page proves the session itself. This also stops the
  // cards below (one of which seeds the table on first view) from rendering for anyone who is not signed in.
  await requireAdmin();
  const { admin } = await adminDictionary();
  const t = admin.vehicles;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">{t.title}</h1>
        <p className="text-sm text-zinc-500 mt-1">{t.description}</p>
      </div>

      <VehicleMetrics />

      {/* Add New Vehicle Box (Static & Immediate) */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-200/85">
        <div className="flex items-center gap-2 mb-4">
          <span className="grid size-7 place-items-center rounded-lg bg-black text-white">
            <PlusIcon size={14} />
          </span>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-900">{t.addNew}</h2>
        </div>
        <form action={addVehicle} className="flex flex-col sm:flex-row gap-4">
          <input
            type="text"
            name="name"
            placeholder={t.namePlaceholder}
            required
            className="flex-1 border border-zinc-200 rounded-xl p-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-black/5"
          />
          <button
            type="submit"
            className="bg-black text-white text-xs font-semibold uppercase tracking-wider rounded-xl px-6 py-3 hover:bg-zinc-800 transition-colors shadow-sm whitespace-nowrap"
          >
            {t.addCta}
          </button>
        </form>
      </div>

      <VehicleGrid />
    </div>
  );
}

export default function AdminVehiclesPage() {
  return (
    <Suspense fallback={<div className="p-8 max-w-7xl mx-auto space-y-8 animate-pulse" />}>
      <VehiclesContent />
    </Suspense>
  );
}
