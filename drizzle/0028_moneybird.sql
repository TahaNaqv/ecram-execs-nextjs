CREATE TABLE "moneybird_invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid,
	"reference" text NOT NULL,
	"attempt" integer DEFAULT 1 NOT NULL,
	"kind" text NOT NULL,
	"credit_of" uuid,
	"moneybird_id" text,
	"number" text,
	"state" text NOT NULL,
	"delivery" text,
	"total_cents" integer,
	"unpaid_cents" integer,
	"fee_cents" integer,
	"url" text,
	"payment_url" text,
	"last_error" text,
	"claimed_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"credited_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "moneybird_invoices_kind" CHECK ("moneybird_invoices"."kind" in ('invoice', 'credit')),
	CONSTRAINT "moneybird_invoices_credit_link" CHECK (("moneybird_invoices"."kind" = 'credit') = ("moneybird_invoices"."credit_of" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "corporate_contacts" ADD COLUMN "billing_street" text;--> statement-breakpoint
ALTER TABLE "corporate_contacts" ADD COLUMN "billing_postcode" text;--> statement-breakpoint
ALTER TABLE "corporate_contacts" ADD COLUMN "billing_city" text;--> statement-breakpoint
ALTER TABLE "corporate_contacts" ADD COLUMN "billing_country" text DEFAULT 'NL' NOT NULL;--> statement-breakpoint
ALTER TABLE "corporate_contacts" ADD COLUMN "vat_number" text;--> statement-breakpoint
ALTER TABLE "corporate_contacts" ADD COLUMN "invoice_email" text;--> statement-breakpoint
ALTER TABLE "corporate_contacts" ADD COLUMN "moneybird_contact_id" text;--> statement-breakpoint
ALTER TABLE "moneybird_invoices" ADD CONSTRAINT "moneybird_invoices_request_id_quote_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."quote_requests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moneybird_invoices" ADD CONSTRAINT "moneybird_invoices_credit_of_moneybird_invoices_id_fk" FOREIGN KEY ("credit_of") REFERENCES "public"."moneybird_invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "moneybird_invoices_request_idx" ON "moneybird_invoices" USING btree ("request_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "moneybird_invoices_live_key" ON "moneybird_invoices" USING btree ("request_id") WHERE "moneybird_invoices"."kind" = 'invoice' AND "moneybird_invoices"."credited_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "moneybird_invoices_credit_key" ON "moneybird_invoices" USING btree ("credit_of") WHERE "moneybird_invoices"."kind" = 'credit';--> statement-breakpoint
CREATE UNIQUE INDEX "moneybird_invoices_moneybird_key" ON "moneybird_invoices" USING btree ("moneybird_id");--> statement-breakpoint
CREATE INDEX "moneybird_invoices_state_idx" ON "moneybird_invoices" USING btree ("state");