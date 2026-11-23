"use client";
import { Fragment, useEffect, useRef, useState } from "react";
import { chatMessages, deleteChat, sendChat, type ChatMessageDTO } from "@/server/chat";
import { fmtDay, today } from "@/lib/dates";
import { initials } from "@/lib/work";
import { toast } from "@/components/ui/Toaster";
import { AntTextArea } from "@/components/ui/antd";

type Channel = { id: string; name: string; color: string };
const SEEN_KEY = "dev360chatSeen";
const POLL_MS = 4000;

const readSeen = (): Record<string, string> => { try { return JSON.parse(localStorage.getItem(SEEN_KEY) || "{}"); } catch { return {}; } };
const writeSeen = (s: Record<string, string>) => { try { localStorage.setItem(SEEN_KEY, JSON.stringify(s)); } catch {} };

/** Turns issue tokens (TKN-…) and links into clickable links; everything else stays plain text. */
function MessageText({ text }: { text: string }) {
  const parts = text.split(/(TKN-\d{6}-\d{3}|https?:\/\/[^\s]+)/g);
  return <>{parts.map((p, i) => /^TKN-/.test(p) ? <a key={i} href={`/issues?st=all&edit=${p}`}>{p}</a> : /^https?:\/\//.test(p) ? <a key={i} href={p} target="_blank" rel="noopener noreferrer">{p}</a> : <Fragment key={i}>{p.split("\n").map((l, k) => <Fragment key={k}>{k > 0 && <br />}{l}</Fragment>)}</Fragment>)}</>;
}

export function ChatView({ channels, initial, canPost }: { channels: Channel[]; initial: ChatMessageDTO[]; canPost: boolean }) {
  const [messages, setMessages] = useState(initial);
  const [ch, setCh] = useState("general");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [seen, setSeen] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { setSeen(readSeen()); }, []);
  // poll for new messages
  useEffect(() => {
    let live = true;
    const t = setInterval(async () => { if (document.hidden) return; try { const m = await chatMessages(); if (live) setMessages(m); } catch {} }, POLL_MS);
    return () => { live = false; clearInterval(t); };
  }, []);
  // mark the open channel as read, and keep the view scrolled to the newest message
  const list = messages.filter(m => m.channel === ch);
  useEffect(() => {
    const last = list[list.length - 1]?.at ?? new Date().toISOString();
    setSeen(s => { const n = { ...s, [ch]: last }; writeSeen(n); return n; });
    const el = box.current;
    if (el && el.scrollHeight - el.scrollTop - el.clientHeight < 120) el.scrollTop = el.scrollHeight;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ch, list.length]);
  useEffect(() => { if (box.current) box.current.scrollTop = box.current.scrollHeight; }, [ch]);

  const unread = (id: string) => messages.filter(m => m.channel === id && !m.mine && m.at > (seen[id] || "")).length;
  const cur = channels.find(c => c.id === ch) ?? channels[0];

  const send = async () => {
    const text = (drafts[ch] ?? "").trim();
    if (!text || sending) return;
    setSending(true);
    setDrafts(d => ({ ...d, [ch]: "" }));
    const r = await sendChat(ch, text);
    setSending(false);
    if (!r.ok) { toast(r.error); setDrafts(d => ({ ...d, [ch]: text })); return; }
    setMessages(m => [...m, r.data!]);
    requestAnimationFrame(() => { if (box.current) box.current.scrollTop = box.current.scrollHeight; input.current?.focus(); });
  };
  const remove = async (id: string) => {
    if (!confirm("Delete this message?")) return;
    const r = await deleteChat(id);
    if (!r.ok) { toast(r.error); return; }
    setMessages(m => m.filter(x => x.id !== id));
  };

  let lastDay = "";
  return (
    <div className="chatgrid" style={{ display: "grid", gridTemplateColumns: "240px minmax(0,1fr)", gap: 16, height: "calc(100vh - 220px)", minHeight: 440 }}>
      <div className="alist" style={{ overflow: "auto", alignSelf: "start", maxHeight: "100%" }}>
        {channels.map(c => {
          const n = c.id === ch ? 0 : unread(c.id);
          return (
            <div key={c.id} className="aitem" style={{ ["--c" as string]: c.color, cursor: "pointer", background: c.id === ch ? "var(--sunk)" : undefined }} onClick={() => setCh(c.id)}>
              <span className="stripe" /><div style={{ minWidth: 0 }}><div className="t"># {c.name}</div></div>
              {n > 0 ? <span className="chip" style={{ ["--c" as string]: "var(--bad)" }}>{n}</span> : <span />}
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", flexDirection: "column", minHeight: 0, border: "1px solid var(--line)", borderRadius: "var(--rl)", background: "var(--sunk)", overflow: "hidden", boxShadow: "var(--sh)" }}>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--line)", background: "var(--surface)", display: "flex", alignItems: "center", gap: 10 }}>
          <i className="dot" style={{ background: cur.color }} /><b style={{ font: "700 15px var(--display)" }}># {cur.name}</b>
          <span className="muted" style={{ fontSize: 12 }}>Visible to everyone with access to this tracker</span>
        </div>
        <div ref={box} id="chat_box" style={{ flex: 1, overflowY: "auto", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
          {!list.length && <div className="empty" style={{ margin: "auto", border: 0, background: "transparent" }}><b>No messages yet</b>Start the conversation. Paste an issue token like TKN-261021-001 to link it.</div>}
          {list.map(m => {
            const day = m.at.slice(0, 10);
            const sep = day !== lastDay;
            lastDay = day;
            return (
              <Fragment key={m.id}>
                {sep && <div style={{ textAlign: "center", margin: "10px 0 4px" }}><span className="chip" style={{ ["--c" as string]: "var(--muted)" }}>{day === today() ? "Today" : fmtDay(day)}</span></div>}
                <div style={{ display: "flex", gap: 9, alignItems: "flex-end", flexDirection: m.mine ? "row-reverse" : "row" }}>
                  <div className="av" style={{ width: 32, height: 32, borderRadius: 10, fontSize: 11 }}>{initials(m.author)}</div>
                  <div style={{ maxWidth: "min(560px,78%)", display: "flex", flexDirection: "column", alignItems: m.mine ? "flex-end" : "flex-start", gap: 2 }}>
                    <span style={{ fontSize: 11.5, color: "var(--muted)" }}>
                      <b style={{ color: "var(--fg)" }}>{m.mine ? "You" : m.author}</b> · {new Date(m.at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                      {m.mine && <> · <button type="button" onClick={() => remove(m.id)} style={{ border: 0, background: "none", padding: 0, color: "inherit", textDecoration: "underline", cursor: "pointer", font: "inherit" }}>delete</button></>}
                    </span>
                    <div style={{ padding: "9px 13px", borderRadius: m.mine ? "14px 14px 4px 14px" : "14px 14px 14px 4px", background: m.mine ? "var(--accent)" : "var(--surface)", color: m.mine ? "var(--accent-ink)" : "var(--fg)", border: `1px solid ${m.mine ? "var(--accent)" : "var(--line)"}`, fontSize: 14, lineHeight: 1.45, overflowWrap: "anywhere", boxShadow: "var(--sh)" }}>
                      <MessageText text={m.text} />
                    </div>
                  </div>
                </div>
              </Fragment>
            );
          })}
        </div>
        {canPost ? (
          <div style={{ padding: 10, borderTop: "1px solid var(--line)", background: "var(--surface)", display: "flex", gap: 8, alignItems: "flex-end" }}>
            <AntTextArea
              ref={input as any}
              autoSize={{ minRows: 1, maxRows: 5 }}
              aria-label={`Message #${cur.name}`}
              placeholder={`Message #${cur.name} · Enter to send, Shift+Enter for a new line`}
              value={drafts[ch] ?? ""}
              onChange={e => setDrafts(d => ({ ...d, [ch]: e.target.value }))}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } }}
              style={{ flex: 1, resize: "none" }}
            />
            <button className="btn primary" type="button" onClick={send} disabled={sending}>Send</button>
          </div>
        ) : <div className="muted" style={{ padding: 12, borderTop: "1px solid var(--line)", background: "var(--surface)" }}>You have read-only access, so you can&apos;t post.</div>}
      </div>
    </div>
  );
}
