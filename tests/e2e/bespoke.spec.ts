import { expect, test } from "@playwright/test";

// The home page no longer carries the bespoke inquiry form (the client asked for that section to go), so what is
// left here is the database rule that bespoke requests rely on. Corporate Partner introductions and the admin's
// New booking page still create bespoke requests; their tests are in corporate-partner.spec.ts and portal.spec.ts.

test("the database refuses a non-bespoke request without a journey", async () => {
  // The check constraint is the safety net behind the form's own validation: a standard service
  // must keep its pick-up details even though the columns are now nullable for bespoke requests.
  const { default: postgres } = await import("postgres");
  // The test process is not Next, so it does not load .env.local itself (the disposable database).
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // CI provides DATABASE_URL directly
  }
  const sql = postgres(process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL!, { max: 1 });
  try {
    await expect(
      sql`insert into quote_requests (reference, service, name, email, phone)
          values (${`EE-T${Date.now() % 100000}`}, 'hourly', 'T', 't@e2e.test', '+31600000000')`,
    ).rejects.toThrow(/quote_requests_journey_required/);
  } finally {
    await sql.end();
  }
});
