// Storage adapter: PostgreSQL when DATABASE_URL is set (Vercel, Neon, Supabase, RDS…),
// otherwise a local SQLite file (single server / development).
"use strict";
const path = require("path");
const fs = require("fs");

const OVERLAP_MS = 15000; // re-send recently changed docs so no concurrent write is ever missed

// ---------- task serial numbers (S.No)
// Every task gets its S.No from the server, numbered per project (1, 2, 3…), inside the same
// transaction as the save. Two people adding tasks at the same moment can never get the same number.
const SNO_LOCK = 360361;
const snoNum = v => (typeof v === "number" && Number.isInteger(v) && v > 0 ? v : typeof v === "string" && /^\d+$/.test(v.trim()) && +v > 0 ? +v : null);
const projOf = d => String((d && d.module) || "");
// a new or edited task with no S.No, or one marked autoSno (e.g. moved to another project), gets the next number
const needsSno = o => o.col === "items" && o.data != null && (o.data.autoSno === true || snoNum(o.data.sno) == null);
// projects that need a new number in this batch
const snoProjects = ops => [...new Set(ops.filter(needsSno).map(o => projOf(o.data)))];
// assigns numbers to ops in place (synchronous); dbMax maps project -> highest S.No already saved
function assignSnos(ops, dbMax) {
  const next = new Map(dbMax);
  // numbers typed in by hand elsewhere in the same batch (Excel upload) are taken too
  for (const o of ops) if (o.col === "items" && o.data != null && !needsSno(o)) {
    const p = projOf(o.data), n = snoNum(o.data.sno);
    if (n > (next.get(p) || 0)) next.set(p, n);
  }
  for (const o of ops) if (needsSno(o)) {
    const p = projOf(o.data), n = (next.get(p) || 0) + 1;
    next.set(p, n);
    o.data = { ...o.data, sno: n };
    delete o.data.autoSno;
  }
}
// renumber 1..N per project, keeping the current order (S.No, then creation time); returns [{id, sno}] that change
function planRenumber(rows) {
  const by = new Map();
  rows.forEach(r => { const p = projOf(r.data); if (!by.has(p)) by.set(p, []); by.get(p).push(r); });
  const out = [];
  by.forEach(list => {
    list.sort((a, b) => (snoNum(a.data.sno) ?? 1e12) - (snoNum(b.data.sno) ?? 1e12)
      || String(a.data.createdAt || "").localeCompare(String(b.data.createdAt || "")) || a.id.localeCompare(b.id));
    list.forEach((r, i) => { if (r.data.sno !== i + 1) out.push({ id: r.id, sno: i + 1 }); });
  });
  return out;
}

