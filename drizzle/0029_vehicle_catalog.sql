ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "images" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "seats" integer;--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "luggage" integer;--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "rate_weekday" integer;--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "rate_saturday" integer;--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "rate_sunday" integer;--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "listed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "vehicles" DROP CONSTRAINT IF EXISTS "vehicles_seats_range";--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_seats_range" CHECK ("seats" is null or "seats" between 1 and 14);--> statement-breakpoint
ALTER TABLE "vehicles" DROP CONSTRAINT IF EXISTS "vehicles_luggage_range";--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_luggage_range" CHECK ("luggage" is null or "luggage" between 0 and 30);--> statement-breakpoint
ALTER TABLE "vehicles" DROP CONSTRAINT IF EXISTS "vehicles_rates_nonneg";--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_rates_nonneg" CHECK (("rate_weekday" is null or "rate_weekday" >= 0) and ("rate_saturday" is null or "rate_saturday" >= 0) and ("rate_sunday" is null or "rate_sunday" >= 0));
