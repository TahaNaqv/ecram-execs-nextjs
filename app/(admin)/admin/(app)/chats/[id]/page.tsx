import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { chatDetail } from "@/lib/admin/chats";
import { formatTimestamp } from "@/lib/admin/format";
import { requireAdmin } from "@/lib/auth/session";
import type { ConciergeMessageMeta } from "@/lib/db/schema";
import { adminDictionary } from "@/lib/i18n/get-dictionary";
import { interpolate } from "@/lib/i18n/interpolate";
import { ArrowLeftIcon } from "../../../_components/icons";
import { DeleteRecord } from "../../../_components/delete-record";
import { btn, Card, CardHeader, PageBody, Skeleton } from "../../../_components/ui";
import { deleteChat } from "../../../actions";

// Allow blocking dynamic rendering under cacheComponents for this route
export const instant = false;


export async function generateMetadata(): Promise<Metadata> {
  const { admin } = await adminDictionary();
  return { title: admin.chats.detailTitle };
}

async function BackLabel() {
  const { admin } = await adminDictionary();
  return admin.chats.backToChats;
}

export default function ChatPage({ params }: PageProps<"/admin/chats/[id]">) {
  return (
    <PageBody>
      <Link href="/admin/chats" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-zinc-500 transition-colors hover:text-zinc-950">
        <ArrowLeftIcon size={14} />
        <Suspense fallback={<span className="inline-block h-[1em] w-28 animate-pulse rounded bg-zinc-100 align-middle" />}>
          <BackLabel />
        </Suspense>
      </Link>
      <Suspense fallback={<Skeleton className="mt-6 h-96 w-full" />}>
        <Detail params={params} />
      </Suspense>
    </PageBody>
  );
}

const pill = "rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset bg-zinc-50 text-zinc-600 ring-zinc-200";

/** A draft value as text: lists (stops) read as a line each, everything else as it is. Always shown as text, never as markup. */
function show(value: unknown): string {
  if (Array.isArray(value)) return value.map((v) => (v && typeof v === "object" && "place" in v ? `${String((v as { place: unknown }).place)}${(v as { wait?: number }).wait ? ` (${(v as { wait: number }).wait} min)` : ""}` : String(v))).join("\n");
  return String(value);
}

async function Detail({ params }: Pick<PageProps<"/admin/chats/[id]">, "params">) {
  const { id } = await params;
  const [{ admin: t }, admin, data] = await Promise.all([adminDictionary(), requireAdmin(), chatDetail((await params).id)]);
  if (!data) notFound();
  const { chat, messages, days, live } = data;
  const c = t.chats;
  const draft = Object.entries(chat.draft ?? {});
  const fieldLabels = c.draftFields as Record<string, string>;

  return (
    <div className="mt-6">
      <h1 className="m-0 text-2xl font-semibold tracking-tight text-zinc-950">{c.detailTitle}</h1>
      <p className="mt-1 mb-0 flex flex-wrap gap-x-3 gap-y-1 text-sm text-zinc-500">
        <span>
          {c.started}: {formatTimestamp(chat.startedAt, admin.locale)}
        </span>
        <span aria-hidden="true">·</span>
        <span>
          {c.last}: {formatTimestamp(chat.lastMessageAt, admin.locale)}
        </span>
        <span aria-hidden="true">·</span>
        <span className="uppercase">{chat.locale}</span>
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <Card>
          <ol className="m-0 flex list-none flex-col gap-4 p-5" aria-label={c.detailTitle}>
            {messages.map((m) => {
              const mine = m.role === "visitor";
              const meta = (m.meta ?? {}) as ConciergeMessageMeta;
              return (
                <li key={m.id} data-role={m.role} className={`flex max-w-[85%] flex-col gap-1.5 ${mine ? "self-end items-end" : "self-start items-start"}`}>
                  <span className="text-[11px] text-zinc-500">{mine ? c.visitor : c.concierge}</span>
                  <p className={`m-0 whitespace-pre-wrap break-words rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${mine ? "bg-zinc-950 text-white" : "bg-zinc-100 text-zinc-900"}`}>{m.content}</p>
                  {!mine && (meta.handoff || meta.cars || meta.filtered || meta.fallback || meta.ready) && (
                    <span className="flex flex-wrap gap-1.5">
                      {meta.handoff && <span className={pill}>{c.handedOver}</span>}
                      {meta.cars && <span className={pill}>{c.carsShown}</span>}
                      {meta.filtered && <span className={pill}>{c.filtered}</span>}
                      {meta.fallback && <span className={pill}>{c.fallback}</span>}
                      {meta.ready && <span className={pill}>{c.readyNotSent}</span>}
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader title={c.requestTitle} />
            <div className="p-5 pt-0 text-sm text-zinc-600">
              {chat.requestId ? (
                <>
                  <p className="m-0 mb-3">{c.requestNote}</p>
                  <Link href={`/admin/requests/${chat.requestId}`} className={`${btn.base} ${btn.secondary} ${btn.md}`}>
                    {c.viewRequest} · {chat.reference}
                  </Link>
                </>
              ) : (
                <p className="m-0">{c.noRequest}</p>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title={c.draftTitle} />
            <div className="p-5 pt-0">
              <p className="m-0 mb-3 text-xs text-zinc-500">{c.draftNote}</p>
              {draft.length === 0 ? (
                <p className="m-0 text-sm text-zinc-500">{c.noDraft}</p>
              ) : (
                <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                  {draft.map(([key, value]) => (
                    <div key={key} className="contents">
                      <dt className="text-zinc-500">{fieldLabels[key] ?? key}</dt>
                      <dd className="m-0 min-w-0 whitespace-pre-line break-words text-zinc-900">{show(value)}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          </Card>

          <DeleteRecord
            id={id}
            reference={formatTimestamp(chat.startedAt, admin.locale)}
            noun={c.deleteNoun}
            action={deleteChat}
            copy={{ title: t.common.dangerZone, note: interpolate(live ? c.keptNoteBooking : c.keptNote, { days }), confirm: t.common.deleteConfirm, deleting: t.common.deleting }}
          />
        </div>
      </div>
    </div>
  );
}