function pgStore(url) {
  const { Pool } = require("pg");
  const ssl = /sslmode=disable/.test(url) || /@(localhost|127\.0\.0\.1|db|postgres)[:/]/.test(url)
    ? false
    : { rejectUnauthorized: false };
  const pool = new Pool({ connectionString: url, ssl, max: process.env.VERCEL ? 2 : 10 });
  let ready = null;
  const init = () => (ready ||= (async () => {
    await pool.query(`
      CREATE SEQUENCE IF NOT EXISTS d360_rev;
      CREATE TABLE IF NOT EXISTS d360_docs(
        col text NOT NULL, id text NOT NULL, data jsonb, deleted boolean NOT NULL DEFAULT false,
        rev bigint NOT NULL DEFAULT nextval('d360_rev'), updated_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY(col, id));
      CREATE INDEX IF NOT EXISTS d360_docs_rev ON d360_docs(rev);
      CREATE INDEX IF NOT EXISTS d360_docs_upd ON d360_docs(updated_at);
      CREATE TABLE IF NOT EXISTS d360_users(
        id text PRIMARY KEY, email text UNIQUE NOT NULL, name text NOT NULL, pass text NOT NULL,
        is_owner boolean NOT NULL DEFAULT false, active boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now());
      CREATE TABLE IF NOT EXISTS d360_blobs(
        id text PRIMARY KEY, name text, content_type text, size integer, data bytea,
        uploaded_by text, created_at timestamptz NOT NULL DEFAULT now());`);
  })());
  const q = async (sql, params) => { await init(); return pool.query(sql, params); };
  const userRow = r => r && ({ id: r.id, email: r.email, name: r.name, pass: r.pass, isOwner: r.is_owner, active: r.active, createdAt: r.created_at });
  return {
    kind: "postgres",
    init,
    async getDoc(col, id) {
      const { rows } = await q("SELECT data FROM d360_docs WHERE col=$1 AND id=$2 AND NOT deleted", [col, id]);
      return rows[0] ? rows[0].data : null;
    },
    async write(ops) {
      await init();
      const c = await pool.connect();
      const out = [];
      try {
        await c.query("BEGIN");
        if (ops.some(needsSno)) {
          await c.query("SELECT pg_advisory_xact_lock($1)", [SNO_LOCK]);
          const ids = ops.filter(needsSno).map(o => o.id), dbMax = new Map();
          for (const proj of snoProjects(ops)) {
            const { rows } = await c.query(`SELECT COALESCE(MAX((data->>'sno')::numeric),0) AS m FROM d360_docs
              WHERE col='items' AND NOT deleted AND NOT (id = ANY($2)) AND COALESCE(data->>'module','')=$1 AND (data->>'sno') ~ '^[0-9]{1,9}$'`, [proj, ids]);
            dbMax.set(proj, Number(rows[0].m));
          }
          assignSnos(ops, dbMax);
        }
        for (const o of ops) {
          const { rows } = o.data == null
            ? await c.query(`INSERT INTO d360_docs(col,id,data,deleted) VALUES($1,$2,NULL,true)
                 ON CONFLICT(col,id) DO UPDATE SET data=NULL, deleted=true, rev=nextval('d360_rev'), updated_at=now() RETURNING rev`, [o.col, o.id])
            : await c.query(`INSERT INTO d360_docs(col,id,data,deleted) VALUES($1,$2,$3,false)
                 ON CONFLICT(col,id) DO UPDATE SET data=EXCLUDED.data, deleted=false, rev=nextval('d360_rev'), updated_at=now() RETURNING rev`, [o.col, o.id, JSON.stringify(o.data)]);
          out.push(Number(rows[0].rev));
        }
        await c.query("COMMIT");
      } catch (e) { await c.query("ROLLBACK").catch(() => {}); throw e; } finally { c.release(); }
      return out;
    },
    async renumberItems(project) {
      await init();
      const c = await pool.connect();
      try {
        await c.query("BEGIN");
        await c.query("SELECT pg_advisory_xact_lock($1)", [SNO_LOCK]);
        const { rows } = project == null
          ? await c.query("SELECT id,data FROM d360_docs WHERE col='items' AND NOT deleted", [])
          : await c.query("SELECT id,data FROM d360_docs WHERE col='items' AND NOT deleted AND COALESCE(data->>'module','')=$1", [String(project)]);
        const plan = planRenumber(rows);
        for (const p of plan) {
          await c.query(`UPDATE d360_docs SET data=jsonb_set(data,'{sno}',to_jsonb($2::int)) - 'autoSno', rev=nextval('d360_rev'), updated_at=now()
            WHERE col='items' AND id=$1`, [p.id, p.sno]);
        }
        await c.query("COMMIT");
        return { changed: plan.length, total: rows.length };
      } catch (e) { await c.query("ROLLBACK").catch(() => {}); throw e; } finally { c.release(); }
    },
    async changes(since) {
      const { rows } = since > 0
        ? await q(`SELECT col,id,data,deleted,rev FROM d360_docs WHERE rev>$1 OR updated_at > now() - make_interval(secs => $2::double precision) ORDER BY rev`, [since, OVERLAP_MS / 1000])
        : await q("SELECT col,id,data,deleted,rev FROM d360_docs WHERE NOT deleted ORDER BY rev", []);
      const { rows: m } = await q("SELECT COALESCE(MAX(rev),0) AS m FROM d360_docs", []);
      return { rev: Number(m[0].m), docs: rows.map(r => ({ col: r.col, id: r.id, data: r.data, deleted: r.deleted, rev: Number(r.rev) })) };
    },
    async countUsers() { const { rows } = await q("SELECT count(*)::int AS n FROM d360_users", []); return rows[0].n; },
    async createUser(u) {
      await q("INSERT INTO d360_users(id,email,name,pass,is_owner) VALUES($1,$2,$3,$4,$5)", [u.id, u.email, u.name, u.pass, !!u.isOwner]);
    },
    async userByEmail(email) { const { rows } = await q("SELECT * FROM d360_users WHERE email=$1", [email]); return userRow(rows[0]); },
    async userById(id) { const { rows } = await q("SELECT * FROM d360_users WHERE id=$1", [id]); return userRow(rows[0]); },
    async listUsers() { const { rows } = await q("SELECT * FROM d360_users ORDER BY name", []); return rows.map(userRow); },
    async updateUser(id, f) {
      const sets = [], vals = [];
      if (f.name != null) { vals.push(f.name); sets.push(`name=$${vals.length}`); }
      if (f.pass != null) { vals.push(f.pass); sets.push(`pass=$${vals.length}`); }
      if (f.active != null) { vals.push(!!f.active); sets.push(`active=$${vals.length}`); }
      if (!sets.length) return;
      vals.push(id);
      await q(`UPDATE d360_users SET ${sets.join(",")} WHERE id=$${vals.length}`, vals);
    },
    async putBlob(b) {
      await q("INSERT INTO d360_blobs(id,name,content_type,size,data,uploaded_by) VALUES($1,$2,$3,$4,$5,$6)", [b.id, b.name, b.contentType, b.size, b.data, b.by]);
    },
    async getBlob(id) {
      const { rows } = await q("SELECT id,name,content_type,size,data FROM d360_blobs WHERE id=$1", [id]);
      const r = rows[0]; return r && { id: r.id, name: r.name, contentType: r.content_type, size: r.size, data: r.data };
    },
    async deleteBlob(id) { await q("DELETE FROM d360_blobs WHERE id=$1", [id]); },
    // runs fn while holding a database-wide lock, so serverless instances that cold-start together take turns
    async exclusive(fn) {
      await init();
      const c = await pool.connect();
      try { await c.query("SELECT pg_advisory_lock(360360)"); return await fn(); }
      finally { await c.query("SELECT pg_advisory_unlock(360360)").catch(() => {}); c.release(); }
    },
  };
}

