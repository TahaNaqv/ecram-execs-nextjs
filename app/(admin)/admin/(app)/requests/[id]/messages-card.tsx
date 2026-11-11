import { unstable_rethrow } from "next/navigation";
import { formatTimestamp } from "@/lib/admin/format";
import { listRequestMessages } from "@/lib/admin/portal";
import { adminDictionary } from "@/lib/i18n/get-dictionary";
import { interpolate } from "@/lib/i18n/interpolate";
import { ChatIcon } from "../../../_components/icons";
import { Card, CardHeader } from "../../../_components/ui";
import { MessagesPanel } from "./messages-panel";

/**
 * The conversation with the customer about this request: a partner in their portal, or a website visitor on their
 * booking's private page (`guest`). What the customer wrote is shown as plain text, never as markup.
 */
export async function MessagesCard({ requestId, guest }: { requestId: string; guest: boolean }) {
  let messages: Awaited<ReturnType<typeof listRequestMessages>>;
  let admin: Awaited<ReturnType<typeof adminDictionary>>["admin"];
  try {
    const [rows, dictionary] = await Promise.all([listRequestMessages(requestId), adminDictionary()]);
    messages = rows;
    admin = dictionary.admin;
  } catch (error) {
    unstable_rethrow(error);
    console.error("[admin messages]", error);
    let title = "Messages";
    let note = "Messages could not be loaded.";
    try {
      const dictionary = await adminDictionary();
      title = dictionary.admin.messages.title;
      note = dictionary.admin.messages.loadError;
    } catch (dictionaryError) {
      unstable_rethrow(dictionaryError);
    }
    return (
      <Card className="flex min-h-0 flex-col overflow-hidden">
        <CardHeader title={title} description={note} icon={<ChatIcon />} />
      </Card>
    );
  }
  const t = admin.messages;
  const unread = messages.filter((m) => m.authorKind !== "team" && !m.seen).length;
  const thread = messages.map((m) => ({
    id: m.id,
    authorKind: m.authorKind,
    kind: m.kind,
    body: m.body,
    at: formatTimestamp(m.createdAt),
    seen: m.seen,
    by: m.by,
  }));

  return (
    <Card className="flex h-[378px] max-h-[378px] min-h-0 flex-col overflow-hidden">
      <CardHeader
        title={t.title}
        description={t.note}
        icon={<ChatIcon />}
        actions={
          unread > 0 ? (
            <span
              className="inline-flex min-w-5 items-center justify-center rounded-full bg-zinc-950 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-white"
              title={interpolate(t.unreadBadge, { count: unread })}
              aria-label={interpolate(t.unreadBadge, { count: unread })}
            >
              {unread}
            </span>
          ) : null
        }
      />
      <MessagesPanel
        key={guest ? "guest" : "partner"}
        requestId={requestId}
        messages={thread}
        unread={unread}
        copy={{
          empty: t.empty,
          replyLabel: t.replyLabel,
          replyPlaceholder: t.replyPlaceholder,
          send: t.send,
          sending: t.sending,
          sent: t.sent,
          fromPartner: t.fromPartner,
          fromGuest: t.fromGuest,
          fromTeam: t.fromTeam,
          tagChange: t.tagChange,
          tagCancel: t.tagCancel,
          unseen: t.unseen,
          unreadBadge: t.unreadBadge,
        }}
      />
    </Card>
  );
}
