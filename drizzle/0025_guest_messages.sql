ALTER TABLE "booking_messages" DROP CONSTRAINT "booking_messages_author_kind";--> statement-breakpoint
DROP INDEX "booking_messages_unseen_idx";--> statement-breakpoint
CREATE INDEX "booking_messages_unseen_idx" ON "booking_messages" USING btree ("request_id") WHERE "booking_messages"."author_kind" IN ('partner', 'guest') AND "booking_messages"."seen_by_team_at" IS NULL;--> statement-breakpoint
ALTER TABLE "booking_messages" ADD CONSTRAINT "booking_messages_author_kind" CHECK ("booking_messages"."author_kind" IN ('partner', 'team', 'guest'));