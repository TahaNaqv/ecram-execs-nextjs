import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1, connect_timeout: 15 });
try {
  await sql.unsafe("ALTER TABLE quote_requests ADD COLUMN IF NOT EXISTS hand_luggage integer");
  const cols = await sql`select column_name from information_schema.columns where table_name = 'quote_requests' and column_name = 'hand_luggage'`;
  console.log(cols.length === 1 ? "column-ready" : "column-missing");
} catch (error) {
  const err = error instanceof Error ? error : new Error(String(error));
  console.error("alter-failed", err.message.split("\n")[0]);
  process.exitCode = 1;
} finally {
  await sql.end();
}
