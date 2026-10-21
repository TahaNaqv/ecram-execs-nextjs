"use server";

import { cookies } from "next/headers";
import { CONSENT_COOKIE, CONSENT_DAYS, consentJson } from "@/lib/consent";

/**
 * Stores the visitor's cookie choice from the server. The browser has already written the cookie itself so the page
 * can react at once; this writes it again as a `Set-Cookie` header, because Safari limits a cookie written by script to
 * seven days and would ask again every week, while one set by the server keeps the full twelve months. A Server Action
 * also checks where the request came from, so another site cannot post a choice on a visitor's behalf.
 */
export async function persistConsent(choice: { analytics?: unknown; marketing?: unknown }) {
  // Next encodes the value itself, so it gets the plain JSON: the cookie then reads exactly as the one the browser wrote
  (await cookies()).set(CONSENT_COOKIE, consentJson({ analytics: choice?.analytics === true, marketing: choice?.marketing === true }), {
    path: "/",
    maxAge: CONSENT_DAYS * 24 * 60 * 60,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    httpOnly: false, // the page reads it to know whether to show the banner
  });
}
