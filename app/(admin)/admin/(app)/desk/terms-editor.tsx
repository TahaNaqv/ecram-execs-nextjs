"use client";

import { useCallback, useRef, useState } from "react";
import { ActionForm } from "../../_components/action-feedback";
import { AdminModal } from "../../_components/admin-modal";
import { EyeIcon, UndoIcon } from "../../_components/icons";
import { btn, field, fieldLabel } from "../../_components/ui";
import type { SettingsResult } from "./actions";

export type TermsVersion = { id: string; version: string; body: string; savedAt: string; savedBy: string };

export function TermsEditor({
  terms,
  history,
  action,
}: {
  terms: { version: string; body: string };
  history: TermsVersion[];
  action: (formData: FormData) => Promise<SettingsResult>;
}) {
  const [version, setVersion] = useState(terms.version);
  const [body, setBody] = useState(terms.body);
  const [viewing, setViewing] = useState<TermsVersion | null>(null);
  const [restored, setRestored] = useState<string | null>(null);
  const versionRef = useRef<HTMLInputElement>(null);
  const closeViewer = useCallback(() => setViewing(null), []);

  const unsaved = body.trim() !== terms.body.trim() || version.trim() !== terms.version;

  function restore(entry: TermsVersion) {
    setBody(entry.body);
    setRestored(entry.version);
    setViewing(null);
    requestAnimationFrame(() => {
      versionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      versionRef.current?.focus();
      versionRef.current?.select();
    });
  }

  return (
    <>
      <ActionForm action={action} success="Terms saved!" onDone={() => setRestored(null)} className="flex flex-col gap-4 px-5 py-4">
        {restored && (
          <p className="m-0 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-900">
            The text of version {restored} is in the editor. Give it a new version number and save to make it the current terms.
          </p>
        )}
        <label className="flex flex-col gap-1.5">
          <span className={fieldLabel}>Version</span>
          <input
            ref={versionRef}
            name="version"
            required
            maxLength={40}
            value={version}
            onChange={(event) => setVersion(event.target.value)}
            className={`${field} h-10 max-w-48`}
          />
          <span className="text-xs text-zinc-500">Raise the version whenever the text changes, so the previous terms are kept.</span>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={fieldLabel}>Text</span>
          <textarea
            name="body"
            required
            rows={12}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            className={`${field} resize-y py-2.5 leading-relaxed`}
          />
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <button className={`${btn.base} ${btn.primary} ${btn.md}`}>Save terms</button>
          {unsaved && <span className="text-xs text-zinc-500">Unsaved changes</span>}
        </div>
      </ActionForm>

      <div className="border-t border-zinc-100 px-5 py-4">
        <h3 className="m-0 text-[13px] font-semibold text-zinc-950">Previous versions</h3>
        {history.length === 0 ? (
          <p className="mt-2 mb-0 text-[13px] text-zinc-500">No saved versions yet. Each save keeps a copy here.</p>
        ) : (
          <ul className="m-0 mt-2 list-none divide-y divide-zinc-100 rounded-lg border border-zinc-200/80 p-0">
            {history.map((entry) => {
              const current = entry.version === terms.version;
              return (
                <li key={entry.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="m-0 flex items-center gap-2 text-sm font-medium text-zinc-950">
                      Version {entry.version}
                      {current && <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600">Current</span>}
                    </p>
                    <p className="m-0 mt-0.5 text-xs text-zinc-500">
                      {entry.savedAt} · {entry.savedBy}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button type="button" onClick={() => setViewing(entry)} className={`${btn.base} ${btn.secondary} ${btn.sm}`}>
                      <EyeIcon size={14} /> View
                    </button>
                    {!current && (
                      <button type="button" onClick={() => restore(entry)} className={`${btn.base} ${btn.secondary} ${btn.sm}`}>
                        <UndoIcon size={14} /> Restore
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <AdminModal
        isOpen={viewing !== null}
        onClose={closeViewer}
        title={viewing ? `Terms, version ${viewing.version}` : ""}
        subtitle={viewing ? `Saved ${viewing.savedAt} by ${viewing.savedBy}` : undefined}
      >
        {viewing && (
          <>
            <pre className="m-0 max-h-[60vh] overflow-auto whitespace-pre-wrap break-words rounded-lg border border-zinc-200 bg-zinc-50 p-3 font-sans text-[13px] leading-relaxed text-zinc-800">
              {viewing.body}
            </pre>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={closeViewer} className={`${btn.base} ${btn.secondary} ${btn.md}`}>Close</button>
              {viewing.version !== terms.version && (
                <button type="button" onClick={() => restore(viewing)} className={`${btn.base} ${btn.primary} ${btn.md}`}>
                  <UndoIcon size={14} /> Restore into editor
                </button>
              )}
            </div>
          </>
        )}
      </AdminModal>
    </>
  );
}
