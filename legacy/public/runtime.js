/* Dev 360 runtime: gives the tracker page its data, people, file and download services
   from this app's own server (window.claude.use("db" | "user" | "assets" | "downloads")). */
(function () {
  "use strict";
  const POLL_MS = 4000, POLL_HIDDEN_MS = 20000;

  async function api(url, opts = {}) {
    const r = await fetch(url, { credentials: "same-origin", ...opts, headers: { ...(opts.body && !(opts.body instanceof Blob) ? { "Content-Type": "application/json" } : {}), ...(opts.headers || {}) } });
    if (r.status === 401) { goLogin(); throw Object.assign(new Error("Signed out"), { code: "signed_out" }); }
    const ct = r.headers.get("content-type") || "";
    const body = ct.includes("json") ? await r.json().catch(() => ({})) : await r.text();
    if (!r.ok) { const e = new Error((body && (body.message || body.error)) || ("HTTP " + r.status)); e.code = (body && body.error) || "http_" + r.status; e.status = r.status; throw e; }
    return body;
  }
  let leaving = false;
  function goLogin() { if (leaving) return; leaving = true; location.replace("/login?next=" + encodeURIComponent(location.pathname + location.hash)); }

  // ---------------- session
  const meP = api("/api/me");
  window.DEV360_ME = meP;
  // a server or database failure must not drop the page into its offline demo mode unnoticed
  meP.catch(e => { if (e.code !== "signed_out") showServerDown(e); });
  function showServerDown(e) {
    const show = () => {
      const d = document.createElement("div");
      d.style.cssText = "position:fixed;inset:0;z-index:99999;display:grid;place-items:center;padding:16px;color-scheme:light dark;background:Canvas;color:CanvasText;font:15px/1.5 system-ui,sans-serif";
      d.innerHTML = '<div style="max-width:480px;width:100%"><h2 style="margin:0 0 8px">Can\'t reach the tracker\'s server</h2><p style="margin:0 0 12px">Sign-in and data are unavailable. If you run this app, check the server logs and the database settings (DATABASE_URL, SESSION_SECRET).</p><pre style="white-space:pre-wrap;margin:0 0 16px;padding:10px;border:1px solid GrayText;border-radius:6px"></pre><button type="button" style="padding:8px 14px;font:inherit">Try again</button></div>';
      d.querySelector("pre").textContent = (e.status ? "HTTP " + e.status + ": " : "") + e.message;
      d.querySelector("button").onclick = () => location.reload();
      document.body.appendChild(d);
    };
    if (document.body) show(); else document.addEventListener("DOMContentLoaded", show);
  }

  // ---------------- live document store
  const cache = new Map();        // col -> Map(id -> {data, rev})
  const listeners = new Map();    // col -> Set(listener)
  let rev = 0, synced = false, syncP = null, pollTimer = null, failures = 0;
  const colMap = c => { let m = cache.get(c); if (!m) cache.set(c, m = new Map()); return m; };
  const clone = v => (v == null ? v : JSON.parse(JSON.stringify(v)));

  const dirty = new Set(); let notifyT = null;
  function markDirty(col) { dirty.add(col); if (!notifyT) notifyT = setTimeout(flushNotify, 0); }
  function flushNotify() {
    notifyT = null;
    const cols = [...dirty]; dirty.clear();
    cols.forEach(col => (listeners.get(col) || new Set()).forEach(l => fire(l)));
  }
  function snapshotFor(l) {
    let docs = [...colMap(l.col).entries()].map(([id, v]) => ({ id, v: v.data }));
    if (l.order) {
      const [f, dir] = l.order, s = dir === "desc" ? -1 : 1;
      docs.sort((a, b) => { const x = a.v?.[f], y = b.v?.[f]; return (x === y ? 0 : x == null ? -1 : y == null ? 1 : x < y ? -1 : 1) * s; });
    } else docs.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    if (l.limit) docs = docs.slice(0, l.limit);
    const out = docs.map(d => ({ id: d.id, exists: true, data: () => clone(d.v) }));
    return { docs: out, size: out.length, empty: !out.length, forEach: fn => out.forEach(fn) };
  }
  function fire(l) { try { l.cb(snapshotFor(l)); } catch (e) { console.error(e); } }

  function apply(docs) {
    for (const d of docs) {
      const m = colMap(d.col), cur = m.get(d.id);
      if (cur && cur.rev >= d.rev) continue;
      if (d.deleted) { if (cur) { m.delete(d.id); markDirty(d.col); } }
      else { m.set(d.id, { data: d.data, rev: d.rev }); markDirty(d.col); }
    }
  }
  async function pull() {
    const r = await api("/api/db/sync?since=" + rev);
    apply(r.docs);
    rev = Math.max(rev, r.rev);
  }
  function ensureSync() {
    return (syncP ||= (async () => {
      await meP;
      await pull();
      synced = true;
      setStatus(true);
      // every subscribed collection gets its first snapshot, even when empty
      listeners.forEach((set, col) => markDirty(col));
      schedule();
      document.addEventListener("visibilitychange", () => { if (!document.hidden) { clearTimeout(pollTimer); tick(); } });
    })());
  }
  function schedule() { clearTimeout(pollTimer); pollTimer = setTimeout(tick, document.hidden ? POLL_HIDDEN_MS : Math.min(60000, POLL_MS * Math.pow(2, failures))); }
  async function tick() {
    try { await pull(); if (failures) setStatus(true); failures = 0; }
    catch (e) { failures = Math.min(failures + 1, 4); if (e.code !== "signed_out") setStatus(false); }
    schedule();
  }
  function setStatus(ok) {
    const el = document.getElementById("syncState"); if (!el || !synced) return;
    el.textContent = ok ? "Live · synced with your team" : "Offline · retrying…";
    el.classList.toggle("off", !ok);
  }

  // batched writes
  let queue = [], flushT = null;
  function enqueue(op) {
    return new Promise((resolve, reject) => {
      queue.push({ op, resolve, reject });
      if (queue.length >= 200) flushWrites(); else if (!flushT) flushT = setTimeout(flushWrites, 12);
    });
  }
  async function flushWrites() {
    clearTimeout(flushT); flushT = null;
    const batch = queue.splice(0, 200); if (!batch.length) return;
    try {
      const r = await api("/api/db/batch", { method: "POST", body: JSON.stringify({ ops: batch.map(b => b.op) }) });
      const saved = (b, i) => (r.data && r.data[i] !== undefined ? r.data[i] : b.op.data);
      apply(batch.map((b, i) => ({ col: b.op.col, id: b.op.id, data: saved(b, i), deleted: b.op.data == null, rev: r.revs[i] })));
      batch.forEach((b, i) => b.resolve(clone(saved(b, i))));
    } catch (e) {
      if (e.code === "permission_denied" || e.status === 403) e.code = "permission_denied";
      batch.forEach(b => b.reject(e));
    }
    if (queue.length) flushWrites();
  }

  function docRef(col, id) {
    return {
      id,
      async get() {
        const r = await api(`/api/db/doc/${encodeURIComponent(col)}/${encodeURIComponent(id)}`);
        return { id, exists: r.exists, data: () => clone(r.data) };
      },
      set(data) { return enqueue({ col, id, data: clone(data) || {} }); },
      async update(patch) { const cur = colMap(col).get(id); return enqueue({ col, id, data: { ...(cur ? clone(cur.data) : {}), ...clone(patch) } }); },
      delete() { return enqueue({ col, id, data: null }); },
    };
  }
  function collRef(col, order, limit) {
    return {
      doc: id => docRef(col, id || (Date.now().toString(36) + Math.random().toString(36).slice(2, 9))),
      orderBy: (f, dir = "asc") => collRef(col, [f, dir], limit),
      limit: n => collRef(col, order, n),
      async add(data) { const r = docRef(col, Date.now().toString(36) + Math.random().toString(36).slice(2, 9)); await r.set(data); return r; },
      async get() { await ensureSync(); return snapshotFor({ col, order, limit }); },
      onSnapshot(cb, err) {
        const l = { col, order, limit, cb, err };
        let set = listeners.get(col); if (!set) listeners.set(col, set = new Set());
        set.add(l);
        ensureSync().then(() => fire(l)).catch(e => { if (e.code !== "signed_out") err && err(e); });
        return () => set.delete(l);
      },
    };
  }
  const db = {
    collection: collRef,
    // server-side renumbering of task S.No (per project); pulls the result straight away
    async renumberItems(project) { const r = await api("/api/items/renumber", { method: "POST", body: JSON.stringify({ project: project ?? null }) }); await pull(); return r; },
  };

  // ---------------- people
  const user = {
    async me() { const m = await meP; return { id: m.id, name: m.name, email: m.email, isOwner: m.isOwner, canEdit: m.canEdit, openAccess: !!m.openAccess }; },
    profiles: ids => api("/api/users/profiles", { method: "POST", body: JSON.stringify({ ids }) }),
    search: q => api("/api/users/search?q=" + encodeURIComponent(q)),
  };

  // ---------------- files
  const assets = {
    async upload(file) {
      return api("/api/assets", { method: "POST", body: file, headers: { "Content-Type": file.type || "application/octet-stream", "X-Filename": encodeURIComponent(file.name || "file") } });
    },
    delete: id => api("/api/assets/" + encodeURIComponent(id), { method: "DELETE" }),
    url: id => "/_blob/" + encodeURIComponent(id),
  };

  // ---------------- downloads (Excel, JSON backup, .ics)
  const downloads = {
    async save({ filename, data }) {
      const blob = data instanceof Blob ? data : new Blob([data]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename || "download"; a.style.display = "none";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      return { status: "saved" };
    },
  };

  const caps = { db, user, assets, downloads };
  window.claude = {
    async use(name) {
      await meP; // throws (and redirects to sign-in) when signed out
      if (!(name in caps)) throw Object.assign(new Error("Unknown capability " + name), { code: "unsupported" });
      return caps[name];
    },
  };
})();
