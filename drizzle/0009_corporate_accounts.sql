ALTER TABLE "corporate_challenges" ADD COLUMN "purpose" text DEFAULT 'signup' NOT NULL;--> statement-breakpoint
ALTER TABLE "corporate_contacts" ADD COLUMN "password_hash" text;--> statement-breakpoint
ALTER TABLE "corporate_contacts" ADD COLUMN "password_set_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "corporate_contacts" ADD COLUMN "failed_logins" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "corporate_contacts" ADD COLUMN "locked_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "corporate_contacts" ADD COLUMN "last_login_at" timestamp with time zone;