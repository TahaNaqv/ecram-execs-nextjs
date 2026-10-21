-- Fleet changes of 21 Oct 2026 (QA report): the Mercedes-Benz EQS joins the fleet, and the Audi and Range Rover get their
-- model names. Only rows that still hold the old default name are renamed, so a name the team edited by hand is kept.
-- All six fleet vehicles are inserted if missing, because the Vehicles page only seeds an empty table.
INSERT INTO "vehicles" ("id", "name", "status") VALUES
	('mercedes_vle_300', 'Mercedes-Benz VLE 300', 'available'),
	('mercedes_eqs', 'Mercedes-Benz EQS', 'available'),
	('audi', 'Audi e-tron GT', 'available'),
	('cadillac_escalade', 'Cadillac Escalade IQ', 'available'),
	('range_rover', 'Range Rover EV', 'available'),
	('hongqi_e_hs9', 'Hongqi E-HS9', 'available')
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint
UPDATE "vehicles" SET "name" = 'Audi e-tron GT', "updated_at" = now() WHERE "id" = 'audi' AND "name" = 'Audi';
--> statement-breakpoint
UPDATE "vehicles" SET "name" = 'Range Rover EV', "updated_at" = now() WHERE "id" = 'range_rover' AND "name" = 'Range Rover';
