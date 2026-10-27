ALTER TABLE "corporate_contacts" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "drivers" ADD COLUMN "taxipas_expiry" date;--> statement-breakpoint
ALTER TABLE "drivers" ADD COLUMN "vog_expiry" date;--> statement-breakpoint
ALTER TABLE "drivers" ADD COLUMN "insurance_expiry" date;--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN "vin" text;--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN "license_plate" text;--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN "color" text;--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN "ev_range_km" integer DEFAULT 500 NOT NULL;--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN "battery_soc" integer DEFAULT 85 NOT NULL;--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN "apk_expiry" date;--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN "insurance_expiry" date;--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN "ilt_permit_status" text DEFAULT 'Valid' NOT NULL;