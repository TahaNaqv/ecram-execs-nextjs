CREATE TABLE IF NOT EXISTS "vehicle_financials" (
  "vehicle_id" text PRIMARY KEY NOT NULL REFERENCES "vehicles"("id") ON DELETE CASCADE,
  "catalogue_value" numeric(12, 2) DEFAULT '0' NOT NULL,
  "purchase_price" numeric(12, 2) DEFAULT '0' NOT NULL,
  "lease_monthly_cost" numeric(12, 2) DEFAULT '0' NOT NULL,
  "battery_capacity_kwh" numeric(8, 2) DEFAULT '0' NOT NULL,
  "efficiency_kwh_per_100km" numeric(8, 2) DEFAULT '0' NOT NULL,
  "charging_rate_eur_per_kwh" numeric(8, 4) DEFAULT '0' NOT NULL,
  "insurance_monthly" numeric(12, 2) DEFAULT '0' NOT NULL,
  "standard_mrb_annual" numeric(12, 2) DEFAULT '0' NOT NULL,
  "annual_km_estimate" integer DEFAULT 0 NOT NULL,
  "registration_date" timestamp with time zone,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "vehicle_financials" DROP CONSTRAINT IF EXISTS "vehicle_financials_nonneg";--> statement-breakpoint
ALTER TABLE "vehicle_financials" ADD CONSTRAINT "vehicle_financials_nonneg" CHECK (
  "catalogue_value" >= 0
  AND "purchase_price" >= 0
  AND "lease_monthly_cost" >= 0
  AND "battery_capacity_kwh" >= 0
  AND "efficiency_kwh_per_100km" >= 0
  AND "charging_rate_eur_per_kwh" >= 0
  AND "insurance_monthly" >= 0
  AND "standard_mrb_annual" >= 0
  AND "annual_km_estimate" >= 0
);
