"use client";

import { useEffect } from "react";
import { XIcon } from "./icons";

export function AdminModal({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.body.style.overflow = "unset";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-zinc-950/40 backdrop-blur-xs transition-opacity animate-fade-in"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-lg transform overflow-hidden rounded-xl bg-white shadow-2xl transition-all z-10">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 bg-zinc-50/50">
          <div>
            <h2 className="text-sm font-bold text-zinc-950">{title}</h2>
            {subtitle && <p className="text-xs text-zinc-500 mt-0.5">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:text-zinc-950 hover:bg-zinc-100 transition-colors"
          >
            <XIcon size={18} />
          </button>
        </div>

        <div className="p-6 space-y-4">{children}</div>
      </div>
    </div>
  );
}