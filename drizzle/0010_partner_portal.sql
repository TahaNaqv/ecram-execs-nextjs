CREATE TABLE "booking_invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"path" text NOT NULL,
	"file_name" text NOT NULL,
	"size" integer NOT NULL,
	"uploaded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"author_kind" text NOT NULL,
	"contact_id" uuid,
	"admin_id" uuid,
	"kind" text DEFAULT 'message' NOT NULL,
	"body" text NOT NULL,
	"seen_by_team_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "booking_messages_author_kind" CHECK ("booking_messages"."author_kind" IN ('partner', 'team')),
	CONSTRAINT "booking_messages_kind" CHECK ("booking_messages"."kind" IN ('message', 'change', 'cancel'))
);
--> statement-breakpoint
ALTER TABLE "booking_invoices" ADD CONSTRAINT "booking_invoices_request_id_quote_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."quote_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_invoices" ADD CONSTRAINT "booking_invoices_uploaded_by_admin_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_messages" ADD CONSTRAINT "booking_messages_request_id_quote_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."quote_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_messages" ADD CONSTRAINT "booking_messages_contact_id_corporate_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."corporate_contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_messages" ADD CONSTRAINT "booking_messages_admin_id_admin_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "booking_invoices_request_idx" ON "booking_invoices" USING btree ("request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "booking_invoices_path_key" ON "booking_invoices" USING btree ("path");--> statement-breakpoint
CREATE INDEX "booking_messages_request_idx" ON "booking_messages" USING btree ("request_id","created_at");--> statement-breakpoint
CREATE INDEX "booking_messages_unseen_idx" ON "booking_messages" USING btree ("request_id") WHERE "booking_messages"."author_kind" = 'partner' AND "booking_messages"."seen_by_team_at" IS NULL;--> statement-breakpoint
CREATE INDEX "quote_requests_contact_created_idx" ON "quote_requests" USING btree ("corporate_contact_id","created_at");