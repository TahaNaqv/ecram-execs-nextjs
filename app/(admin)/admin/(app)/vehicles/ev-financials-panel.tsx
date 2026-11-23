"use client";

import { useMemo, useState } from "react";
import { computeEvFinancials, formatEur, type EvFinancialInputs } from "@/lib/financials/ev-tax";
import { btn, Card, field, fieldLabel } from "../../_components/ui";

export type EvVehicleOption = { id: string; name: string; licensePlate: string | null };

export type EvFinancialCopy = {
  vehicle: string;
  noVehicles: string;
  catalogueValue: string;
  purchasePrice: string;
  leaseMonthly: string;
  ownership: string;
  leased: string;
  owned: string;
  efficiency: string;
  chargingRate: string;
  insuranceMonthly: string;
  mrbStandard: string;
  annualKm: string;
  save: string;
  saving: string;
  saved: string;
  saveFailed: string;
  loadFailed: string;
  suggested: string;
  details: string;
  taxYear: string;
  taxMonth: string;
  mrbPayable: string;
  bpm: string;
  perKm: string;
  annualEnergy: string;
  fixedMonthly: string;
  monthCost: string;
  kmCost: string;
};

type Draft = {
  owned: boolean;
  catalogueValue: string;
  purchasePrice: string;
  leaseMonthlyCost: string;
  batteryCapacityKwh: string;
  efficiencyKwhPer100Km: string;
  chargingRateEurPerKwh: string;
  insuranceMonthly: string;
  standardMrbAnnual: string;
  annualKmEstimate: string;
  registrationDate: string;
};

export type EvFinancialSeed = {
  vehicleId: string;
  saved: boolean;
  registrationDate: string | null;
  inputs: EvFinancialInputs;
};

const text = (value: number) => (value ? String(value) : "");

function draftFromSeed(seed: EvFinancialSeed | undefined): Draft {
  if (!seed?.saved) {
    return {
      owned: false,
      catalogueValue: "",
      purchasePrice: "",
      leaseMonthlyCost: "",
      batteryCapacityKwh: "",
      efficiencyKwhPer100Km: "18",
      chargingRateEurPerKwh: "0.35",
      insuranceMonthly: "",
      standardMrbAnnual: "",
      annualKmEstimate: "30000",
      registrationDate: "",
    };
  }
  return {
    owned: seed.inputs.leaseMonthlyCost <= 0 && seed.inputs.purchasePrice > 0,
    catalogueValue: text(seed.inputs.catalogueValue),
    purchasePrice: text(seed.inputs.purchasePrice),
    leaseMonthlyCost: text(seed.inputs.leaseMonthlyCost),
    batteryCapacityKwh: text(seed.inputs.batteryCapacityKwh),
    efficiencyKwhPer100Km: text(seed.inputs.efficiencyKwhPer100Km) || "18",
    chargingRateEurPerKwh: text(seed.inputs.chargingRateEurPerKwh) || "0.35",
    insuranceMonthly: text(seed.inputs.insuranceMonthly),
    standardMrbAnnual: text(seed.inputs.standardMrbAnnual),
    annualKmEstimate: text(seed.inputs.annualKmEstimate) || "30000",
    registrationDate: seed.registrationDate ? seed.registrationDate.slice(0, 10) : "",
  };
}

