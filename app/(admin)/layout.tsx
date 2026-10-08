import type { Metadata } from "next";
import { fontVariables } from "@/lib/fonts";
import "./admin.css";

export const metadata: Metadata = {
  title: { default: "Admin · Ecram Execs", template: "%s · Ecram Execs Admin" },
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={fontVariables}>
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
