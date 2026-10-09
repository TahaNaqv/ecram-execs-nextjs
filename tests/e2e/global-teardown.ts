import postgres from "postgres";
import { E2E_ADMIN } from "./helpers";

// Remove everything the tests created
export default async function globalTeardown() {
  process.loadEnvFile?.(".env.local");
  const url = process.env.DATABASE_URL;
  if (!url) return;
  const sql = postgres(url, { prepare: false, max: 1 });
  try {
    await sql`delete from quote_requests where email like '%@e2e.ecramexecs.test'`;
    await sql`delete from drivers where name like 'E2E Driver %'`;
    await sql`delete from admin_users where email = ${E2E_ADMIN.email}`;
  } finally {
    await sql.end();
  }
}
