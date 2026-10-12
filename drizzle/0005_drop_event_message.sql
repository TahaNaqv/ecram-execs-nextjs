ALTER TABLE "request_events" ALTER COLUMN "event" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "request_events" DROP COLUMN "message";