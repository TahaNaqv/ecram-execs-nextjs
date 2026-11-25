import postgres from "postgres";
import { seedEsprinter } from "../lib/db/seed-fleet.ts";

const url = process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set (add it to .env.local).");
  process.exit(1);
}

const sql = postgres(url, { prepare: false, max: 1 });
await seedEsprinter(sql);
console.log("Mercedes-Benz eSprinter 420 RWD PRO is on the fleet register.");
await sql.end();
