CREATE TABLE "concierge_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" text NOT NULL,
	"locale" "content_locale" DEFAULT 'en' NOT NULL,
	"ip_hash" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_message_at" timestamp with time zone DEFAULT now() NOT NULL,
	"message_count" integer DEFAULT 0 NOT NULL,
	"draft" jsonb,
	"request_id" uuid,
	CONSTRAINT "concierge_conversations_session_id_unique" UNIQUE("session_id")
);
--> statement-breakpoint
CREATE TABLE "concierge_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"meta" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "concierge_messages_role_check" CHECK ("concierge_messages"."role" in ('visitor', 'concierge'))
);
--> statement-breakpoint
ALTER TABLE "concierge_conversations" ADD CONSTRAINT "concierge_conversations_request_id_quote_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."quote_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concierge_messages" ADD CONSTRAINT "concierge_messages_conversation_id_concierge_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."concierge_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "concierge_conversations_last_message_idx" ON "concierge_conversations" USING btree ("last_message_at");--> statement-breakpoint
CREATE INDEX "concierge_conversations_request_idx" ON "concierge_conversations" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "concierge_conversations_ip_started_idx" ON "concierge_conversations" USING btree ("ip_hash","started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "concierge_messages_position_idx" ON "concierge_messages" USING btree ("conversation_id","position");