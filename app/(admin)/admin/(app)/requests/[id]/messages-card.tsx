import { formatTimestamp } from "@/lib/admin/format";
import { listRequestMessages } from "@/lib/admin/portal";
import { adminDictionary } from "@/lib/i18n/get-dictionary";
import { ChatIcon } from "../../../_components/icons";
import { Card, CardHeader } from "../../../_components/ui";
import { MarkSeen, ReplyForm } from "./reply-form";

/** The conversation with the partner about this request. Partner-written text is shown as plain text, never as markup. */
export async function MessagesCard({ requestId, linked }: { requestId: string; linked: boolean }) {
  const [messages, { admin }] = await Promise.all([listRequestMessages(requestId), adminDictionary()]);
  const t = admin.messages;
  // Nothing to show on a request with no partner and no history
  if (!linked && messages.length === 0) return null;
  const unseen = messages.some((m) => m.authorKind === "partner" && !m.seen);

  return (
    <Card>
      <CardHeader title={t.title} description={t.note} icon={<ChatIcon />} />
      {unseen && <MarkSeen requestId={requestId} />}
      <div className="flex flex-col gap-4 p-5">
        {messages.length === 0 ? (
          <p className="m-0 text-sm text-zinc-500">{t.empty}</p>
        ) : (
          <ol className="m-0 flex list-none flex-col gap-3 p-0">
            {messages.map((m) => {
              const partner = m.authorKind === "partner";
              return (
                <li key={m.id} className={`rounded-lg border p-3 ${partner ? "border-zinc-200 bg-white" : "border-zinc-900/10 bg-zinc-50"}`}>
                  <p className="m-0 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-500">
                    <strong className="text-zinc-900">{partner ? t.fromPartner : (m.by ?? t.fromTeam)}</strong>
                    {m.kind === "change" && <span className="rounded bg-amber-100 px-1.5 py-0.5 font-medium text-amber-900">{t.tagChange}</span>}
                    {m.kind === "cancel" && <span className="rounded bg-red-100 px-1.5 py-0.5 font-medium text-red-800">{t.tagCancel}</span>}
                    {partner && !m.seen && <span className="rounded bg-zinc-950 px-1.5 py-0.5 font-medium text-white">{t.unseen}</span>}
                    <span>{formatTimestamp(m.createdAt)}</span>
                  </p>
                  <p className="mt-1.5 mb-0 whitespace-pre-wrap wrap-break-word text-sm text-zinc-900">{m.body}</p>
                </li>
              );
            })}
          </ol>
        )}
        {linked ? (
          <ReplyForm requestId={requestId} copy={{ label: t.replyLabel, placeholder: t.replyPlaceholder, send: t.send, sending: t.sending, sent: t.sent }} />
        ) : (
          <p className="m-0 text-sm text-zinc-500">{t.needsPartner}</p>
        )}
      </div>
    </Card>
  );
}
