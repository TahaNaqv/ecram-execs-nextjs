"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { parseConsent, readConsentValue, subscribeConsent, type ConsentCategory } from "@/lib/consent";

/**
 * Renders its children only once the visitor has allowed the category. Put anything that sets cookies or contacts a
 * third party for analytics or marketing inside it (a script, a pixel, a tracking embed), so it never runs before consent
 * and stops appearing if consent is withdrawn:
 *
 *   <ConsentGate category="analytics"><Script src="…" /></ConsentGate>
 *
 * On the server and before the visitor has chosen, nothing is rendered. Third-party hosts also have to be added to the
 * Content-Security-Policy in next.config.ts.
 */
export function ConsentGate({ category, children }: { category: ConsentCategory; children: ReactNode }) {
  const value = useSyncExternalStore(subscribeConsent, readConsentValue, () => null);
  return parseConsent(value)?.[category] ? <>{children}</> : null;
}
