"use client";

import { useCallback, useState, useTransition } from "react";
import { LegalText } from "@/lib/legal/legal-text";
import { pushToast } from "../../_components/action-feedback";
import { AdminModal } from "../../_components/admin-modal";
import { EyeIcon } from "../../_components/icons";
import { btn, field, fieldLabel } from "../../_components/ui";
import { deleteLegalVersion, draftFromVersion, publishLegalDraft, saveLegalDraft } from "./legal-actions";
import type { LegalVersionView } from "./platform";

type Doc = "terms" | "privacy";
type Draft = { id: string | null; version: string; effectiveOn: string; body: string };

const DATE = new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "UTC" });
const showDate = (iso: string) => (iso ? DATE.format(new Date(`${iso}T00:00:00Z`)) : "—");

function form(entries: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
}

/**
 * One legal document in Settings (desk/page.tsx): the version live on the website, the drafts (edit, preview, publish,
 * delete) and the published history. Publishing saves the draft first, so what is published is what is on screen.
 */
export function LegalEditor({ doc, name, versions, publicPath }: { doc: Doc; name: string; versions: LegalVersionView[]; publicPath: string }) {
  const live = versions.find((entry) => entry.current) ?? null;
  const drafts = versions.filter((entry) => entry.status === "draft");
  const published = versions.filter((entry) => entry.status === "published");

  const [editing, setEditing] = useState<Draft | null>(null);
  const [saved, setSaved] = useState<Draft | null>(null);
  const [viewing, setViewing] = useState<LegalVersionView | { version: string; body: string; draft: true } | null>(null);
  const [confirm, setConfirm] = useState<{ kind: "publish" | "delete"; entry: LegalVersionView | null } | null>(null);
  const [pending, start] = useTransition();
  const closeViewer = useCallback(() => setViewing(null), []);
  const closeConfirm = useCallback(() => setConfirm(null), []);

  const unsaved = editing !== null && (saved === null || editing.version !== saved.version || editing.effectiveOn !== saved.effectiveOn || editing.body !== saved.body);

  function open(entry: LegalVersionView) {
    const draft = { id: entry.id, version: entry.version, effectiveOn: entry.status === "draft" ? entry.effectiveOn : "", body: entry.body };
    setEditing(draft);
    setSaved(draft);
  }

  async function save(): Promise<string | null> {
    if (!editing) return null;
    const result = await saveLegalDraft(form({ doc, id: editing.id ?? "", version: editing.version, effectiveOn: editing.effectiveOn, body: editing.body }));
    if ("error" in result) {
      pushToast(result.error, false);
      return null;
    }
    const next = { ...editing, id: result.id ?? editing.id };
    setEditing(next);
    setSaved(next);
    return next.id;
  }

  function onSave() {
    start(async () => {
      if (await save()) pushToast("Draft saved. The website is unchanged until you publish it.");
    });
  }

  function onPublish() {
    start(async () => {
      const id = unsaved || !editing?.id ? await save() : editing.id;
      if (!id) return;
      const result = await publishLegalDraft(form({ id }));
      setConfirm(null);
      if ("error" in result) return pushToast(result.error, false);
      pushToast(`${name} published. The website shows it now.`);
      setEditing(null);
      setSaved(null);
    });
  }

  function onDelete(entry: LegalVersionView) {
    start(async () => {
      const result = await deleteLegalVersion(form({ id: entry.id }));
      setConfirm(null);
      if ("error" in result) return pushToast(result.error, false);
      pushToast(entry.status === "draft" ? "Draft deleted." : `Version ${entry.version} deleted.`);
      if (editing?.id === entry.id) {
        setEditing(null);
        setSaved(null);
      }
    });
  }

  function onDraftFrom(entry: LegalVersionView) {
    start(async () => {
      const result = await draftFromVersion(form({ id: entry.id }));
      if ("error" in result) return pushToast(result.error, false);
      pushToast("New draft made. Edit it below, then publish it.");
    });
  }

  return (
    <>
      <div className="flex flex-col gap-3 px-5 py-4">
        {live ? (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-2.5">
            <div className="min-w-0 flex-1 text-sm">
              <p className="m-0 font-medium text-zinc-950">
                Live on the website: version {live.version}, {doc === "terms" ? "effective" : "last updated"} {showDate(live.effectiveOn)}
              </p>
              <p className="m-0 mt-0.5 text-xs text-zinc-600">
                Published {live.publishedAt} by {live.publishedBy}
                {doc === "terms" && live.bookings > 0 ? ` · ${live.bookings === 1 ? "1 booking" : `${live.bookings} bookings`} agreed to it` : ""}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <a href={publicPath} target="_blank" rel="noopener noreferrer" className={`${btn.base} ${btn.secondary} ${btn.sm}`}>
                Open page
              </a>
              <button type="button" disabled={pending} onClick={() => onDraftFrom(live)} className={`${btn.base} ${btn.primary} ${btn.sm}`}>
                Edit as new draft
              </button>
            </div>
          </div>
        ) : (
          <p className="m-0 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-900">
            Nothing published yet: the website shows the built-in text. Publish a draft to replace it.
          </p>
        )}

        <div>
          <h3 className="m-0 text-[13px] font-semibold text-zinc-950">Drafts</h3>
          {drafts.length === 0 ? (
            <p className="m-0 mt-1 text-[13px] text-zinc-500">No drafts. Use “Edit as new draft” to change the text; the website changes only when you publish.</p>
          ) : (
            <ul className="m-0 mt-2 list-none divide-y divide-zinc-100 rounded-lg border border-zinc-200/80 p-0">
              {drafts.map((entry) => (
                <li key={entry.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="m-0 flex items-center gap-2 text-sm font-medium text-zinc-950">
                      Version {entry.version}
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">Draft</span>
                    </p>
                    <p className="m-0 mt-0.5 text-xs text-zinc-500">Saved {entry.savedAt} · {entry.savedBy}</p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button type="button" disabled={pending} onClick={() => open(entry)} className={`${btn.base} ${btn.secondary} ${btn.sm}`}>
                      Edit
                    </button>
                    <button type="button" disabled={pending} onClick={() => setConfirm({ kind: "delete", entry })} className={`${btn.base} ${btn.ghost} ${btn.sm} text-red-700`}>
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {editing && (
          <div className="flex flex-col gap-4 rounded-lg border border-zinc-200 p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5">
                <span className={fieldLabel}>Version</span>
                <input
                  required
                  maxLength={40}
                  value={editing.version}
                  onChange={(event) => setEditing({ ...editing, version: event.target.value })}
                  className={`${field} h-10`}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className={fieldLabel}>{doc === "terms" ? "Effective date" : "Last updated"}</span>
                <input
                  type="date"
                  value={editing.effectiveOn}
                  onChange={(event) => setEditing({ ...editing, effectiveOn: event.target.value })}
                  className={`${field} h-10`}
                />
                <span className="text-xs text-zinc-500">Left empty, it becomes the day you publish.</span>
              </label>
            </div>
            <label className="flex flex-col gap-1.5">
              <span className={fieldLabel}>Text</span>
              <textarea
                rows={18}
                value={editing.body}
                onChange={(event) => setEditing({ ...editing, body: event.target.value })}
                className={`${field} resize-y py-2.5 font-mono text-[13px] leading-relaxed`}
              />
              <span className="text-xs leading-relaxed text-zinc-500">
                <code>## Heading</code> starts a section · <code>- </code> a bullet, <code>{"  - "}</code> (two spaces first) a sub-bullet ·{" "}
                <code>**bold**</code> · <code>[text](https://…)</code> or <code>[email](mailto:…)</code> a link · a blank line starts a new paragraph
                {doc === "privacy" ? (
                  <>
                    {" "}· <code>[[cookies]]</code> on its own line places the cookie table
                  </>
                ) : null}
                .
              </span>
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" disabled={pending} onClick={onSave} className={`${btn.base} ${btn.secondary} ${btn.md}`}>
                Save draft
              </button>
              <button type="button" disabled={pending} onClick={() => setViewing({ version: editing.version, body: editing.body, draft: true })} className={`${btn.base} ${btn.secondary} ${btn.md}`}>
                <EyeIcon size={14} /> Preview
              </button>
              <button type="button" disabled={pending || !editing.body.trim()} onClick={() => setConfirm({ kind: "publish", entry: null })} className={`${btn.base} ${btn.primary} ${btn.md}`}>
                Publish to website
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  setEditing(null);
                  setSaved(null);
                }}
                className={`${btn.base} ${btn.ghost} ${btn.md}`}
              >
                Close
              </button>
              {unsaved && <span className="text-xs text-zinc-500">Unsaved changes</span>}
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-zinc-100 px-5 py-4">
        <h3 className="m-0 text-[13px] font-semibold text-zinc-950">Published versions</h3>
        {published.length === 0 ? (
          <p className="mt-2 mb-0 text-[13px] text-zinc-500">None yet.</p>
        ) : (
          <ul className="m-0 mt-2 list-none divide-y divide-zinc-100 rounded-lg border border-zinc-200/80 p-0">
            {published.map((entry) => (
              <li key={entry.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="m-0 flex items-center gap-2 text-sm font-medium text-zinc-950">
                    Version {entry.version}
                    {entry.current && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800">Live</span>}
                  </p>
                  <p className="m-0 mt-0.5 text-xs text-zinc-500">
                    {entry.publishedAt ? `Published ${entry.publishedAt} · ${entry.publishedBy}` : `Saved ${entry.savedAt} · ${entry.savedBy}`}
                    {doc === "terms" && entry.bookings > 0 ? ` · ${entry.bookings === 1 ? "1 booking" : `${entry.bookings} bookings`}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button type="button" onClick={() => setViewing(entry)} className={`${btn.base} ${btn.secondary} ${btn.sm}`}>
                    <EyeIcon size={14} /> View
                  </button>
                  {!entry.current && (
                    <button type="button" disabled={pending} onClick={() => onDraftFrom(entry)} className={`${btn.base} ${btn.secondary} ${btn.sm}`}>
                      Copy to draft
                    </button>
                  )}
                  {published.length > 1 && !(doc === "terms" && entry.bookings > 0) && (
                    <button type="button" disabled={pending} onClick={() => setConfirm({ kind: "delete", entry })} className={`${btn.base} ${btn.ghost} ${btn.sm} text-red-700`}>
                      Delete
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <AdminModal isOpen={viewing !== null} onClose={closeViewer} title={viewing ? `${name}, version ${viewing.version}${"draft" in viewing ? " (preview)" : ""}` : ""}>
        {viewing && (
          <>
            <div className="max-h-[65vh] overflow-auto rounded-lg border border-zinc-200 bg-white p-4">
              <LegalText text={viewing.body} tone="admin" />
            </div>
            <div className="flex justify-end">
              <button type="button" onClick={closeViewer} className={`${btn.base} ${btn.secondary} ${btn.md}`}>
                Close
              </button>
            </div>
          </>
        )}
      </AdminModal>

      <AdminModal
        isOpen={confirm !== null}
        onClose={closeConfirm}
        title={confirm?.kind === "publish" ? `Publish version ${editing?.version ?? ""}?` : confirm?.entry?.status === "draft" ? "Delete this draft?" : `Delete version ${confirm?.entry?.version ?? ""}?`}
      >
        {confirm && (
          <>
            <p className="m-0 text-sm text-zinc-700">
              {confirm.kind === "publish"
                ? `The website shows this text straight away${doc === "terms" ? ", and new bookings agree to this version" : ""}.`
                : confirm.entry?.current
                  ? `This is the live version. The website goes back to the version published before it. This cannot be undone.`
                  : "This cannot be undone."}
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={closeConfirm} className={`${btn.base} ${btn.secondary} ${btn.md}`}>
                Cancel
              </button>
              {confirm.kind === "publish" ? (
                <button type="button" disabled={pending} onClick={onPublish} className={`${btn.base} ${btn.primary} ${btn.md}`}>
                  Publish
                </button>
              ) : (
                <button type="button" disabled={pending} onClick={() => confirm.entry && onDelete(confirm.entry)} className={`${btn.base} ${btn.danger} ${btn.md}`}>
                  Delete
                </button>
              )}
            </div>
          </>
        )}
      </AdminModal>
    </>
  );
}
