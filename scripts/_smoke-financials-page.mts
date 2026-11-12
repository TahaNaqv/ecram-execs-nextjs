import { createHash, randomBytes } from "node:crypto";
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1, connect_timeout: 10 });
const [admin] = await sql`select id from admin_users limit 1`;
const token = randomBytes(32).toString("base64url");
const id = createHash("sha256").update(token).digest("hex");
await sql`insert into admin_sessions (id, admin_id, expires_at) values (${id}, ${admin.id}, now() + interval '10 minutes')`;
const started = Date.now();
try {
  const res = await fetch("http://localhost:3000/admin/financials", {
    headers: { cookie: `ee_admin_session=${token}` },
  });
  const text = await res.text();
  console.log(JSON.stringify({
    status: res.status,
    ms: Date.now() - started,
    refs: (text.match(/EE-[A-Z0-9]{6}/g) ?? []).length,
    euros: (text.match(/€|\\u20ac/g) ?? []).length,
    appError: /Application error/.test(text),
  }));
} finally {
  await sql`delete from admin_sessions where id = ${id}`;
  await sql.end();
}
