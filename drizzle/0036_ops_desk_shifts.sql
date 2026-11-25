-- What lib/db/schema.ts gained on 25 Nov 2026 that 0035 does not create. Safe to run twice.
ALTER TABLE "driver_shifts" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
UPDATE "driver_shifts" SET "status" = CASE WHEN "ended_at" >= "started_at" + interval '10 hours' - interval '1 minute' THEN 'auto_closed' ELSE 'completed' END WHERE "ended_at" IS NOT NULL AND "status" = 'active';--> statement-breakpoint
ALTER TABLE "driver_shifts" DROP CONSTRAINT IF EXISTS "driver_shifts_status_known";--> statement-breakpoint
ALTER TABLE "driver_shifts" ADD CONSTRAINT "driver_shifts_status_known" CHECK ("status" in ('active', 'completed', 'auto_closed'));--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "driver_assignments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "driver_id" uuid NOT NULL REFERENCES "drivers"("id") ON DELETE cascade,
  "vehicle_id" text NOT NULL REFERENCES "vehicles"("id") ON DELETE cascade,
  "start_time" timestamp with time zone NOT NULL,
  "end_time" timestamp with time zone NOT NULL,
  "is_entire_shift" boolean DEFAULT false NOT NULL,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "driver_assignments_window" CHECK ("end_time" > "start_time")
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "driver_assignments_driver_start_idx" ON "driver_assignments" ("driver_id", "start_time");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "driver_assignments_vehicle_start_idx" ON "driver_assignments" ("vehicle_id", "start_time");--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "driver_break_blocks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "driver_id" uuid NOT NULL REFERENCES "drivers"("id") ON DELETE cascade,
  "shift_id" uuid REFERENCES "driver_shifts"("id") ON DELETE set null,
  "start_time" timestamp with time zone NOT NULL,
  "end_time" timestamp with time zone NOT NULL,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "driver_break_blocks_window" CHECK ("end_time" > "start_time")
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "driver_break_blocks_driver_start_idx" ON "driver_break_blocks" ("driver_id", "start_time");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "driver_break_blocks_shift_idx" ON "driver_break_blocks" ("shift_id");--> statement-breakpoint
ALTER TABLE "corporate_contacts" ADD COLUMN IF NOT EXISTS "preferred_vehicle" text;--> statement-breakpoint
ALTER TABLE "introducers" ADD COLUMN IF NOT EXISTS "last_invoice_requested_at" timestamp with time zone;
