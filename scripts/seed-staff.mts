import postgres from "postgres";
import { permissionsFor } from "../lib/admin/access.ts";
import { hashPassword, verifyPassword } from "../lib/auth/password.ts";
import { seedEsprinter } from "../lib/db/seed-fleet.ts";

const PASSWORD = "Password@1234";
const PEOPLE = [
  { email: "ecramexecs@gmail.com", name: "Tylaan", role: "owner" as const },
  { email: "enquiries@ecramexecs.com", name: "Anne-Marie", role: "manager" as const },
  { email: "d.talbert@ecramexecs.com", name: "David", role: "manager" as const },
];

const url = process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");
const sql = postgres(url, { prepare: false, max: 1 });
const passwordHash = await hashPassword(PASSWORD);

for (const person of PEOPLE) {
  const permissions = permissionsFor(person.role, []);
  const rows = await sql<{ email: string }[]>`
    insert into admin_users (email, name, password_hash, role, permissions, failed_logins, locked_until, totp_secret, totp_enabled)
    values (
      ${person.email},
      ${person.name},
      ${passwordHash},
      ${person.role},
      ${sql.json(permissions)},
      0,
      null,
      null,
      false
    )
    on conflict (email) do update set
      name = excluded.name,
      password_hash = excluded.password_hash,
      role = excluded.role,
      permissions = excluded.permissions,
      failed_logins = 0,
      locked_until = null,
      totp_secret = null,
      totp_enabled = false
    returning email
  `;
  const [stored] = await sql<{ password_hash: string }[]>`select password_hash from admin_users where email = ${person.email}`;
  const ok = await verifyPassword(PASSWORD, stored.password_hash);
  console.log(`${rows[0]?.email ?? person.email} ${person.role} password:${ok ? "ok" : "mismatch"}`);
}

await seedEsprinter(sql);
const [vehicle] = await sql<{ name: string; seats: number; rate_weekday: number; rate_saturday: number; rate_sunday: number }[]>`
  select name, seats, rate_weekday, rate_saturday, rate_sunday from vehicles where id = 'mercedes_esprinter'
`;
const [battery] = await sql<{ battery_capacity_kwh: string }[]>`
  select battery_capacity_kwh from vehicle_financials where vehicle_id = 'mercedes_esprinter'
`;
console.log(JSON.stringify({ vehicle, batteryKwh: battery?.battery_capacity_kwh ?? null }));
await sql.end();
