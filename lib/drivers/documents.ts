import { can, type StaffPermission, type StaffRole } from "@/lib/admin/access";

/**
 * The photo and scans a driver profile holds, one of each (the client, 28 Nov 2026). The names are letters only: the
 * document store accepts nothing else as a file name (lib/storage-local.ts).
 */
export const DRIVER_DOCUMENT_KINDS = ["photo", "kiwafront", "kiwaback", "zzpagreement", "permit", "ondernemerskaart", "insurance"] as const;
export type DriverDocumentKind = (typeof DRIVER_DOCUMENT_KINDS)[number];

const SCAN_TYPES = ["application/pdf", "image/jpeg", "image/png"];
const PHOTO_TYPES = ["image/jpeg", "image/png"];

/** The file types a kind takes: the photo is shown as a picture, so it is an image. */
export const documentAccepts = (kind: DriverDocumentKind) => (kind === "photo" ? PHOTO_TYPES : SCAN_TYPES);

/** Home address, date of birth and IBAN: only owners and staff with the financials permission see or change them. */
export function maySeePrivate(admin: { role: StaffRole; permissions: readonly StaffPermission[] }) {
  return admin.role === "owner" || can(admin.role, admin.permissions, "financials");
}
