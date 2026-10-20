import type { Metadata } from "next";
import { fontVariables } from "@/lib/fonts";
import { DEFAULT_LOCALE } from "@/lib/i18n/config";
import "./admin.css";

export const metadata: Metadata = {
  title: { default: "Admin · Ecram Execs", template: "%s · Ecram Execs Admin" },
  robots: { index: false, follow: false },
};

// Use an empty object or omit params since admin routes don't use [locale]
export default async function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // The panel's language is the signed-in admin's own (nl or en), which the server cannot know here, so the page is
    // declared in the default language and corrected before first paint from the cookie the panel keeps (admin-lang.tsx).
    // A wrong declaration stops the browser offering to translate the page.
    <html lang={DEFAULT_LOCALE} className={fontVariables} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: 'try{var m=document.cookie.match(/(?:^|; )ee_admin_lang=(en|nl)/);if(m)document.documentElement.lang=m[1]}catch(e){}',
          }}
        />
      </head>
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}