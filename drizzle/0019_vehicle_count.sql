ALTER TABLE "quote_requests" ADD COLUMN IF NOT EXISTS "vehicle_count" integer DEFAULT 1 NOT NULL;
