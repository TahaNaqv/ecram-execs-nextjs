CREATE TYPE "public"."application_status" AS ENUM('new', 'reviewing', 'approved', 'rejected');--> statement-breakpoint
CREATE TABLE "driver_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" text NOT NULL,
	"status" "application_status" DEFAULT 'new' NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"kvk" text NOT NULL,
	"experience_years" integer NOT NULL,
	"notes" text,
	"plate" text NOT NULL,
	"make" text,
	"model" text,
	"colour" text,
	"seats" integer,
	"first_registered" date,
	"apk_expires" date,
	"taxi_registered" boolean,
	"open_recall" boolean,
	"rdw_checked_at" timestamp with time zone,
	"internal_notes" text,
	"driver_id" uuid,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"source" text DEFAULT 'website' NOT NULL,
	"ip_hash" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "driver_applications_reference_unique" UNIQUE("reference")
);
--> statement-breakpoint
ALTER TABLE "drivers" ADD COLUMN "partner" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "drivers" ADD COLUMN "vehicle" text;--> statement-breakpoint
ALTER TABLE "driver_applications" ADD CONSTRAINT "driver_applications_driver_id_drivers_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."drivers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_applications" ADD CONSTRAINT "driver_applications_reviewed_by_admin_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "driver_applications_status_created_idx" ON "driver_applications" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "driver_applications_ip_created_idx" ON "driver_applications" USING btree ("ip_hash","created_at");--> statement-breakpoint
CREATE INDEX "driver_applications_plate_idx" ON "driver_applications" USING btree ("plate");