function parseAmount(value: string) {
  const parsed = Number(value.trim().replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function toInputs(draft: Draft): EvFinancialInputs {
  return {
    catalogueValue: parseAmount(draft.catalogueValue),
    purchasePrice: draft.owned ? parseAmount(draft.purchasePrice) : 0,
    leaseMonthlyCost: draft.owned ? 0 : parseAmount(draft.leaseMonthlyCost),
    batteryCapacityKwh: parseAmount(draft.batteryCapacityKwh),
    efficiencyKwhPer100Km: parseAmount(draft.efficiencyKwhPer100Km),
    chargingRateEurPerKwh: parseAmount(draft.chargingRateEurPerKwh),
    insuranceMonthly: parseAmount(draft.insuranceMonthly),
    standardMrbAnnual: parseAmount(draft.standardMrbAnnual),
    annualKmEstimate: Math.round(parseAmount(draft.annualKmEstimate)),
  };
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-zinc-100 py-2 last:border-0">
      <dt className="text-[13px] text-zinc-500">{label}</dt>
      <dd className="m-0 text-sm font-medium tabular-nums text-zinc-950">{value}</dd>
    </div>
  );
}

export function EvFinancialsPanel({
  vehicles,
  records,
  copy,
  loadError = false,
}: {
  vehicles: EvVehicleOption[];
  records: EvFinancialSeed[];
  copy: EvFinancialCopy;
  loadError?: boolean;
}) {
  const [vehicleId, setVehicleId] = useState(vehicles[0]?.id ?? "");
  const [savedIds, setSavedIds] = useState(() => new Set(records.filter((row) => row.saved).map((row) => row.vehicleId)));
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() => Object.fromEntries(records.map((row) => [row.vehicleId, draftFromSeed(row)])));
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const draft = drafts[vehicleId] ?? draftFromSeed(undefined);
  const metrics = useMemo(() => computeEvFinancials(toInputs(draft)), [draft]);
  const usingSuggestion = !savedIds.has(vehicleId);

  const setField = (key: keyof Draft, value: string | boolean) => {
    setDrafts((current) => ({ ...current, [vehicleId]: { ...(current[vehicleId] ?? draftFromSeed(undefined)), [key]: value } }));
    setNotice(null);
  };

  const save = async () => {
    if (!vehicleId) return;
    setPending(true);
    setNotice(null);
    const inputs = toInputs(draft);
    const body = { ...inputs, registrationDate: draft.registrationDate || null };
    const method = savedIds.has(vehicleId) ? "PATCH" : "POST";
    try {
      let response = await fetch(`/api/admin/vehicles/${vehicleId}/financials`, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (response.status === 409 || (response.status === 404 && method === "PATCH")) {
        response = await fetch(`/api/admin/vehicles/${vehicleId}/financials`, {
          method: response.status === 409 ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
      }
      if (!response.ok) {
        setNotice({ ok: false, text: copy.saveFailed });
        return;
      }
      setSavedIds((current) => new Set(current).add(vehicleId));
      setNotice({ ok: true, text: copy.saved });
    } catch (error) {
      console.error("[ev-financials] save failed", error);
      setNotice({ ok: false, text: copy.saveFailed });
    } finally {
      setPending(false);
    }
  };

  if (loadError) {
    return <p className="mt-6 text-sm text-red-700" role="alert">{copy.loadFailed}</p>;
  }
  if (vehicles.length === 0) {
    return <p className="mt-6 text-sm text-zinc-600">{copy.noVehicles}</p>;
  }

  return (
    <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <Card>
        <form
          className="flex flex-col gap-4 p-5"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <label className="flex flex-col gap-1.5">
            <span className={fieldLabel}>{copy.vehicle}</span>
            <select
              value={vehicleId}
              onChange={(event) => {
                setVehicleId(event.target.value);
                setNotice(null);
              }}
              className={`${field} h-10`}
            >
              {vehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicle.licensePlate ? `${vehicle.name} · ${vehicle.licensePlate}` : vehicle.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className={fieldLabel}>{copy.catalogueValue}</span>
            <input inputMode="decimal" value={draft.catalogueValue} onChange={(event) => setField("catalogueValue", event.target.value)} className={`${field} h-10`} placeholder="80000" />
          </label>

          <fieldset className="flex flex-col gap-2">
            <legend className={fieldLabel}>{copy.ownership}</legend>
            <div className="inline-flex w-fit rounded-lg border border-zinc-200 bg-zinc-50 p-0.5">
              {([false, true] as const).map((owned) => (
                <button
                  key={owned ? "owned" : "leased"}
                  type="button"
                  aria-pressed={draft.owned === owned}
                  onClick={() => setField("owned", owned)}
                  className={`h-8 rounded-md px-3 text-[13px] font-medium ${draft.owned === owned ? "bg-white text-zinc-950 shadow-card" : "text-zinc-500"}`}
                >
                  {owned ? copy.owned : copy.leased}
                </button>
              ))}
            </div>
            <label className="flex flex-col gap-1.5">
              <span className={fieldLabel}>{draft.owned ? copy.purchasePrice : copy.leaseMonthly}</span>
              <input
                inputMode="decimal"
                value={draft.owned ? draft.purchasePrice : draft.leaseMonthlyCost}
                onChange={(event) => setField(draft.owned ? "purchasePrice" : "leaseMonthlyCost", event.target.value)}
                className={`${field} h-10`}
                placeholder={draft.owned ? "75000" : "900"}
              />
            </label>
          </fieldset>

          <label className="flex flex-col gap-1.5">
            <span className={fieldLabel}>{copy.annualKm}</span>
            <input inputMode="numeric" value={draft.annualKmEstimate} onChange={(event) => setField("annualKmEstimate", event.target.value)} className={`${field} h-10`} />
          </label>

          <details className="rounded-lg border border-zinc-200 px-3 py-2">
            <summary className="cursor-pointer text-[13px] font-medium text-zinc-800">{copy.details}</summary>
            <div className="mt-3 flex flex-col gap-3 pb-1">
              {(
                [
                  ["insuranceMonthly", copy.insuranceMonthly],
                  ["standardMrbAnnual", copy.mrbStandard],
                  ["chargingRateEurPerKwh", copy.chargingRate],
                  ["efficiencyKwhPer100Km", copy.efficiency],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="flex flex-col gap-1.5">
                  <span className={fieldLabel}>{label}</span>
                  <input inputMode="decimal" value={draft[key]} onChange={(event) => setField(key, event.target.value)} className={`${field} h-10`} />
                </label>
              ))}
            </div>
          </details>

          {usingSuggestion && <p className="m-0 text-xs text-zinc-500">{copy.suggested}</p>}

          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" disabled={pending} className={`${btn.base} ${btn.primary} ${btn.md}`}>
              {pending ? copy.saving : copy.save}
            </button>
            {notice && (
              <p role={notice.ok ? "status" : "alert"} className={`m-0 text-sm ${notice.ok ? "text-emerald-700" : "text-red-700"}`}>
                {notice.text}
              </p>
            )}
          </div>
        </form>
      </Card>

      <Card>
        <div className="grid grid-cols-1 divide-y divide-zinc-100 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {(
            [
              [copy.monthCost, metrics.monthlyTco],
              [copy.kmCost, metrics.variableCostPerKm],
              [copy.taxMonth, metrics.bijtellingMonthly],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="px-5 py-4">
              <p className="text-xs text-zinc-500">{label}</p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-zinc-950">{formatEur(value)}</p>
            </div>
          ))}
        </div>
        <dl className="px-5 pb-3">
          <Line label={copy.taxYear} value={formatEur(metrics.bijtellingAnnual)} />
          <Line label={copy.mrbPayable} value={formatEur(metrics.mrbPayableAnnual)} />
          <Line label={copy.bpm} value={formatEur(metrics.bpmOnce)} />
          <Line label={copy.perKm} value={formatEur(metrics.chargingCostPerKm)} />
          <Line label={copy.annualEnergy} value={formatEur(metrics.annualChargingCost)} />
          <Line label={copy.fixedMonthly} value={formatEur(metrics.fixedMonthlyOpex)} />
        </dl>
      </Card>
    </div>
  );
}
