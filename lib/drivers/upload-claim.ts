import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * A driver document upload is recorded only with the claim the server handed out for it: this driver, this kind, this
 * path, for two hours. Without it, someone could record a file that is already stored for something else (an applicant's
 * scan, an invoice) against a driver, and replacing or erasing that driver would then delete it.
 */
const key = () => {
  const secret = process.env.DOCUMENTS_SECRET ?? process.env.IP_HASH_SALT;
  if (!secret || secret.length < 16) throw new Error("Set IP_HASH_SALT (or DOCUMENTS_SECRET), at least 16 characters, to sign driver uploads");
  return createHmac("sha256", secret).update("ecram-driver-upload-claim-v1").digest();
};

const mac = (body: string) => createHmac("sha256", key()).update(body).digest("base64url");

export function signUploadClaim(driverId: string, kind: string, path: string): string {
  const exp = Date.now() + 2 * 60 * 60 * 1000;
  const body = `${driverId}|${kind}|${path}|${exp}`;
  return `${exp}.${mac(body)}`;
}

export function verifyUploadClaim(claim: string, driverId: string, kind: string, path: string): boolean {
  const [exp, given] = claim.split(".");
  if (!exp || !given || !/^\d+$/.test(exp) || Number(exp) < Date.now()) return false;
  const expected = Buffer.from(mac(`${driverId}|${kind}|${path}|${exp}`));
  const actual = Buffer.from(given);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
