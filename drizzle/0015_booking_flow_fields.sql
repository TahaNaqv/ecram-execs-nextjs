ALTER TABLE "quote_requests" DROP CONSTRAINT "quote_requests_journey_required";--> statement-breakpoint
ALTER TABLE "quote_requests" ADD COLUMN "luggage" integer;--> statement-breakpoint
ALTER TABLE "quote_requests" ADD COLUMN "flight_number" text;--> statement-breakpoint
ALTER TABLE "quote_requests" ADD COLUMN "duration_hours" integer;--> statement-breakpoint
ALTER TABLE "quote_requests" ADD COLUMN "return_at" timestamp;--> statement-breakpoint
ALTER TABLE "quote_requests" ADD COLUMN "passenger_name" text;--> statement-breakpoint
ALTER TABLE "quote_requests" ADD COLUMN "passenger_phone" text;--> statement-breakpoint
ALTER TABLE "quote_requests" ADD COLUMN "pickup_place_id" text;--> statement-breakpoint
ALTER TABLE "quote_requests" ADD COLUMN "destination_place_id" text;--> statement-breakpoint
ALTER TABLE "quote_requests" ADD CONSTRAINT "quote_requests_journey_required" CHECK ("quote_requests"."service" = 'bespoke' OR ("quote_requests"."collection" IS NOT NULL AND "quote_requests"."pickup_at" IS NOT NULL AND ("quote_requests"."destination" IS NOT NULL OR ("quote_requests"."service" = 'hourly' AND "quote_requests"."duration_hours" IS NOT NULL))));
