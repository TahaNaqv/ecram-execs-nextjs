-- Driver profiles (the client, 28 Nov 2026): every compliance, licensing and role detail, for agency drivers (our cars)
-- and freelance / ZZP drivers (their own cars). Auto-suspension is worked out from the dates, not stored.
ALTER TABLE "drivers" ADD COLUMN IF NOT EXISTS "email" text;--> statement-breakpoint
ALTER TABLE "drivers" ADD COLUMN IF NOT EXISTS "address" text;--> statement-breakpoint
ALTER TABLE "drivers" ADD COLUMN IF NOT EXISTS "date_of_birth" date;--> statement-breakpoint
ALTER TABLE "drivers" ADD COLUMN IF NOT EXISTS "emergency_name" text;--> statement-breakpoint
ALTER TABLE "drivers" ADD COLUMN IF NOT EXISTS "emergency_phone" text;--> statement-breakpoint
ALTER TABLE "drivers" ADD COLUMN IF NOT EXISTS "driver_type" text NOT NULL DEFAULT 'agency';--> statement-breakpoint
ALTER TABLE "drivers" ADD COLUMN IF NOT EXISTS "account_status" text NOT NULL DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "drivers" ADD COLUMN IF NOT EXISTS "status_note" text;--> statement-breakpoint
ALTER TABLE "drivers" ADD COLUMN IF NOT EXISTS "languages" jsonb NOT NULL DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "drivers" ADD COLUMN IF NOT EXISTS "bio" text;--> statement-breakpoint
ALTER TABLE "drivers" ADD COLUMN IF NOT EXISTS "security_trained" boolean NOT NULL DEFAULT false;--> statement-breakpoint
ALTER TABLE "drivers" ADD COLUMN IF NOT EXISTS "licence_number" text;--> statement-breakpoint
ALTER TABLE "drivers" ADD COLUMN IF NOT EXISTS "licence_country" text;--> statement-breakpoint
ALTER TABLE "drivers" ADD COLUMN IF NOT EXISTS "licence_expiry" date;--> statement-breakpoint
ALTER TABLE "drivers" ADD COLUMN IF NOT EXISTS "cat_b" boolean NOT NULL DEFAULT false;--> statement-breakpoint
ALTER TABLE "drivers" ADD COLUMN IF NOT EXISTS "cat_be_code96" boolean NOT NULL DEFAULT false;--> statement-breakpoint
ALTER TABLE "drivers" ADD COLUMN IF NOT EXISTS "cat_d_code95" boolean NOT NULL DEFAULT false;--> statement-breakpoint
ALTER TABLE "drivers" ADD COLUMN IF NOT EXISTS "code95_expiry" date;--> statement-breakpoint
ALTER TABLE "drivers" ADD COLUMN IF NOT EXISTS "no_private_codes" boolean NOT NULL DEFAULT false;--> statement-breakpoint
ALTER TABLE "drivers" ADD COLUMN IF NOT EXISTS "kiwa_card_number" text;--> statement-breakpoint
ALTER TABLE "drivers" ADD COLUMN IF NOT EXISTS "kiwa_card_type" text;--> statement-breakpoint
ALTER TABLE "drivers" ADD COLUMN IF NOT EXISTS "cdt_checked_on" date;--> statement-breakpoint
ALTER TABLE "drivers" ADD COLUMN IF NOT EXISTS "vog_issued_on" date;--> statement-breakpoint
ALTER TABLE "drivers" ADD COLUMN IF NOT EXISTS "vog_verified" boolean NOT NULL DEFAULT false;--> statement-breakpoint
ALTER TABLE "drivers" ADD COLUMN IF NOT EXISTS "medical_status" text NOT NULL DEFAULT 'missing';--> statement-breakpoint
ALTER TABLE "drivers" ADD COLUMN IF NOT EXISTS "agency_name" text;--> statement-breakpoint
ALTER TABLE "drivers" ADD COLUMN IF NOT EXISTS "agency_contact" text;--> statement-breakpoint
ALTER TABLE "drivers" ADD COLUMN IF NOT EXISTS "agency_contract_ref" text;--> statement-breakpoint
ALTER TABLE "drivers" ADD COLUMN IF NOT EXISTS "agency_rate_tier" text;--> statement-breakpoint
ALTER TABLE "drivers" ADD COLUMN IF NOT EXISTS "timesheet_id" text;--> statement-breakpoint
ALTER TABLE "drivers" ADD COLUMN IF NOT EXISTS "ev_induction" boolean NOT NULL DEFAULT false;--> statement-breakpoint
ALTER TABLE "drivers" ADD COLUMN IF NOT EXISTS "trailer_induction" boolean NOT NULL DEFAULT false;--> statement-breakpoint
ALTER TABLE "drivers" ADD COLUMN IF NOT EXISTS "authorised_models" jsonb NOT NULL DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "drivers" ADD COLUMN IF NOT EXISTS "trade_name" text;--> statement-breakpoint
ALTER TABLE "drivers" ADD COLUMN IF NOT EXISTS "kvk" text;--> statement-breakpoint
ALTER TABLE "drivers" ADD COLUMN IF NOT EXISTS "btw_id" text;--> statement-breakpoint
ALTER TABLE "drivers" ADD COLUMN IF NOT EXISTS "iban" text;--> statement-breakpoint
ALTER TABLE "drivers" ADD COLUMN IF NOT EXISTS "permit_number" text;--> statement-breakpoint
ALTER TABLE "drivers" ADD COLUMN IF NOT EXISTS "permit_expiry" date;--> statement-breakpoint
ALTER TABLE "drivers" ADD COLUMN IF NOT EXISTS "ondernemerskaart_number" text;--> statement-breakpoint
ALTER TABLE "drivers" ADD COLUMN IF NOT EXISTS "ondernemerskaart_expiry" date;--> statement-breakpoint
ALTER TABLE "drivers" ADD COLUMN IF NOT EXISTS "insurer" text;--> statement-breakpoint
ALTER TABLE "drivers" ADD COLUMN IF NOT EXISTS "insurance_policy" text;--> statement-breakpoint
ALTER TABLE "drivers" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone NOT NULL DEFAULT now();--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "drivers" ADD CONSTRAINT "drivers_type_known" CHECK ("driver_type" in ('agency', 'freelance'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "drivers" ADD CONSTRAINT "drivers_status_known" CHECK ("account_status" in ('active', 'pending', 'suspended'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "drivers" ADD CONSTRAINT "drivers_medical_known" CHECK ("medical_status" in ('missing', 'submitted', 'approved'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "drivers" ADD CONSTRAINT "drivers_kiwa_type_known" CHECK ("kiwa_card_type" is null or "kiwa_card_type" in ('full', 'limited'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
-- Partner drivers (approved applicants with their own car) are the freelancers
UPDATE "drivers" SET "driver_type" = 'freelance' WHERE "partner" = true AND "driver_type" = 'agency';--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "driver_documents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "driver_id" uuid NOT NULL REFERENCES "drivers"("id") ON DELETE CASCADE,
  "kind" text NOT NULL,
  "path" text NOT NULL UNIQUE,
  "file_name" text NOT NULL,
  "size" integer NOT NULL,
  "content_type" text NOT NULL,
  "uploaded_by" uuid REFERENCES "admin_users"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "driver_documents_kind_known" CHECK ("kind" in ('photo', 'kiwafront', 'kiwaback', 'zzpagreement', 'permit', 'ondernemerskaart', 'insurance'))
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "driver_documents_driver_kind_idx" ON "driver_documents" ("driver_id", "kind");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "driver_documents_uploaded_by_idx" ON "driver_documents" ("uploaded_by");--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "driver_vehicles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "driver_id" uuid NOT NULL REFERENCES "drivers"("id") ON DELETE CASCADE,
  "make" text NOT NULL,
  "model" text,
  "colour" text,
  "plate" text NOT NULL,
  "passengers" integer,
  "luggage" integer,
  "apk_expiry" date,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "driver_vehicles_driver_idx" ON "driver_vehicles" ("driver_id");
