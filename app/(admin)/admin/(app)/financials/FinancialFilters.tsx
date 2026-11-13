"use client";

import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  financialExportHref,
  financialHref,
  type FinancialQuery,
  type SortKey,
  type StatusFilter,
} from "@/lib/admin/financials-shared";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { ChevronDownIcon, DownloadIcon, SearchIcon } from "../../_components/icons";
import { AdminDateField, type AdminDateCopy } from "../../_components/admin-fields";
import { btn, field } from "../../_components/ui";
import type { Locale } from "@/lib/i18n/config";

type Copy = Dictionary["admin"]["financials"];

const STATUSES: StatusFilter[] = ["all", "paid", "pending", "overdue", "refunded"];

export function FinancialFilters({
  query,
  copy,
  defaults,
  locale,
  dateCopy,
}: {
  query: FinancialQuery;
  copy: Copy;
  defaults: { from: string; to: string };
  locale: Locale;
  dateCopy: AdminDateCopy;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const current = useRef(query);
  const timer = useRef<number | undefined>(undefined);
  const [customOpen, setCustomOpen] = useState(query.range === "custom");

  useEffect(() => {
    current.current = query;
  }, [query]);
  useEffect(() => {
    setCustomOpen(query.range === "custom");
  }, [query.range]);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  function go(patch: Partial<FinancialQuery>, history: "push" | "replace" = "push") {
    const next: FinancialQuery = { ...current.current, ...patch, page: patch.page ?? 1 };
    const href = financialHref(next);
    startTransition(() => {
      if (history === "replace") router.replace(href, { scroll: false });
      else router.push(href, { scroll: false });
    });
  }

  const presets: { range: FinancialQuery["range"]; label: string }[] = [
    { range: "today", label: copy.rangeToday },
    { range: "week", label: copy.rangeWeek },
    { range: "month", label: copy.rangeMonth },
  ];
  const statusLabel: Record<StatusFilter, string> = {
    all: copy.all,
    paid: copy.paid,
    pending: copy.pending,
    overdue: copy.overdue,
    refunded: copy.refunded,
  };
  const sortLabel: Record<SortKey, string> = {
    date: copy.sortDate,
    amount: copy.sortAmount,
    reference: copy.sortReference,
    client: copy.sortClient,
    status: copy.sortStatus,
  };

  function applyCustom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const from = String(data.get("from") ?? "");
    const to = String(data.get("to") ?? "");
    if (!from || !to) return;
    go({ range: "custom", from, to, page: 1 });
  }

  return (
    <div className={`flex flex-col gap-3 border-b border-zinc-100 p-3 sm:p-4 ${pending ? "opacity-70" : ""}`} aria-busy={pending}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-zinc-200 bg-white p-0.5 shadow-xs">
            {presets.map((preset) => {
              const active = query.range === preset.range && !customOpen;
              return (
                <button
                  key={preset.range}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    setCustomOpen(false);
                    go({ range: preset.range, from: undefined, to: undefined, page: 1 });
                  }}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                    active ? "bg-zinc-950 text-white shadow-xs" : "text-zinc-600 hover:text-zinc-950"
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
            <button
              type="button"
              aria-pressed={query.range === "custom" || customOpen}
              onClick={() => setCustomOpen(true)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                query.range === "custom" || customOpen ? "bg-zinc-950 text-white shadow-xs" : "text-zinc-600 hover:text-zinc-950"
              }`}
            >
              {copy.rangeCustom}
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="sr-only" htmlFor="financial-status">
            {copy.statusLabel}
          </label>
          <select
            id="financial-status"
            className={`${field} h-9 sm:w-44`}
            value={query.status}
            onChange={(event) => go({ status: event.target.value as StatusFilter, page: 1 })}
          >
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {statusLabel[status]}
              </option>
            ))}
          </select>
          <div className="relative min-w-0 sm:w-72">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-zinc-400" />
            <input
              type="search"
              name="q"
              defaultValue={query.q ?? ""}
              placeholder={copy.searchPlaceholder}
              aria-label={copy.searchLabel}
              className={`${field} h-9 pr-3 pl-9`}
              onChange={(event) => {
                const value = event.target.value.trim();
                window.clearTimeout(timer.current);
                timer.current = window.setTimeout(() => go({ q: value || undefined, page: 1 }, "replace"), 300);
              }}
            />
          </div>
          <a href={financialExportHref(query)} className={`${btn.base} ${btn.primary} ${btn.md}`}>
            <DownloadIcon size={14} />
            {copy.exportCsv}
          </a>
        </div>
      </div>

      {customOpen && (
        <form onSubmit={applyCustom} className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className="flex min-w-0 flex-col gap-1 text-[13px] font-medium text-zinc-700 sm:w-44">
            {copy.from}
            <AdminDateField key={`from-${defaults.from}`} name="from" defaultValue={defaults.from} locale={locale} copy={dateCopy} compact />
          </label>
          <label className="flex min-w-0 flex-col gap-1 text-[13px] font-medium text-zinc-700 sm:w-44">
            {copy.to}
            <AdminDateField key={`to-${defaults.to}`} name="to" defaultValue={defaults.to} locale={locale} copy={dateCopy} compact />
          </label>
          <button type="submit" className={`${btn.base} ${btn.secondary} ${btn.md}`}>
            {copy.apply}
          </button>
        </form>
      )}

      <div className="flex items-center gap-2 xl:hidden">
        <label className="sr-only" htmlFor="financial-sort">
          {copy.sortBy}
        </label>
        <select
          id="financial-sort"
          className={`${field} h-9 flex-1`}
          value={query.sort}
          onChange={(event) => {
            const sort = event.target.value as SortKey;
            const dir = sort === "client" || sort === "reference" || sort === "status" ? "asc" : "desc";
            go({ sort, dir, page: 1 });
          }}
        >
          {(Object.keys(sortLabel) as SortKey[]).map((key) => (
            <option key={key} value={key}>
              {sortLabel[key]}
            </option>
          ))}
        </select>
        <button
          type="button"
          className={`${btn.base} ${btn.secondary} ${btn.md} px-2.5`}
          aria-label={copy.sortToggle}
          onClick={() => go({ dir: query.dir === "asc" ? "desc" : "asc", page: 1 })}
        >
          <ChevronDownIcon size={14} className={query.dir === "asc" ? "rotate-180" : ""} />
        </button>
      </div>
    </div>
  );
}
