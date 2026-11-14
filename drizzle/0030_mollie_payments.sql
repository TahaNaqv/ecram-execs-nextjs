CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid,
	"reference" text NOT NULL,
	"mollie_id" text,
	"mode" text NOT NULL,
	"status" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"refunded_cents" integer DEFAULT 0 NOT NULL,
	"charged_back_cents" integer DEFAULT 0 NOT NULL,
	"method" text,
	"checkout_url" text,
	"dashboard_url" text,
	"paid_at" timestamp with time zone,
	"moneybird_registered_at" timestamp with time zone,
	"claimed_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_mode" CHECK ("payments"."mode" in ('test', 'live')),
	CONSTRAINT "payments_amount_positive" CHECK ("payments"."amount_cents" > 0)
);
--> statement-breakpoint
CREATE TABLE "refunds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" uuid NOT NULL,
	"mollie_refund_id" text,
	"amount_cents" integer NOT NULL,
	"status" text NOT NULL,
	"moneybird_registered_at" timestamp with time zone,
	"admin_id" uuid,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "refunds_amount_positive" CHECK ("refunds"."amount_cents" > 0)
);
--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_request_id_quote_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."quote_requests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_admin_id_admin_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payments_request_idx" ON "payments" USING btree ("request_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_mollie_key" ON "payments" USING btree ("mollie_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_one_open" ON "payments" USING btree ("request_id","mode") WHERE "payments"."status" in ('creating', 'open', 'pending', 'authorized');--> statement-breakpoint
CREATE INDEX "payments_status_idx" ON "payments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "refunds_payment_idx" ON "refunds" USING btree ("payment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "refunds_mollie_key" ON "refunds" USING btree ("mollie_refund_id");--> statement-breakpoint
CREATE INDEX "refunds_admin_idx" ON "refunds" USING btree ("admin_id");