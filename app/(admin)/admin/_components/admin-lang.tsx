"use client";

import { useEffect } from "react";

/** Keeps the page's declared language, and the cookie the very first paint reads it from, in step with the panel's language. */
export function AdminLang({ locale }: { locale: string }) {
  useEffect(() => {
    document.documentElement.lang = locale;
    document.cookie = `ee_admin_lang=${locale}; path=/; max-age=31536000; samesite=lax`;
  }, [locale]);
  return null;
}
