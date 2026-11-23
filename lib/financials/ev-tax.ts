/**
 * Dutch 2026 tax and running-cost figures for a battery-electric chauffeur car.
 * Bijtelling: 18% of catalogue value up to €30,000, then 22% on the rest.
 * MRB: 30% discount, so 70% of the standard annual tax is payable.
 * BPM: the fixed zero-emission passenger-car amount.
 */

export const BIJTELLING_THRESHOLD_EUR = 30_000;
export const BIJTELLING_LOW_RATE = 0.18;
export const BIJTELLING_HIGH_RATE = 0.22;
export const MRB_PAYABLE_SHARE = 0.7;
export const BPM_ZERO_EMISSION_EUR = 687;

export type EvFinancialInputs = {
  catalogueValue: number;
  purchasePrice: number;
  leaseMonthlyCost: number;
  batteryCapacityKwh: number;
  efficiencyKwhPer100Km: number;
  chargingRateEurPerKwh: number;
  insuranceMonthly: number;
  standardMrbAnnual: number;
  annualKmEstimate: number;
};

export type EvTaxBreakdown = {
  bijtellingLowBase: number;
  bijtellingHighBase: number;
  bijtellingLowAnnual: number;
  bijtellingHighAnnual: number;
  bijtellingAnnual: number;
  bijtellingMonthly: number;
  mrbStandardAnnual: number;
  mrbDiscountAnnual: number;
  mrbPayableAnnual: number;
  mrbPayableMonthly: number;
  bpmOnce: number;
  chargingCostPerKm: number;
  annualChargingCost: number;
  fixedMonthlyOpex: number;
  variableCostPerKm: number;
  annualTco: number;
  monthlyTco: number;
  firstYearTco: number;
  purchasePrice: number;
};

const n = (value: number) => (Number.isFinite(value) && value > 0 ? value : 0);

/** Euro amounts in Dutch notation, for example € 1.234,56. */
export function formatEur(value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(safe);
}

export function computeEvFinancials(input: EvFinancialInputs): EvTaxBreakdown {
  const catalogue = n(input.catalogueValue);
  const lowBase = Math.min(catalogue, BIJTELLING_THRESHOLD_EUR);
  const highBase = Math.max(0, catalogue - BIJTELLING_THRESHOLD_EUR);
  const bijtellingLowAnnual = lowBase * BIJTELLING_LOW_RATE;
  const bijtellingHighAnnual = highBase * BIJTELLING_HIGH_RATE;
  const bijtellingAnnual = bijtellingLowAnnual + bijtellingHighAnnual;

  const mrbStandardAnnual = n(input.standardMrbAnnual);
  const mrbPayableAnnual = mrbStandardAnnual * MRB_PAYABLE_SHARE;
  const mrbDiscountAnnual = mrbStandardAnnual - mrbPayableAnnual;

  const kwhPerKm = n(input.efficiencyKwhPer100Km) / 100;
  const chargingCostPerKm = kwhPerKm * n(input.chargingRateEurPerKwh);
  const annualKm = Math.round(n(input.annualKmEstimate));
  const annualChargingCost = chargingCostPerKm * annualKm;

  const lease = n(input.leaseMonthlyCost);
  const insurance = n(input.insuranceMonthly);
  const fixedMonthlyOpex = lease + insurance + mrbPayableAnnual / 12;
  const annualOperating = fixedMonthlyOpex * 12 + annualChargingCost;

  return {
    bijtellingLowBase: lowBase,
    bijtellingHighBase: highBase,
    bijtellingLowAnnual,
    bijtellingHighAnnual,
    bijtellingAnnual,
    bijtellingMonthly: bijtellingAnnual / 12,
    mrbStandardAnnual,
    mrbDiscountAnnual,
    mrbPayableAnnual,
    mrbPayableMonthly: mrbPayableAnnual / 12,
    bpmOnce: BPM_ZERO_EMISSION_EUR,
    chargingCostPerKm,
    annualChargingCost,
    fixedMonthlyOpex,
    variableCostPerKm: chargingCostPerKm,
    annualTco: annualOperating,
    monthlyTco: annualOperating / 12,
    firstYearTco: annualOperating + BPM_ZERO_EMISSION_EUR,
    purchasePrice: n(input.purchasePrice),
  };
}

const MONEY_KEYS = [
  "bijtellingLowBase",
  "bijtellingHighBase",
  "bijtellingLowAnnual",
  "bijtellingHighAnnual",
  "bijtellingAnnual",
  "bijtellingMonthly",
  "mrbStandardAnnual",
  "mrbDiscountAnnual",
  "mrbPayableAnnual",
  "mrbPayableMonthly",
  "bpmOnce",
  "chargingCostPerKm",
  "annualChargingCost",
  "fixedMonthlyOpex",
  "variableCostPerKm",
  "annualTco",
  "monthlyTco",
  "firstYearTco",
  "purchasePrice",
] as const satisfies readonly (keyof EvTaxBreakdown)[];

export function formatEvTax(metrics: EvTaxBreakdown): Record<(typeof MONEY_KEYS)[number], string> {
  return Object.fromEntries(MONEY_KEYS.map((key) => [key, formatEur(metrics[key])])) as Record<(typeof MONEY_KEYS)[number], string>;
}
