import { z } from "zod";
import type { EvFinancialInputs } from "./ev-tax";

const amount = (max: number) =>
  z.preprocess(
    (value) => (value === "" || value === null || value === undefined ? 0 : value),
    z.coerce.number().finite().min(0).max(max),
  );

export const evFinancialInputSchema = z.object({
  catalogueValue: amount(5_000_000),
  purchasePrice: amount(5_000_000),
  leaseMonthlyCost: amount(100_000),
  batteryCapacityKwh: amount(500),
  efficiencyKwhPer100Km: amount(200),
  chargingRateEurPerKwh: amount(10),
  insuranceMonthly: amount(100_000),
  standardMrbAnnual: amount(100_000),
  annualKmEstimate: z.preprocess(
    (value) => (value === "" || value === null || value === undefined ? 0 : value),
    z.coerce.number().int().min(0).max(500_000),
  ),
  registrationDate: z.preprocess(
    (value) => (value === "" || value === undefined ? null : value),
    z.union([z.string().refine((value) => !Number.isNaN(Date.parse(value)), "Invalid date"), z.null()]),
  ),
});

export type EvFinancialPayload = z.infer<typeof evFinancialInputSchema>;

export function inputsFromPayload(payload: EvFinancialPayload): EvFinancialInputs {
  return {
    catalogueValue: payload.catalogueValue,
    purchasePrice: payload.purchasePrice,
    leaseMonthlyCost: payload.leaseMonthlyCost,
    batteryCapacityKwh: payload.batteryCapacityKwh,
    efficiencyKwhPer100Km: payload.efficiencyKwhPer100Km,
    chargingRateEurPerKwh: payload.chargingRateEurPerKwh,
    insuranceMonthly: payload.insuranceMonthly,
    standardMrbAnnual: payload.standardMrbAnnual,
    annualKmEstimate: payload.annualKmEstimate,
  };
}
