CREATE TABLE "corporate_access" (
	"id" text PRIMARY KEY NOT NULL,
	"contact_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "corporate_challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contact_id" uuid NOT NULL,
	"code_hmac" text NOT NULL,
	"pending_name" text,
	"pending_position" text,
	"pending_consent" boolean DEFAULT false NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"consumed_at" timestamp with time zone,
	"ip_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "corporate_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"email_domain" text NOT NULL,
	"name" text NOT NULL,
	"position" text NOT NULL,
	"company_name" text,
	"kvk_number" text,
	"locale" "content_locale" DEFAULT 'en' NOT NULL,
	"verified_at" timestamp with time zone,
	"last_access_at" timestamp with time zone,
	"marketing_consent" boolean DEFAULT false NOT NULL,
	"consent_text_version" text,
	"consented_at" timestamp with time zone,
	"source" text DEFAULT 'website' NOT NULL,
	"ip_hash" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "corporate_contacts_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "quote_requests" ADD COLUMN "entity_kvk" text;--> statement-breakpoint
ALTER TABLE "quote_requests" ADD COLUMN "vehicle" text;--> statement-breakpoint
ALTER TABLE "quote_requests" ADD COLUMN "corporate_contact_id" uuid;--> statement-breakpoint
ALTER TABLE "corporate_access" ADD CONSTRAINT "corporate_access_contact_id_corporate_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."corporate_contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "corporate_challenges" ADD CONSTRAINT "corporate_challenges_contact_id_corporate_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."corporate_contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "corporate_challenges_contact_created_idx" ON "corporate_challenges" USING btree ("contact_id","created_at");--> statement-breakpoint
CREATE INDEX "corporate_challenges_ip_created_idx" ON "corporate_challenges" USING btree ("ip_hash","created_at");--> statement-breakpoint
CREATE INDEX "corporate_contacts_created_idx" ON "corporate_contacts" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "corporate_contacts_domain_idx" ON "corporate_contacts" USING btree ("email_domain");--> statement-breakpoint
ALTER TABLE "quote_requests" ADD CONSTRAINT "quote_requests_corporate_contact_id_corporate_contacts_id_fk" FOREIGN KEY ("corporate_contact_id") REFERENCES "public"."corporate_contacts"("id") ON DELETE set null ON UPDATE no action;