-- 26 Nov 2026 admin bug report: introducer details, a history of the terms, and service dates that hold a car. Safe to run twice.
ALTER TABLE "introducers" ADD COLUMN IF NOT EXISTS "phone" text;--> statement-breakpoint
ALTER TABLE "introducers" ADD COLUMN IF NOT EXISTS "company" text;--> statement-breakpoint
ALTER TABLE "introducers" ADD COLUMN IF NOT EXISTS "notes" text;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "terms_versions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "version" text NOT NULL,
  "body" text NOT NULL,
  "saved_by" uuid REFERENCES "admin_users"("id") ON DELETE set null,
  "saved_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "terms_versions_saved_at_idx" ON "terms_versions" ("saved_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "terms_versions_version_key" ON "terms_versions" ("version");--> statement-breakpoint
INSERT INTO "terms_versions" ("version", "body", "saved_by", "saved_at")
  SELECT coalesce(nullif("value"->>'version', ''), '1'), coalesce("value"->>'body', ''), "updated_by", "updated_at" FROM "app_settings"
  WHERE "key" = 'terms_en' AND coalesce("value"->>'body', '') <> '' AND NOT EXISTS (SELECT 1 FROM "terms_versions");--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vehicle_services" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "vehicle_id" text NOT NULL REFERENCES "vehicles"("id") ON DELETE cascade,
  "service_type" text NOT NULL,
  "service_date" date NOT NULL,
  "notes" text,
  "created_by" uuid REFERENCES "admin_users"("id") ON DELETE set null,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vehicle_services_date_idx" ON "vehicle_services" ("service_date");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "vehicle_services_vehicle_day_key" ON "vehicle_services" ("vehicle_id", "service_date");
