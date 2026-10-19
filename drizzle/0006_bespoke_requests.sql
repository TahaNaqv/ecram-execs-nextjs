ALTER TABLE "quote_requests" ALTER COLUMN "collection" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "quote_requests" ALTER COLUMN "destination" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "quote_requests" ALTER COLUMN "pickup_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "quote_requests" ADD COLUMN "entity" text;--> statement-breakpoint
ALTER TABLE "quote_requests" ADD COLUMN "vehicle_class" text;--> statement-breakpoint
ALTER TABLE "quote_requests" ADD COLUMN "itinerary" text;--> statement-breakpoint
ALTER TABLE "quote_requests" ADD COLUMN "contact_preference" text;--> statement-breakpoint
ALTER TABLE "quote_requests" ADD CONSTRAINT "quote_requests_journey_required" CHECK ("quote_requests"."service" = 'bespoke' OR ("quote_requests"."collection" IS NOT NULL AND "quote_requests"."destination" IS NOT NULL AND "quote_requests"."pickup_at" IS NOT NULL));