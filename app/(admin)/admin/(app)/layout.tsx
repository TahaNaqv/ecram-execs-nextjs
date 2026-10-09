import { Suspense } from "react";
import { requireAdmin } from "@/lib/auth/session";
import { applicationCounts } from "@/lib/admin/applications";
import { statusCounts } from "@/lib/admin/queries";
import { logout } from "../actions";
import { AdminChrome } from "../_components/admin-nav";
import { LogOutIcon } from "../_components/icons";
import { Avatar } from "../_components/ui";

/** Shell shared by every signed-in admin page: sidebar navigation plus the page content. */
export default function AdminAppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      {/* The sidebar reads the URL, so it streams in after the shell (same size, no layout shift) */}
      <Suspense fallback={<ChromeFallback />}>
        <AdminChrome
          badges={{
            "/admin": (
              <Suspense fallback={null}>
                <NewRequestsBadge />
              </Suspense>
            ),
            "/admin/drivers/applications": (
              <Suspense fallback={null}>
                <NewApplicationsBadge />
              </Suspense>
            ),
          }}
          account={
            <Suspense fallback={<AccountFallback />}>
              <Account />
            </Suspense>
          }
        />
      </Suspense>
      <div className="flex min-h-dvh flex-col lg:pl-64">{children}</div>
    </div>
  );
}

function ChromeFallback() {
  return (
    <>
      <div className="sticky top-0 z-30 h-14 border-b border-zinc-800 bg-zinc-950 lg:hidden" />
      <div className="fixed inset-y-0 left-0 hidden w-64 bg-zinc-950 lg:block" />
    </>
  );
}

async function NewRequestsBadge() {
  const counts = await statusCounts();
  if (!counts.new) return null;
  return (
    <span className="rounded-full bg-white px-1.5 py-px text-[11px] font-semibold tabular-nums text-zinc-950" title={`${counts.new} new`}>
      {counts.new}
    </span>
  );
}

async function NewApplicationsBadge() {
  const counts = await applicationCounts();
  if (!counts.new) return null;
  return (
    <span
      className="rounded-full bg-white px-1.5 py-px text-[11px] font-semibold tabular-nums text-zinc-950"
      title={`${counts.new} new driver ${counts.new === 1 ? "application" : "applications"}`}
    >
      {counts.new}
    </span>
  );
}

async function Account() {
  const admin = await requireAdmin();
  return (
    <div className="flex items-center gap-3 rounded-lg px-2 py-2">
      <Avatar name={admin.name} size="sm" />
      <div className="min-w-0 flex-1 leading-tight">
        <p className="truncate text-sm font-medium text-zinc-100">{admin.name}</p>
        <p className="truncate text-xs text-zinc-500">{admin.email}</p>
      </div>
      <form action={logout}>
        <button
          title="Sign out"
          aria-label="Sign out"
          className="grid size-8 place-items-center rounded-lg text-zinc-500 transition-colors hover:bg-white/10 hover:text-white"
        >
          <LogOutIcon size={16} />
        </button>
      </form>
    </div>
  );
}

function AccountFallback() {
  return (
    <div className="flex items-center gap-3 px-2 py-2">
      <span className="size-8 rounded-full bg-white/10" />
      <div className="flex-1 space-y-1.5">
        <span className="block h-3 w-24 animate-shimmer rounded bg-white/10" />
        <span className="block h-2.5 w-32 animate-shimmer rounded bg-white/10" />
      </div>
    </div>
  );
}
