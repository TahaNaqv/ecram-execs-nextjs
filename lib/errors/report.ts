/** Enough of an error to find it in the server log, including the digest Next shows on the error screen. */
export function describeError(error: unknown) {
  if (error instanceof Error) {
    const extra = error as Error & { code?: string; digest?: string };
    return { name: extra.name, code: extra.code, digest: extra.digest, message: extra.message, stack: extra.stack };
  }
  if (error && typeof error === "object" && "digest" in error) {
    const extra = error as { digest?: unknown; message?: unknown };
    return { digest: extra.digest, message: extra.message ?? String(error) };
  }
  return { message: String(error) };
}

export function logServerError(scope: string, error: unknown, context?: Record<string, unknown>) {
  console.error(`[${scope}]`, describeError(error), context ?? "");
}

/** `redirect()` and `notFound()` throw on purpose. A catch around a query must let those through. */
export function rethrowControlFlow(error: unknown): void {
  if (typeof error !== "object" || error === null) return;
  const digest = "digest" in error && typeof (error as { digest?: unknown }).digest === "string" ? (error as { digest: string }).digest : "";
  if (digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_HTTP_ERROR_FALLBACK")) throw error;
  if (!(error instanceof Error)) return;
  if (error.message.includes("Dynamic server usage") || error.message.includes("Bail out to client-side rendering")) throw error;
}

/**
 * Failures that a second render usually clears: an aborted refresh, a dropped socket, a cold connection.
 * A programming error (a missing binding, a bad render) does not match, so it stays on the error screen.
 */
export function isTransientRenderError(error: unknown): boolean {
  const message = error instanceof Error ? `${error.name} ${error.message}` : String(error ?? "");
  return /network error|failed to fetch|load failed|networkerror|aborted|fetch failed|econnreset|connection|timeout|socket hang up/i.test(message);
}
