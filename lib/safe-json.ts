/**
 * Parse JSON without throwing. Use for anything that may be corrupted (sessionStorage drafts,
 * cookies, signed tokens, form fields). Returns `fallback` when the text is empty or invalid.
 */
export function safeJsonParse<T = unknown>(raw: string | null | undefined, fallback: T | null = null): T | null {
  if (raw == null) return fallback;
  const text = raw.trim();
  if (!text) return fallback;
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}