function sqliteStore(file) {
  const Database = require("better-sqlite3");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS meta(k TEXT PRIMARY KEY, v INTEGER);
    INSERT OR IGNORE INTO meta(k,v) VALUES('rev',0);
    CREATE TABLE IF NOT EXISTS docs(col TEXT NOT NULL, id TEXT NOT NULL, data TEXT, deleted INTEGER NOT NULL DEFAULT 0,
      rev INTEGER NOT NULL, updated_at INTEGER NOT NULL, PRIMARY KEY(col,id));
    CREATE INDEX IF NOT EXISTS docs_rev ON docs(rev);
    CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL, pass TEXT NOT NULL,
      is_owner INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS blobs(id TEXT PRIMARY KEY, name TEXT, content_type TEXT, size INTEGER, data BLOB,
      uploaded_by TEXT, created_at INTEGER NOT NULL);`);
  const nextRev = db.prepare("UPDATE meta SET v=v+1 WHERE k='rev' RETURNING v");
  const up = db.prepare(`INSERT INTO docs(col,id,data,deleted,rev,updated_at) VALUES(@col,@id,@data,@deleted,@rev,@t)
    ON CONFLICT(col,id) DO UPDATE SET data=excluded.data, deleted=excluded.deleted, rev=excluded.rev, updated_at=excluded.updated_at`);
  const writeTx = db.transaction(ops => ops.map(o => {
    const rev = nextRev.get().v;
    up.run({ col: o.col, id: o.id, data: o.data == null ? null : JSON.stringify(o.data), deleted: o.data == null ? 1 : 0, rev, t: Date.now() });
    return rev;
  }));
  const userRow = r => r && ({ id: r.id, email: r.email, name: r.name, pass: r.pass, isOwner: !!r.is_owner, active: !!r.active, createdAt: r.created_at });
  return {
    kind: "sqlite",
    async init() {},
    async getDoc(col, id) {
      const r = db.prepare("SELECT data FROM docs WHERE col=? AND id=? AND deleted=0").get(col, id);
      return r ? JSON.parse(r.data) : null;
    },
    async write(ops) {
      // single process + synchronous driver: nothing can run between reading the max and writing
      if (ops.some(needsSno)) {
        const ids = new Set(ops.filter(needsSno).map(o => o.id));
        // max excluding the docs being renumbered, so re-saving a task marked autoSno doesn't count its own old number
        const dbMax = new Map();
        for (const r of db.prepare("SELECT id,data FROM docs WHERE col='items' AND deleted=0").all()) {
          if (ids.has(r.id)) continue;
          const d = JSON.parse(r.data), p = projOf(d);
          dbMax.set(p, Math.max(dbMax.get(p) || 0, snoNum(d.sno) || 0));
        }
        assignSnos(ops, dbMax);
      }
      return writeTx(ops);
    },
    async renumberItems(project) {
      const rows = db.prepare("SELECT id,data FROM docs WHERE col='items' AND deleted=0").all()
        .map(r => ({ id: r.id, data: JSON.parse(r.data) })).filter(r => project == null || projOf(r.data) === String(project));
      const plan = planRenumber(rows);
      const byId = new Map(rows.map(r => [r.id, r.data]));
      writeTx(plan.map(p => { const d = { ...byId.get(p.id), sno: p.sno }; delete d.autoSno; return { col: "items", id: p.id, data: d }; }));
      return { changed: plan.length, total: rows.length };
    },
    async changes(since) {
      const rows = since > 0
        ? db.prepare("SELECT col,id,data,deleted,rev FROM docs WHERE rev>? OR updated_at>? ORDER BY rev").all(since, Date.now() - OVERLAP_MS)
        : db.prepare("SELECT col,id,data,deleted,rev FROM docs WHERE deleted=0 ORDER BY rev").all();
      const rev = db.prepare("SELECT v FROM meta WHERE k='rev'").get().v;
      return { rev, docs: rows.map(r => ({ col: r.col, id: r.id, data: r.data == null ? null : JSON.parse(r.data), deleted: !!r.deleted, rev: r.rev })) };
    },
    async countUsers() { return db.prepare("SELECT count(*) n FROM users").get().n; },
    async createUser(u) {
      db.prepare("INSERT INTO users(id,email,name,pass,is_owner,created_at) VALUES(?,?,?,?,?,?)").run(u.id, u.email, u.name, u.pass, u.isOwner ? 1 : 0, Date.now());
    },
    async userByEmail(email) { return userRow(db.prepare("SELECT * FROM users WHERE email=?").get(email)); },
    async userById(id) { return userRow(db.prepare("SELECT * FROM users WHERE id=?").get(id)); },
    async listUsers() { return db.prepare("SELECT * FROM users ORDER BY name").all().map(userRow); },
    async updateUser(id, f) {
      if (f.name != null) db.prepare("UPDATE users SET name=? WHERE id=?").run(f.name, id);
      if (f.pass != null) db.prepare("UPDATE users SET pass=? WHERE id=?").run(f.pass, id);
      if (f.active != null) db.prepare("UPDATE users SET active=? WHERE id=?").run(f.active ? 1 : 0, id);
    },
    async putBlob(b) {
      db.prepare("INSERT INTO blobs(id,name,content_type,size,data,uploaded_by,created_at) VALUES(?,?,?,?,?,?,?)").run(b.id, b.name, b.contentType, b.size, b.data, b.by, Date.now());
    },
    async getBlob(id) {
      const r = db.prepare("SELECT id,name,content_type,size,data FROM blobs WHERE id=?").get(id);
      return r && { id: r.id, name: r.name, contentType: r.content_type, size: r.size, data: r.data };
    },
    async deleteBlob(id) { db.prepare("DELETE FROM blobs WHERE id=?").run(id); },
    async exclusive(fn) { return fn(); },
  };
}

let store = null;
module.exports = function getStore() {
  if (store) return store;
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (url) store = pgStore(url);
  else {
    if (process.env.VERCEL) throw Object.assign(new Error("DATABASE_URL is not set. On Vercel, add a Postgres database (e.g. Neon), set DATABASE_URL and redeploy."), { expose: true });
    store = sqliteStore(process.env.SQLITE_FILE || path.join(__dirname, "..", "data", "dev360.db"));
  }
  return store;
};
