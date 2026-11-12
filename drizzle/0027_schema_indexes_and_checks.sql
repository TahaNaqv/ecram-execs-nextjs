CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
DROP INDEX "booking_invoices_request_idx";--> statement-breakpoint
CREATE INDEX "admin_sessions_admin_idx" ON "admin_sessions" USING btree ("admin_id");--> statement-breakpoint
CREATE INDEX "app_settings_updated_by_idx" ON "app_settings" USING btree ("updated_by");--> statement-breakpoint
CREATE INDEX "booking_invoices_uploader_idx" ON "booking_invoices" USING btree ("uploaded_by");--> statement-breakpoint
CREATE INDEX "booking_invoices_filename_trgm" ON "booking_invoices" USING gin ("file_name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "booking_messages_contact_idx" ON "booking_messages" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "booking_messages_admin_idx" ON "booking_messages" USING btree ("admin_id");--> statement-breakpoint
CREATE INDEX "corporate_access_contact_idx" ON "corporate_access" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "corporate_contacts_company_trgm" ON "corporate_contacts" USING gin ("company_name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "corporate_contacts_name_trgm" ON "corporate_contacts" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "driver_applications_driver_idx" ON "driver_applications" USING btree ("driver_id");--> statement-breakpoint
CREATE INDEX "driver_applications_reviewer_idx" ON "driver_applications" USING btree ("reviewed_by");--> statement-breakpoint
CREATE INDEX "driver_applications_email_trgm" ON "driver_applications" USING gin ("email" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "driver_shifts_started_by_idx" ON "driver_shifts" USING btree ("started_by");--> statement-breakpoint
CREATE INDEX "driver_shifts_ended_by_idx" ON "driver_shifts" USING btree ("ended_by");--> statement-breakpoint
CREATE INDEX "quote_requests_confirmed_pickup_idx" ON "quote_requests" USING btree ("pickup_at") WHERE "quote_requests"."status" = 'confirmed';--> statement-breakpoint
CREATE INDEX "quote_requests_activity_idx" ON "quote_requests" USING btree (coalesce("pickup_at"::timestamp, ("created_at" at time zone 'Europe/Amsterdam')));--> statement-breakpoint
CREATE INDEX "quote_requests_reference_trgm" ON "quote_requests" USING gin ("reference" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "quote_requests_name_trgm" ON "quote_requests" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "quote_requests_email_trgm" ON "quote_requests" USING gin ("email" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "quote_requests_entity_trgm" ON "quote_requests" USING gin ("entity" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "request_events_admin_idx" ON "request_events" USING btree ("admin_id");--> statement-breakpoint
CREATE INDEX "booking_invoices_request_idx" ON "booking_invoices" USING btree ("request_id","created_at");--> statement-breakpoint
ALTER TABLE "booking_invoices" ADD CONSTRAINT "booking_invoices_size_nonneg" CHECK ("booking_invoices"."size" >= 0);--> statement-breakpoint
ALTER TABLE "corporate_challenges" ADD CONSTRAINT "corporate_challenges_purpose" CHECK ("corporate_challenges"."purpose" in ('signup', 'reset'));--> statement-breakpoint
ALTER TABLE "quote_requests" ADD CONSTRAINT "quote_requests_vehicle_count_positive" CHECK ("quote_requests"."vehicle_count" >= 1);--> statement-breakpoint
ALTER TABLE "quote_requests" ADD CONSTRAINT "quote_requests_quoted_nonneg" CHECK ("quote_requests"."quoted_amount" is null or "quote_requests"."quoted_amount" >= 0);--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_battery_range" CHECK ("vehicles"."battery_soc" between 0 and 100);--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_status_known" CHECK ("vehicles"."status" in ('available', 'unavailable', 'maintenance'));