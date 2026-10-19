// Create an admin user, or reset an existing admin's password.
//   npm run admin:create -- owner@ecramexecs.nl "Full Name"
// Reads DATABASE_URL from .env.local (or the environment) and prompts for the password.
import { randomBytes, scrypt } from "node:crypto";
import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline";
import postgres from "postgres";

const [email, ...nameParts] = process.argv.slice(2);
const name = nameParts.join(" ").trim();
if (!email || !email.includes("@") || !name) {
  console.error('Usage: npm run admin:create -- <email> "<full name>"');
  process.exit(1);
}
const url = process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set (add it to .env.local).");
  process.exit(1);
}

function askHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: stdin, output: stdout, terminal: true });
    const rlAny = rl as unknown as { _writeToOutput: (s: string) => void };
    let prompted = false;
    rlAny._writeToOutput = (s: string) => {
      if (!prompted) {
        stdout.write(s);
        prompted = true;
      }
    };
    rl.question(question, (answer) => {
      rl.close();
      stdout.write("\n");
      resolve(answer);
    });
  });
}

const password = process.env.ADMIN_PASSWORD ?? (await askHidden("Password (min 12 characters): "));
if (password.length < 12) {
  console.error("Password must be at least 12 characters.");
  process.exit(1);
}
if (!process.env.ADMIN_PASSWORD && (await askHidden("Repeat password: ")) !== password) {
  console.error("Passwords do not match.");
  process.exit(1);
}

// Same format as lib/auth/password.ts
const salt = randomBytes(16);
const key: Buffer = await new Promise((res, rej) =>
  scrypt(password, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (e, k) => (e ? rej(e) : res(k))),
);
const hash = `scrypt$16384$8$1$${salt.toString("base64")}$${key.toString("base64")}`;

const sql = postgres(url, { prepare: false, max: 1 });
const [row] = await sql`
  insert into admin_users (email, name, password_hash)
  values (${email.toLowerCase()}, ${name}, ${hash})
  on conflict (email) do update
    set name = excluded.name, password_hash = excluded.password_hash,
        failed_logins = 0, locked_until = null
  returning (xmax = 0) as created`;
// Changing the password signs the admin out everywhere
await sql`delete from admin_sessions where admin_id = (select id from admin_users where email = ${email.toLowerCase()})`;
await sql.end();
console.log(row.created ? `Admin created: ${email}` : `Password updated: ${email}`);
