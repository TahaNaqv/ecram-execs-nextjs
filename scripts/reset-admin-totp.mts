/**
 * Turns off authenticator login for one admin and deletes that account's sessions.
 * The password is left as it is. Nothing secret is printed.
 *
 *   npx tsx --env-file-if-exists=.env.local scripts/reset-admin-totp.mts aishmurtaza@gmail.com
 */
import postgres from "postgres";

const email = (process.argv[2] ?? "").trim().toLowerCase();
if (!email.includes("@")) {
  console.error("Pass the account email: scripts/reset-admin-totp.mts name@company.com");
  process.exit(1);
}

const url = process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const sql = postgres(url, { prepare: false, max: 1 });
const updated = await sql<{ id: string }[]>`
  update admin_users
  set totp_secret = null, totp_enabled = false
  where lower(email) = ${email}
  returning id
`;
if (updated.length === 0) {
  console.error("No admin account uses that email.");
  await sql.end();
  process.exit(1);
}
await sql`delete from admin_sessions where admin_id = ${updated[0]!.id}`;
console.log(`Authenticator reset for ${email}. Sign in with the account password.`);
await sql.end();
