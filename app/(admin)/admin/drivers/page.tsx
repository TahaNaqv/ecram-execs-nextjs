import type { Metadata } from "next";
import { Suspense } from "react";
import { listDrivers } from "@/lib/admin/drivers";
import { formatTimestamp } from "@/lib/admin/format";
import { AdminHeader, AdminHeaderFallback } from "../_components/admin-header";
import { endShift, setDriverActive, startShift } from "./actions";
import { AddDriverForm } from "./add-driver-form";
import { ShiftCountdown } from "./shift-countdown";
import { SubmitButton } from "./submit-button";

export const metadata: Metadata = { title: "Drivers" };

export default function DriversPage() {
  return (
    <>
      <Suspense fallback={<AdminHeaderFallback />}>
        <AdminHeader />
      </Suspense>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Drivers</h1>
        <p className="mt-1 text-sm text-zinc-500">Start a driver&apos;s shift and their 10-hour clock begins counting down.</p>
        <Suspense fallback={<p className="mt-8 text-sm text-zinc-500">Loading drivers…</p>}>
          <Drivers />
        </Suspense>
      </main>
    </>
  );
}

function DriverName({ name, phone }: { name: string; phone: string | null }) {
  return (
    <div className="min-w-0">
      <p className="truncate font-medium">{name}</p>
      {phone && (
        <a href={`tel:${phone.replace(/\s/g, "")}`} className="text-xs text-zinc-500 hover:underline">
          {phone}
        </a>
      )}
    </div>
  );
}

const secondary = "rounded border border-zinc-300 bg-white px-3 py-1.5 text-xs hover:bg-zinc-100";

async function Drivers() {
  const { onShift, offShift, archived } = await listDrivers();

  return (
    <div className="mt-8 flex flex-col gap-10">
      <section>
        <h2 className="mb-3 text-xs font-medium uppercase tracking-widest text-zinc-500">On shift · {onShift.length}</h2>
        {onShift.length === 0 ? (
          <p className="rounded-lg border border-dashed border-zinc-300 px-4 py-8 text-center text-sm text-zinc-500">No drivers on shift.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {onShift.map((r) => (
              <li key={r.id} className="flex flex-col gap-4 rounded-lg border border-zinc-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <DriverName name={r.name} phone={r.phone} />
                  <span className="shrink-0 text-xs text-zinc-500">Started {formatTimestamp(r.shiftStartedAt!)}</span>
                </div>
                <ShiftCountdown startedAt={r.shiftStartedAt!.toISOString()} />
                <form action={endShift}>
                  <input type="hidden" name="driverId" value={r.id} />
                  <SubmitButton pendingText="Ending…" className={secondary}>
                    End shift
                  </SubmitButton>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-xs font-medium uppercase tracking-widest text-zinc-500">Off shift · {offShift.length}</h2>
        <ul className="divide-y divide-zinc-100 rounded-lg border border-zinc-200 bg-white">
          {offShift.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <DriverName name={r.name} phone={r.phone} />
              <div className="flex shrink-0 items-center gap-2">
                <form action={setDriverActive}>
                  <input type="hidden" name="driverId" value={r.id} />
                  <input type="hidden" name="active" value="false" />
                  <SubmitButton pendingText="…" className="px-2 py-1.5 text-xs text-zinc-400 hover:text-zinc-900">
                    Archive
                  </SubmitButton>
                </form>
                <form action={startShift}>
                  <input type="hidden" name="driverId" value={r.id} />
                  <SubmitButton pendingText="Starting…" className="rounded bg-zinc-950 px-3 py-1.5 text-xs text-white hover:bg-zinc-800">
                    Start shift
                  </SubmitButton>
                </form>
              </div>
            </li>
          ))}
          {offShift.length === 0 && <li className="px-4 py-6 text-center text-sm text-zinc-500">Everyone is on shift.</li>}
        </ul>
        <div className="mt-4">
          <AddDriverForm />
        </div>
      </section>

      {archived.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-xs font-medium uppercase tracking-widest text-zinc-500">Archived · {archived.length}</summary>
          <ul className="mt-3 divide-y divide-zinc-100 rounded-lg border border-zinc-200 bg-white">
            {archived.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-3 text-zinc-500">
                <DriverName name={r.name} phone={r.phone} />
                <form action={setDriverActive}>
                  <input type="hidden" name="driverId" value={r.id} />
                  <input type="hidden" name="active" value="true" />
                  <SubmitButton pendingText="Restoring…" className={secondary}>
                    Restore
                  </SubmitButton>
                </form>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
