import "server-only";
import { headers } from "next/headers";
import { isLoopbackOrigin, siteOrigin } from "./config";

/**
 * The address customers and Mollie should use for this request.
 * SITE_URL wins when it is a public https (or http) origin. A localhost SITE_URL is only for this machine:
 * on the deployed site the request host is used instead, so return links are not http://localhost/.../api/...
 */
export async function publicOrigin(): Promise<string | null> {
  const configured = siteOrigin();
  if (configured && !isLoopbackOrigin(configured)) return configured;
  try {
    const h = await headers();
    const host = (h.get("x-forwarded-host") ?? h.get("host") ?? "").split(",")[0]?.trim() ?? "";
    if (!host || /[\s/]/.test(host)) return configured;
    const forwarded = (h.get("x-forwarded-proto") ?? "").split(",")[0]?.trim();
    const proto = forwarded === "http" || forwarded === "https" ? forwarded : isLoopbackOrigin(`http://${host}`) ? "http" : "https";
    const origin = new URL(`${proto}://${host}`).origin;
    if (configured && isLoopbackOrigin(origin)) return configured;
    return origin;
  } catch {
    return configured;
  }
}
