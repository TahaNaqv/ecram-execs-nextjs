ALTER TABLE "corporate_challenges" ADD COLUMN IF NOT EXISTS "purpose" text DEFAULT 'signup' NOT NULL;--> statement-breakpoint
ALTER TABLE "corporate_contacts" ADD COLUMN IF NOT EXISTS "password_hash" text;--> statement-breakpoint
ALTER TABLE "corporate_contacts" ADD COLUMN IF NOT EXISTS "password_set_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "corporate_contacts" ADD COLUMN IF NOT EXISTS "failed_logins" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "corporate_contacts" ADD COLUMN IF NOT EXISTS "locked_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "corporate_contacts" ADD COLUMN IF NOT EXISTS "last_login_at" timestamp with time zone;