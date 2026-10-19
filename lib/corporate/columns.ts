import "server-only";
import { getTableColumns } from "drizzle-orm";
import { schema } from "@/lib/db";
import type { CorporateContact } from "@/lib/db/schema";

/**
 * A contact as the rest of the app may see it: everything except the password hash. Queries that feed pages, admin
 * lists or client components select these columns, so the hash cannot travel with a row by accident. Only the sign-in
 * and password actions read `passwordHash`, and they name the column themselves.
 */
const { passwordHash, ...publicColumns } = getTableColumns(schema.corporateContacts);
void passwordHash;
export const contactColumns = publicColumns;
export type CorporateContactPublic = Omit<CorporateContact, "passwordHash">;
