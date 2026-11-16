ALTER TABLE "moneybird_invoices" ADD COLUMN "keep_fee_line" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "purpose" text DEFAULT 'pay' NOT NULL;--> statement-breakpoint
ALTER TABLE "quote_requests" ADD COLUMN "payment_plan" text;--> statement-breakpoint
ALTER TABLE "quote_requests" ADD COLUMN "consented_cents" integer;--> statement-breakpoint
ALTER TABLE "quote_requests" ADD COLUMN "consented_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "quote_requests" ADD COLUMN "consent_version" text;--> statement-breakpoint
ALTER TABLE "quote_requests" ADD COLUMN "consent_ip_hash" text;--> statement-breakpoint
ALTER TABLE "quote_requests" ADD COLUMN "mollie_customer_id" text;--> statement-breakpoint
ALTER TABLE "quote_requests" ADD COLUMN "mollie_mode" text;--> statement-breakpoint
ALTER TABLE "quote_requests" ADD COLUMN "mollie_mandate_id" text;--> statement-breakpoint
ALTER TABLE "quote_requests" ADD COLUMN "card_expires_on" date;--> statement-breakpoint
ALTER TABLE "quote_requests" ADD COLUMN "card_label" text;--> statement-breakpoint
ALTER TABLE "quote_requests" ADD COLUMN "auto_approve_done_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "quote_requests" ADD COLUMN "auto_approve_stopped_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "quote_requests" ADD COLUMN "notice_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "quote_requests" ADD COLUMN "balance_attempted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "quote_requests" ADD COLUMN "card_warned_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "quote_requests" ADD COLUMN "paid_notified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "quote_requests" ADD COLUMN "declined_at" timestamp with time zone;