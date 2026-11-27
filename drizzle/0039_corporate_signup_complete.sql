-- A corporate partner row is created only after the email code is confirmed and a password is set.
-- Until then the sign-up lives on the challenge, so an abandoned form is not an account.
ALTER TABLE "corporate_challenges" ALTER COLUMN "contact_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "corporate_challenges" ADD COLUMN IF NOT EXISTS "pending_signup" jsonb;
