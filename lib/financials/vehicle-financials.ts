import "server-only";

import { eq } from "drizzle-orm";
import { cache } from "react";
import { db, schema } from "@/lib/db";
import type { VehicleFinancial } from "@/lib/db/schema";
import { computeEvFinancials, formatEvTax, type EvFinancialInputs, type EvTaxBreakdown } from "./ev-tax";
import { inputsFromPayload, type EvFinancialPayload } from "./ev-input";

export type VehicleFinancialView = {
  vehicleId: string;
  saved: boolean;
  registrationDate: string | null;
  inputs: EvFinancialInputs;
  metrics: EvTaxBreakdown;
  formatted: ReturnType<typeof formatEvTax>;
  updatedAt: string | null;
};

const num = (value: string | number | null | undefined) => {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

export function viewFromRow(row: VehicleFinancial | null, vehicleId: string): VehicleFinancialView {
  const inputs: EvFinancialInputs = row
    ? {
        catalogueValue: num(row.catalogueValue),
        purchasePrice: num(row.purchasePrice),
        leaseMonthlyCost: num(row.leaseMonthlyCost),
        batteryCapacityKwh: num(row.batteryCapacityKwh),
        efficiencyKwhPer100Km: num(row.efficiencyKwhPer100Km),
        chargingRateEurPerKwh: num(row.chargingRateEurPerKwh),
        insuranceMonthly: num(row.insuranceMonthly),
        standardMrbAnnual: num(row.standardMrbAnnual),
        annualKmEstimate: row.annualKmEstimate,
      }
    : {
        catalogueValue: 0,
        purchasePrice: 0,
        leaseMonthlyCost: 0,
        batteryCapacityKwh: 0,
        efficiencyKwhPer100Km: 0,
        chargingRateEurPerKwh: 0,
        insuranceMonthly: 0,
        standardMrbAnnual: 0,
        annualKmEstimate: 0,
      };
  const metrics = computeEvFinancials(inputs);
  return {
    vehicleId,
    saved: row !== null,
    registrationDate: row?.registrationDate ? row.registrationDate.toISOString() : null,
    inputs,
    metrics,
    formatted: formatEvTax(metrics),
    updatedAt: row?.updatedAt ? row.updatedAt.toISOString() : null,
  };
}

const money = (value: number, digits: number) => value.toFixed(digits);

function rowValues(vehicleId: string, payload: EvFinancialPayload) {
  return {
    vehicleId,
    catalogueValue: money(payload.catalogueValue, 2),
    purchasePrice: money(payload.purchasePrice, 2),
    leaseMonthlyCost: money(payload.leaseMonthlyCost, 2),
    batteryCapacityKwh: money(payload.batteryCapacityKwh, 2),
    efficiencyKwhPer100Km: money(payload.efficiencyKwhPer100Km, 2),
    chargingRateEurPerKwh: money(payload.chargingRateEurPerKwh, 4),
    insuranceMonthly: money(payload.insuranceMonthly, 2),
    standardMrbAnnual: money(payload.standardMrbAnnual, 2),
    annualKmEstimate: payload.annualKmEstimate,
    registrationDate: payload.registrationDate ? new Date(payload.registrationDate) : null,
    updatedAt: new Date(),
  };
}

export const listVehicleFinancials = cache(async () => {
  return db.select().from(schema.vehicleFinancials);
});

export async function getVehicleFinancial(vehicleId: string) {
  const [row] = await db.select().from(schema.vehicleFinancials).where(eq(schema.vehicleFinancials.vehicleId, vehicleId)).limit(1);
  return row ?? null;
}

export async function vehicleExists(vehicleId: string) {
  const [row] = await db.select({ id: schema.vehicles.id }).from(schema.vehicles).where(eq(schema.vehicles.id, vehicleId)).limit(1);
  return Boolean(row);
}

export async function createVehicleFinancial(vehicleId: string, payload: EvFinancialPayload) {
  const [row] = await db.insert(schema.vehicleFinancials).values(rowValues(vehicleId, payload)).returning();
  return row;
}

export async function updateVehicleFinancial(vehicleId: string, payload: EvFinancialPayload) {
  const [row] = await db
    .update(schema.vehicleFinancials)
    .set(rowValues(vehicleId, payload))
    .where(eq(schema.vehicleFinancials.vehicleId, vehicleId))
    .returning();
  return row ?? null;
}

export function metricsFor(payload: EvFinancialPayload) {
  const inputs = inputsFromPayload(payload);
  const metrics = computeEvFinancials(inputs);
  return { inputs, metrics, formatted: formatEvTax(metrics) };
}
