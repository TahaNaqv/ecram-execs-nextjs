import { Suspense } from "react";
import { requireAdmin, type Admin } from "@/lib/auth/session";
import { applicationCounts } from "@/lib/admin/applications";
import { statusCounts } from "@/lib/admin/queries";
import { logout } from "../actions";
import { AdminChrome } from "../_components/admin-nav";
import { adminDictionary } from "@/lib/i18n/get-dictionary";
import { LOCALES } from "@/lib/i18n/config";
import { setAdminLocale } from "../actions";
import { LogOutIcon } from "../_components/icons";
import { Avatar } from "../_components/ui";
import { AdminLang } from "../_components/admin-lang";

/** Shell shared by every signed-in admin page: sidebar navigation plus the page content. */
export default async function AdminAppLayout({ children }: { children: React.ReactNode }) {
  // Authenticate at the root layout level to handle redirects securely before streaming chunks
  const admin = await requireAdmin();

  return (
    <div className="min-h-dvh">
      {/* The sidebar reads the URL and the admin's language, so it streams in after the shell */}
      <Suspense fallback={<ChromeFallback />}>
        <Chrome admin={admin} />
      </Suspense>
      <div className="flex min-h-dvh flex-col lg:pl-64">{children}</div>
    </div>
  );
}

async function Chrome({ admin }: { admin: Admin }) {
  const { admin: t } = await adminDictionary();
  return (
    <AdminChrome
      copy={{ ...t.nav, openMenu: t.common.openMenu, closeMenu: t.common.closeMenu }}
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
      account={<Account admin={admin} />}
    />
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

async function Account({ admin }: { admin: Admin }) {
  const { admin: t } = await adminDictionary();
  return (
    <div className="flex items-center gap-3 rounded-lg px-2 py-2">
      <AdminLang locale={admin.locale} />
      <Avatar name={admin.name} size="sm" />
      <div className="min-w-0 flex-1 leading-tight">
        <p className="truncate text-sm font-medium text-zinc-100">{admin.name}</p>
        <p className="break-all text-xs text-zinc-500">{admin.email}</p>
      </div>
      {/* Language preference: admin is not locale-routed, so it lives on the account (D3). */}
      <form action={setAdminLocale} className="flex items-center gap-0.5" aria-label={t.common.language}>
        {LOCALES.map((l) => (
          <button
            key={l}
            name="locale"
            value={l}
            disabled={l === admin.locale}
            aria-current={l === admin.locale ? "true" : undefined}
            className={`rounded px-1.5 py-0.5 text-[11px] font-medium tracking-wide uppercase ${
              l === admin.locale ? "text-zinc-100" : "text-zinc-500 hover:bg-white/10 hover:text-white"
            }`}
          >
            {l}
          </button>
        ))}
      </form>
      <form action={logout}>
        <button
          title={t.common.signOut}
          aria-label={t.common.signOut}
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