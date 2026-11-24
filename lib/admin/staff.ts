import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { hashPassword } from "@/lib/auth/password";
import { db, schema } from "@/lib/db";
import { permissionsFor, type StaffPermission, type StaffRole } from "./access";

const INITIAL = [
  { email: "ecramexecs@gmail.com", name: "Tylaan", role: "owner" as const },
  { email: "enquiries@ecramexecs.com", name: "Anne-Marie", role: "manager" as const },
  { email: "d.talbert@ecramexecs.com", name: "David", role: "manager" as const },
];

/** Creates the three launch accounts when they are missing. They set a password through Forgot password. */
export async function ensureInitialStaff() {
  for (const person of INITIAL) {
    const [existing] = await db.select({ id: schema.adminUsers.id }).from(schema.adminUsers).where(eq(schema.adminUsers.email, person.email)).limit(1);
    if (existing) continue;
    await db.insert(schema.adminUsers).values({
      email: person.email,
      name: person.name,
      role: person.role,
      permissions: permissionsFor(person.role, []),
      passwordHash: await hashPassword(randomBytes(32).toString("base64url")),
    });
  }
}

export async function listStaff() {
  return db
    .select({
      id: schema.adminUsers.id,
      email: schema.adminUsers.email,
      name: schema.adminUsers.name,
      role: schema.adminUsers.role,
      permissions: schema.adminUsers.permissions,
      lastLoginAt: schema.adminUsers.lastLoginAt,
    })
    .from(schema.adminUsers)
    .orderBy(schema.adminUsers.name);
}

export async function createStaff(input: { email: string; name: string; role: StaffRole; permissions: StaffPermission[]; password: string }) {
  const email = input.email.trim().toLowerCase();
  const [existing] = await db.select({ id: schema.adminUsers.id }).from(schema.adminUsers).where(eq(schema.adminUsers.email, email)).limit(1);
  if (existing) return { status: "taken" as const };
  await db.insert(schema.adminUsers).values({
    email,
    name: input.name.trim(),
    role: input.role,
    permissions: input.role === "owner" ? permissionsFor("owner", []) : input.permissions,
    passwordHash: await hashPassword(input.password),
  });
  return { status: "ok" as const };
}

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/** A one-hour reset link. Returns the raw token only so the email can carry it; the database keeps the hash. */
export async function issuePasswordReset(email: string): Promise<{ email: string; name: string; token: string } | null> {
  const [user] = await db
    .select({ id: schema.adminUsers.id, email: schema.adminUsers.email, name: schema.adminUsers.name })
    .from(schema.adminUsers)
    .where(eq(schema.adminUsers.email, email.trim().toLowerCase()))
    .limit(1);
  if (!user) return null;
  const token = randomBytes(32).toString("base64url");
  await db.insert(schema.adminPasswordResets).values({
    adminId: user.id,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  });
  return { email: user.email, name: user.name, token };
}

export async function consumePasswordReset(token: string, password: string): Promise<boolean> {
  const [row] = await db
    .select()
    .from(schema.adminPasswordResets)
    .where(and(eq(schema.adminPasswordResets.tokenHash, hashToken(token)), isNull(schema.adminPasswordResets.usedAt), gt(schema.adminPasswordResets.expiresAt, new Date())))
    .limit(1);
  if (!row) return false;
  await db.update(schema.adminUsers).set({ passwordHash: await hashPassword(password), failedLogins: 0, lockedUntil: null }).where(eq(schema.adminUsers.id, row.adminId));
  await db.update(schema.adminPasswordResets).set({ usedAt: new Date() }).where(eq(schema.adminPasswordResets.id, row.id));
  await db.delete(schema.adminSessions).where(eq(schema.adminSessions.adminId, row.adminId));
  return true;
}
