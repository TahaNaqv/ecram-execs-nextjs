ALTER TABLE "quote_requests" ADD COLUMN IF NOT EXISTS "hear_about" text;
ALTER TABLE "quote_requests" ADD COLUMN IF NOT EXISTS "marketing_consent" boolean DEFAULT false NOT NULL;
ALTER TABLE "quote_requests" ADD COLUMN IF NOT EXISTS "terms_version" text;
ALTER TABLE "quote_requests" ADD COLUMN IF NOT EXISTS "close_protection" boolean DEFAULT false NOT NULL;
ALTER TABLE "quote_requests" ADD COLUMN IF NOT EXISTS "security_notes" text;

ALTER TABLE "admin_users" ADD COLUMN IF NOT EXISTS "totp_secret" text;
ALTER TABLE "admin_users" ADD COLUMN IF NOT EXISTS "totp_enabled" boolean DEFAULT false NOT NULL;

ALTER TABLE "driver_shifts" ADD COLUMN IF NOT EXISTS "vehicle_id" text;
ALTER TABLE "driver_shifts" ADD COLUMN IF NOT EXISTS "break_minutes" integer DEFAULT 0 NOT NULL;

CREATE TABLE IF NOT EXISTS "introducers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "email" text,
  "commission_percent" integer DEFAULT 10 NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "corporate_contacts" ADD COLUMN IF NOT EXISTS "preferred_contact" text;
ALTER TABLE "corporate_contacts" ADD COLUMN IF NOT EXISTS "payment_terms_days" integer;
ALTER TABLE "corporate_contacts" ADD COLUMN IF NOT EXISTS "preferences" text;
ALTER TABLE "corporate_contacts" ADD COLUMN IF NOT EXISTS "account_manager_id" uuid;
ALTER TABLE "corporate_contacts" ADD COLUMN IF NOT EXISTS "introducer_id" uuid;
ALTER TABLE "corporate_contacts" ADD COLUMN IF NOT EXISTS "archived_at" timestamp with time zone;

DO $$ BEGIN
  ALTER TABLE "corporate_contacts" ADD CONSTRAINT "corporate_contacts_account_manager_id_admin_users_id_fk" FOREIGN KEY ("account_manager_id") REFERENCES "admin_users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "corporate_contacts" ADD CONSTRAINT "corporate_contacts_introducer_id_introducers_id_fk" FOREIGN KEY ("introducer_id") REFERENCES "introducers"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TABLE "corporate_contacts" DROP CONSTRAINT IF EXISTS "corporate_contacts_payment_terms";
ALTER TABLE "corporate_contacts" ADD CONSTRAINT "corporate_contacts_payment_terms" CHECK ("payment_terms_days" is null or "payment_terms_days" in (7, 14, 30));
ALTER TABLE "corporate_contacts" DROP CONSTRAINT IF EXISTS "corporate_contacts_preferred";
ALTER TABLE "corporate_contacts" ADD CONSTRAINT "corporate_contacts_preferred" CHECK ("preferred_contact" is null or "preferred_contact" in ('email', 'phone', 'whatsapp'));

CREATE TABLE IF NOT EXISTS "corporate_bookers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "contact_id" uuid NOT NULL REFERENCES "corporate_contacts"("id") ON DELETE cascade,
  "name" text NOT NULL,
  "email" text,
  "phone" text,
  "position" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "corporate_bookers_contact_idx" ON "corporate_bookers" ("contact_id");

CREATE TABLE IF NOT EXISTS "corporate_audit" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "contact_id" uuid NOT NULL REFERENCES "corporate_contacts"("id") ON DELETE cascade,
  "admin_id" uuid REFERENCES "admin_users"("id") ON DELETE set null,
  "field" text NOT NULL,
  "before" text,
  "after" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "corporate_audit_contact_idx" ON "corporate_audit" ("contact_id", "created_at");

CREATE TABLE IF NOT EXISTS "addon_suppliers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "email" text,
  "phone" text,
  "notes" text
);
CREATE TABLE IF NOT EXISTS "addon_stock" (
  "key" text PRIMARY KEY NOT NULL,
  "on_hand" integer DEFAULT 0 NOT NULL,
  "supplier_id" uuid REFERENCES "addon_suppliers"("id") ON DELETE set null
);
INSERT INTO "addon_stock" ("key", "on_hand") VALUES ('champagne', 0), ('chocolates', 0), ('flowers', 0), ('newspapers', 0)
ON CONFLICT ("key") DO NOTHING;

ALTER TABLE "concierge_conversations" ADD COLUMN IF NOT EXISTS "visitor_name" text;
ALTER TABLE "concierge_conversations" ADD COLUMN IF NOT EXISTS "visitor_email" text;
ALTER TABLE "concierge_conversations" ADD COLUMN IF NOT EXISTS "follow_up" boolean DEFAULT false NOT NULL;
ALTER TABLE "concierge_conversations" ADD COLUMN IF NOT EXISTS "channel" text DEFAULT 'web' NOT NULL;
