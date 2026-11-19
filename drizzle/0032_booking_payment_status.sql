ALTER TABLE "quote_requests" ADD COLUMN IF NOT EXISTS "payment_status" text DEFAULT 'OPEN';
