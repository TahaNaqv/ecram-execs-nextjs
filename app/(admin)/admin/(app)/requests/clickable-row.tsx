"use client";

import { useRouter } from "next/navigation";
import type { MouseEvent, ReactNode } from "react";

/** The whole table row opens the booking. A link inside the row keeps its own click, including open-in-new-tab. */
export function ClickableRow({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  const router = useRouter();
  const onClick = (event: MouseEvent<HTMLTableRowElement>) => {
    if ((event.target as HTMLElement).closest("a, button")) return;
    router.push(href);
  };
  return (
    <tr className={`cursor-pointer ${className ?? ""}`} onClick={onClick}>
      {children}
    </tr>
  );
}
