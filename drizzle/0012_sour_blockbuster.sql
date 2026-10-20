CREATE TABLE IF NOT EXISTS "vehicles" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'available' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
