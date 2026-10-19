// Shared admin primitives. Class strings are exported so client components and forms can reuse them.

export const btn = {
  base: "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-60",
  primary: "bg-zinc-950 text-white shadow-sm hover:bg-zinc-800 active:bg-zinc-900",
  secondary: "border border-zinc-200 bg-white text-zinc-800 shadow-card hover:border-zinc-300 hover:bg-zinc-50",
  ghost: "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950",
  danger: "bg-red-600 text-white shadow-sm hover:bg-red-700",
  sm: "h-8 px-3 text-[13px]",
  md: "h-9 px-3.5",
  lg: "h-10 px-4",
};

export const field =
  "w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 shadow-card outline-none transition placeholder:text-zinc-400 hover:border-zinc-300 focus:border-zinc-900 focus:ring-4 focus:ring-zinc-900/5 aria-invalid:border-red-400";

export const fieldLabel = "text-[13px] font-medium text-zinc-700";

export function Card({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return <section className={`rounded-xl border border-zinc-200/80 bg-white shadow-card ${className}`}>{children}</section>;
}

export function CardHeader({
  title,
  description,
  icon,
  actions,
}: {
  title: string;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <header className="flex items-start justify-between gap-4 border-b border-zinc-100 px-5 py-4">
      <div className="flex min-w-0 items-center gap-3">
        {icon && <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-zinc-100 text-zinc-600">{icon}</span>}
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-zinc-950">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-zinc-500">{description}</p>}
        </div>
      </div>
      {actions}
    </header>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  eyebrow?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow}
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 sm:text-[28px]">{title}</h1>
        {description && <p className="mt-1 text-sm text-zinc-500">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function PageBody({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-10 lg:py-10">{children}</main>;
}

const AVATAR_TONES = [
  "bg-zinc-900 text-white",
  "bg-stone-200 text-stone-800",
  "bg-slate-200 text-slate-800",
  "bg-neutral-300 text-neutral-900",
  "bg-zinc-700 text-white",
  "bg-gray-200 text-gray-800",
];

export function initials(name: string) {
  const parts = name.replace(/&/g, " ").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return ((parts[0][0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

export function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  const tone = AVATAR_TONES[Math.abs(hash) % AVATAR_TONES.length];
  const dims = { sm: "size-8 text-[11px]", md: "size-9 text-xs", lg: "size-12 text-sm" }[size];
  return (
    <span aria-hidden="true" className={`grid shrink-0 place-items-center rounded-full font-semibold tracking-wide ${dims} ${tone}`}>
      {initials(name)}
    </span>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <span className={`block animate-shimmer rounded-md bg-zinc-200/70 ${className}`} />;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <span className="grid size-11 place-items-center rounded-full bg-zinc-100 text-zinc-500 ring-8 ring-zinc-50">{icon}</span>
      <p className="mt-4 text-sm font-semibold text-zinc-900">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-zinc-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon: React.ReactNode;
  tone?: "default" | "accent";
}) {
  const accent = tone === "accent";
  return (
    <div
      className={`relative overflow-hidden rounded-xl border p-4 shadow-card sm:p-5 ${
        accent ? "border-zinc-900 bg-zinc-950 text-white" : "border-zinc-200/80 bg-white"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <p className={`text-[13px] font-medium ${accent ? "text-zinc-400" : "text-zinc-500"}`}>{label}</p>
        <span className={`grid size-8 place-items-center rounded-lg ${accent ? "bg-white/10 text-zinc-200" : "bg-zinc-100 text-zinc-500"}`}>
          {icon}
        </span>
      </div>
      <p className="mt-3 text-2xl font-semibold tabular-nums tracking-tight sm:text-[28px]">{value}</p>
      {hint && <p className={`mt-1 line-clamp-2 text-xs ${accent ? "text-zinc-400" : "text-zinc-500"}`}>{hint}</p>}
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="rounded-xl border border-zinc-200/80 bg-white p-4 shadow-card sm:p-5">
      <div className="flex items-center justify-between">
        <Skeleton className="h-3.5 w-24" />
        <Skeleton className="size-8 rounded-lg" />
      </div>
      <Skeleton className="mt-4 h-7 w-16" />
      <Skeleton className="mt-2 h-3 w-28" />
    </div>
  );
}
