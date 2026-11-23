"use client";
import { useEffect, useRef, useState } from "react";
import { Input } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import { searchAll, type SearchGroup } from "@/server/search";
import { AItem } from "@/components/ui/bits";
import { Panel } from "@/components/ui/Panel";

/** "Search everything" panel. Opens from the header button or Ctrl+K / ⌘K. */
export function SearchPanel({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState("");
  const [res, setRes] = useState<SearchGroup[] | null>(null);
  const seq = useRef(0);
  useEffect(() => {
    if (q.trim().length < 2) { setRes(null); return; }
    const n = ++seq.current;
    const t = setTimeout(() => searchAll(q).then(r => { if (n === seq.current) setRes(r); }), 200);
    return () => clearTimeout(t);
  }, [q]);
  return (
    <Panel wide title="Search everything" onClose={onClose}>
      <Input
        size="large"
        prefix={<SearchOutlined style={{ color: "var(--muted)", marginRight: 6 }} />}
        autoFocus
        autoComplete="off"
        aria-label="Search"
        placeholder="Tasks, issue tokens, meetings, developers, people, companies…"
        value={q}
        onChange={e => setQ(e.target.value)}
        allowClear
        style={{ width: "100%", borderRadius: "var(--r)", marginBottom: 8 }}
      />
      {q.trim().length < 2 ? <p className="muted">Type at least 2 letters. Tip: press Ctrl+K anywhere to open search.</p>
        : res === null ? <p className="muted">Searching…</p>
        : !res.length ? <p className="muted">Nothing found for “{q}”.</p>
        : res.map(g => (
          <section key={g.label}>
            <h3 className="sec" style={{ margin: "10px 0 6px", fontSize: 14 }}>{g.label}</h3>
            <div className="alist" onClick={e => { if ((e.target as HTMLElement).closest("a")) onClose(); }}>
              {g.hits.map((h, i) => <AItem key={i} color={h.color} href={h.href} title={h.title} sub={h.sub} />)}
            </div>
          </section>
        ))}
    </Panel>
  );
}
