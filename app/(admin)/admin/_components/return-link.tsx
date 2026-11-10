"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeftIcon } from "./icons";

const RETURN_KEY = "ee-admin-return";

function remember(path: string) {
  try {
    sessionStorage.setItem(RETURN_KEY, path);
  } catch {}
}

function clear() {
  try {
    sessionStorage.removeItem(RETURN_KEY);
  } catch {}
}

function read(): string | null {
  try {
    return sessionStorage.getItem(RETURN_KEY);
  } catch {
    return null;
  }
}

/**
 * Back control for a booking opened from Enquiries (or Bookings). The `from` query is the
 * source of truth; sessionStorage keeps that destination if the query is later dropped.
 */
export function AdminReturnLink({
  fromEnquiries,
  enquiriesLabel,
  requestsLabel,
}: {
  fromEnquiries: boolean;
  enquiriesLabel: string;
  requestsLabel: string;
}) {
  const [storedEnquiries, setStoredEnquiries] = useState(false);

  useEffect(() => {
    if (fromEnquiries) {
      remember("/admin/enquiries");
      setStoredEnquiries(true);
      return;
    }
    setStoredEnquiries(read() === "/admin/enquiries");
  }, [fromEnquiries]);

  const toEnquiries = fromEnquiries || storedEnquiries;
  const href = toEnquiries ? "/admin/enquiries" : "/admin/requests";
  const label = toEnquiries ? enquiriesLabel : requestsLabel;

  return (
    <Link
      href={href}
      onClick={() => {
        if (toEnquiries) clear();
      }}
      className="inline-flex items-center gap-1.5 text-[13px] font-medium text-zinc-500 transition-colors hover:text-zinc-950"
    >
      <ArrowLeftIcon size={14} />
      {label}
    </Link>
  );
}
