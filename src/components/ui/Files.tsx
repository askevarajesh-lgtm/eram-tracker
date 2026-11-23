"use client";
import { useState } from "react";
import { X, Paperclip } from "lucide-react";
import { setFiles } from "@/server/work";
import type { FileRef } from "@/lib/work";
import { toast } from "./Toaster";

/** Files attached to a task, issue or manual: list, open, upload, remove. */
export function Files({ kind, id, files, canEdit, canRemove }: { kind: "task" | "issue" | "manual"; id: string; files: FileRef[]; canEdit: boolean; canRemove: boolean }) {
  const [list, setList] = useState(files);
  const [busy, setBusy] = useState(false);

  const upload = async (file: File) => {
    if (file.size > 20 * 1024 * 1024) { toast("File is larger than 20 MB"); return; }
    setBusy(true);
    toast("Uploading " + file.name + "…");
    try {
      const r = await fetch("/api/assets", { method: "POST", body: file, headers: { "Content-Type": file.type || "application/octet-stream", "X-Filename": encodeURIComponent(file.name) } });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { toast(j.message || (r.status === 413 ? "File is too large" : "Upload failed")); return; }
      const next = [...list, { id: j.id, name: file.name, type: j.contentType, size: j.size, t: new Date().toISOString() }];
      const s = await setFiles(kind, id, next);
      if (!s.ok) { toast(s.error); return; }
      setList(next);
      toast("Attached " + file.name);
    } finally { setBusy(false); }
  };
  const remove = async (f: FileRef) => {
    if (!confirm(`Remove ${f.name}?`)) return;
    const next = list.filter(x => x.id !== f.id);
    const s = await setFiles(kind, id, next);
    if (!s.ok) { toast(s.error); return; }
    setList(next);
    toast("File removed");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {!list.length && <span className="muted" style={{ fontSize: 13 }}>No files attached.</span>}
      {list.map(f => (
        <div key={f.id} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
          {/^image\//.test(f.type)
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={`/api/assets/${f.id}`} alt="" style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 6, border: "1px solid var(--line)" }} />
            : <span className="mtag" style={{ ["--mc" as string]: "var(--info)" }}>{(f.name.split(".").pop() || "file").toUpperCase().slice(0, 4)}</span>}
          <a href={`/api/assets/${f.id}`} target="_blank" rel="noopener" style={{ color: "var(--accent)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</a>
          <span className="muted mono" style={{ fontSize: 11 }}>{Math.max(1, Math.round((f.size || 0) / 1024))} KB</span>
          {canRemove && (
            <button
              className="btn"
              type="button"
              style={{ padding: "2px 8px", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
              aria-label={`Remove ${f.name}`}
              onClick={() => remove(f)}
            >
              <X size={14} />
            </button>
          )}
        </div>
      ))}
      {canEdit && (
        <>
          <label className="btn" style={{ alignSelf: "flex-start", cursor: busy ? "wait" : "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Paperclip size={14} />
            Attach file
            <input type="file" hidden disabled={busy} accept="image/*,application/pdf,video/*,.csv,.txt,.md,.json,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip"
              onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
          </label>
          <span className="muted" style={{ fontSize: 11 }}>Images, PDF, video, Office files or text, up to 20 MB.</span>
        </>
      )}
    </div>
  );
}
