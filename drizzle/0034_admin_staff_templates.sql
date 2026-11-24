ALTER TABLE "admin_users" ADD COLUMN IF NOT EXISTS "role" text DEFAULT 'staff' NOT NULL;--> statement-breakpoint
ALTER TABLE "admin_users" ADD COLUMN IF NOT EXISTS "permissions" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "admin_users" DROP CONSTRAINT IF EXISTS "admin_users_role";--> statement-breakpoint
ALTER TABLE "admin_users" ADD CONSTRAINT "admin_users_role" CHECK ("role" in ('owner', 'manager', 'staff'));--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "admin_password_resets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "admin_id" uuid NOT NULL REFERENCES "admin_users"("id") ON DELETE CASCADE,
  "token_hash" text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "used_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "admin_password_resets_token_hash_unique" UNIQUE("token_hash")
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "admin_password_resets_admin_idx" ON "admin_password_resets" ("admin_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "admin_password_resets_expires_idx" ON "admin_password_resets" ("expires_at");--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "email_templates" (
  "key" text PRIMARY KEY NOT NULL,
  "subject" text NOT NULL,
  "body" text NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_by" uuid REFERENCES "admin_users"("id") ON DELETE SET NULL
);--> statement-breakpoint
ALTER TABLE "quote_requests" ADD COLUMN IF NOT EXISTS "invoice_terms_days" integer;--> statement-breakpoint
ALTER TABLE "quote_requests" DROP CONSTRAINT IF EXISTS "quote_requests_invoice_terms";--> statement-breakpoint
ALTER TABLE "quote_requests" ADD CONSTRAINT "quote_requests_invoice_terms" CHECK ("invoice_terms_days" is null or "invoice_terms_days" in (7, 14, 30));
