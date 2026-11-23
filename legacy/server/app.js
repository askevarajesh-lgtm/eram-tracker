"use strict";
const path = require("path");
const crypto = require("crypto");
const express = require("express");
const getStore = require("./store");
const { seedIfEmpty } = require("./seed");

const PUBLIC = path.join(__dirname, "..", "public");
const COOKIE = "d360_session";
const SESSION_DAYS = 30;
const MAX_FILE = (+process.env.MAX_UPLOAD_MB || 20) * 1024 * 1024;
// POC mode: every signed-in account is an Admin (sees and edits everything, can add accounts). Set OPEN_ACCESS=false to use roles.
const OPEN_ACCESS = String(process.env.OPEN_ACCESS || "true").toLowerCase() !== "false";

// ---------- secrets & crypto helpers
let SECRET = process.env.SESSION_SECRET;
if (!SECRET) {
  if (process.env.VERCEL || process.env.NODE_ENV === "production") {
    console.error("SESSION_SECRET is not set. Set it to a long random string.");
  }
  SECRET = crypto.randomBytes(32).toString("hex");
  console.warn("[dev360] SESSION_SECRET not set: using a temporary secret (everyone is signed out on restart).");
}
const b64u = b => Buffer.from(b).toString("base64url");
const sign = s => crypto.createHmac("sha256", SECRET).update(s).digest("base64url");
function makeToken(uid) {
  const body = b64u(JSON.stringify({ uid, exp: Date.now() + SESSION_DAYS * 864e5 }));
  return body + "." + sign(body);
}
function readToken(t) {
  if (!t || typeof t !== "string") return null;
  const [body, sig] = t.split(".");
  if (!body || !sig) return null;
  const good = sign(body);
  if (sig.length !== good.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good))) return null;
  try { const p = JSON.parse(Buffer.from(body, "base64url").toString()); return p.exp > Date.now() ? p.uid : null; } catch { return null; }
}
function hashPass(pw) {
  const salt = crypto.randomBytes(16);
  const h = crypto.scryptSync(pw, salt, 64);
  return "s1$" + salt.toString("hex") + "$" + h.toString("hex");
}
function checkPass(pw, stored) {
  const [v, salt, hex] = String(stored).split("$");
  if (v !== "s1" || !salt || !hex) return false;
  const h = crypto.scryptSync(pw, Buffer.from(salt, "hex"), 64);
  return crypto.timingSafeEqual(h, Buffer.from(hex, "hex"));
}
const newId = (p = "") => p + Date.now().toString(36) + crypto.randomBytes(6).toString("hex");
const normEmail = e => String(e || "").trim().toLowerCase();
const validEmail = e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

function parseCookies(req) {
  const out = {};
  (req.headers.cookie || "").split(";").forEach(p => { const i = p.indexOf("="); if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim()); });
  return out;
}
function setSession(req, res, uid) {
  const secure = req.secure || req.headers["x-forwarded-proto"] === "https";
  const v = uid ? makeToken(uid) : "";
  res.setHeader("Set-Cookie", `${COOKIE}=${v}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${uid ? SESSION_DAYS * 86400 : 0}${secure ? "; Secure" : ""}`);
}

// ---------- signup policy
// ALLOWED_EMAIL_DOMAIN may list several domains: "eramengineering.com, eramhcm.com"
const allowedDomains = () => (process.env.ALLOWED_EMAIL_DOMAIN || "").split(/[,\s;]+/).map(d => d.trim().toLowerCase().replace(/^@/, "")).filter(Boolean);
function signupAllowed(email, userCount) {
  if (userCount === 0) return true; // first person becomes the owner/admin
  const doms = allowedDomains();
  if (doms.length) return doms.some(d => email.endsWith("@" + d));
  return String(process.env.ALLOW_SIGNUP || "false").toLowerCase() === "true";
}

// ---------- roles (mirrors the page's allowWrite so the server is the real gate)
const devsOf = i => (i && Array.isArray(i.assignees) && i.assignees.length ? i.assignees : i && i.assignee ? [i.assignee] : []);
async function roleInfo(store, user) {
  const member = await store.getDoc("members", user.id);
  let role;
  if (user.isOwner || OPEN_ACCESS) role = "Admin";
  else if (member && member.active !== false) role = member.role || "Viewer";
  else role = ((await store.getDoc("settings", "lists")) || {}).defaultRole || "Viewer";
  return { role, devId: (member && member.devId) || "" };
}
async function mayWrite(store, ctx, col, id, obj) {
  const { role, devId: dv, user } = ctx;
  if (role === "Admin") return true;
  if (col === "members" || col === "settings") return false;
  if (col === "audit") return true;
  if (col === "chat") return role !== "Viewer";
  const ex = () => store.getDoc(col, id);
  if (col === "changes" && role !== "Manager") return !(await ex());
  if (col === "issues" && role !== "Manager") {
    const e = await ex();
    if (role === "Viewer") return !e;
    if (role === "Developer") return !e || !devsOf(e).length || (!!dv && devsOf(e).includes(dv));
  }
  if (col === "meetings" && role === "Developer") {
    const e = await ex();
    return !!dv && (!e || (e.devIds || []).includes(dv) || e.createdBy === user.id);
  }
  if (role === "Manager") return true;
  if (role === "Developer") {
    if (col === "daily") return true;
    if (col === "manuals") return !!dv;
    if (col === "reminders") { const e = await ex(); return !!dv && (((e || obj || {}).devIds) || []).includes(dv); }
    if (col === "standup") return !!dv && String(id).startsWith(dv + "_");
    if (col === "items") { const e = await ex(); return !!dv && ((e && devsOf(e).includes(dv)) || (!e && obj && devsOf(obj).includes(dv))); }
    return false;
  }
  return false;
}

// ---------- app
const app = express();
app.disable("x-powered-by");
app.set("trust proxy", true);
const json = express.json({ limit: process.env.VERCEL ? "4mb" : "25mb" });
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "same-origin");
  next();
});

// first start: load ./seed/*.json into an empty database
app.use(["/api", "/_blob"], (req, res, next) => { seedIfEmpty(getStore(), { hashPass }).then(() => next(), next); });

// who is signed in
const auth = (required = true) => wrap(async (req, res, next) => {
  const store = getStore();
  const uid = readToken(parseCookies(req)[COOKIE]);
  const user = uid ? await store.userById(uid) : null;
  if (!user || !user.active) {
    if (!required) return next();
    return res.status(401).json({ error: "signed_out" });
  }
  req.user = user;
  next();
});
const ctxOf = async req => ({ user: req.user, ...(await roleInfo(getStore(), req.user)) });
const adminOnly = wrap(async (req, res, next) => {
  const c = await ctxOf(req);
  if (c.role !== "Admin") return res.status(403).json({ error: "permission_denied", message: "Only admins can do this." });
  req.ctx = c; next();
});

// ----- auth routes
const attempts = new Map();
function throttled(key) {
  const now = Date.now(), a = attempts.get(key) || { n: 0, t: now };
  if (now - a.t > 15 * 60e3) { a.n = 0; a.t = now; }
  return a.n >= 10;
}
function failed(key) { const a = attempts.get(key) || { n: 0, t: Date.now() }; a.n++; attempts.set(key, a); }

app.get("/api/auth/status", wrap(async (req, res) => {
  const n = await getStore().countUsers();
  const dom = allowedDomains().join(" or @");
  res.json({ hasUsers: n > 0, signup: n === 0 || !!dom || String(process.env.ALLOW_SIGNUP || "").toLowerCase() === "true", domain: dom || null, appName: process.env.APP_NAME || "Dev 360 Tracker" });
}));
app.post("/api/auth/signup", json, wrap(async (req, res) => {
  const store = getStore();
  const email = normEmail(req.body.email), name = String(req.body.name || "").trim(), pw = String(req.body.password || "");
  if (!validEmail(email) || !name) return res.status(400).json({ error: "Enter your name and a valid email." });
  if (pw.length < 8) return res.status(400).json({ error: "Use a password of at least 8 characters." });
  const n = await store.countUsers();
  if (!signupAllowed(email, n)) return res.status(403).json({ error: "Sign-up is closed. Ask an admin to create your account." });
  if (await store.userByEmail(email)) return res.status(409).json({ error: "An account with this email already exists. Sign in instead." });
  const id = newId("u_");
  await store.createUser({ id, email, name, pass: hashPass(pw), isOwner: n === 0 });
  setSession(req, res, id);
  res.json({ ok: true, owner: n === 0 });
}));
app.post("/api/auth/login", json, wrap(async (req, res) => {
  const store = getStore();
  const email = normEmail(req.body.email), pw = String(req.body.password || "");
  const key = req.ip + "|" + email;
  if (throttled(key)) return res.status(429).json({ error: "Too many attempts. Try again in 15 minutes." });
  const u = await store.userByEmail(email);
  if (!u || !checkPass(pw, u.pass)) { failed(key); return res.status(401).json({ error: "Email or password is incorrect." }); }
  if (!u.active) return res.status(403).json({ error: "This account is suspended. Ask an admin." });
  attempts.delete(key);
  setSession(req, res, u.id);
  res.json({ ok: true });
}));
app.post("/api/auth/logout", (req, res) => { setSession(req, res, null); res.json({ ok: true }); });

app.get("/api/me", auth(), wrap(async (req, res) => {
  const c = await ctxOf(req);
  res.json({ id: req.user.id, name: req.user.name, email: req.user.email, isOwner: req.user.isOwner, canEdit: c.role !== "Viewer", role: c.role, devId: c.devId, openAccess: OPEN_ACCESS });
}));
app.post("/api/me/password", auth(), json, wrap(async (req, res) => {
  const cur = String(req.body.current || ""), next = String(req.body.next || "");
  if (!checkPass(cur, req.user.pass)) return res.status(400).json({ error: "Current password is incorrect." });
  if (next.length < 8) return res.status(400).json({ error: "Use a password of at least 8 characters." });
  await getStore().updateUser(req.user.id, { pass: hashPass(next) });
  res.json({ ok: true });
}));

// ----- people
app.post("/api/users/profiles", auth(), json, wrap(async (req, res) => {
  const ids = Array.isArray(req.body.ids) ? req.body.ids.slice(0, 500) : [];
  const all = await getStore().listUsers();
  const out = {};
  ids.forEach(id => { const u = all.find(x => x.id === id); out[id] = { id, name: u ? u.name : "", email: u ? u.email : "", isMe: id === req.user.id, avatarUrl: null, guest: false }; });
  res.json(out);
}));
app.get("/api/users/search", auth(), wrap(async (req, res) => {
  const q = String(req.query.q || "").trim().toLowerCase();
  const all = await getStore().listUsers();
  res.json(all.filter(u => u.active && (!q || u.name.toLowerCase().includes(q) || u.email.includes(q))).slice(0, 20).map(u => ({ id: u.id, name: u.name, email: u.email, guest: false })));
}));
app.get("/api/admin/users", auth(), adminOnly, wrap(async (req, res) => {
  res.json((await getStore().listUsers()).map(u => ({ id: u.id, name: u.name, email: u.email, isOwner: u.isOwner, active: u.active, createdAt: u.createdAt })));
}));
app.post("/api/admin/users", auth(), adminOnly, json, wrap(async (req, res) => {
  const store = getStore();
  const email = normEmail(req.body.email), name = String(req.body.name || "").trim(), pw = String(req.body.password || "");
  if (!validEmail(email) || !name) return res.status(400).json({ error: "Enter a name and a valid email." });
  if (pw.length < 8) return res.status(400).json({ error: "Temporary password must be at least 8 characters." });
  if (await store.userByEmail(email)) return res.status(409).json({ error: "An account with this email already exists." });
  const id = newId("u_");
  await store.createUser({ id, email, name, pass: hashPass(pw), isOwner: false });
  res.json({ id, name, email });
}));
app.patch("/api/admin/users/:id", auth(), adminOnly, json, wrap(async (req, res) => {
  const store = getStore();
  const u = await store.userById(req.params.id);
  if (!u) return res.status(404).json({ error: "No such account." });
  const f = {};
  if (req.body.name) f.name = String(req.body.name).trim();
  if (req.body.password) { if (String(req.body.password).length < 8) return res.status(400).json({ error: "Password must be at least 8 characters." }); f.pass = hashPass(String(req.body.password)); }
  if (typeof req.body.active === "boolean") { if (u.isOwner && !req.body.active) return res.status(400).json({ error: "The owner account can't be suspended." }); f.active = req.body.active; }
  await store.updateUser(u.id, f);
  res.json({ ok: true });
}));

// ----- data
const COL_RE = /^[A-Za-z0-9_-]{1,60}$/;
const okKey = (col, id) => COL_RE.test(String(col)) && typeof id === "string" && id.length > 0 && id.length <= 300;

app.get("/api/db/sync", auth(), wrap(async (req, res) => {
  const since = Math.max(0, parseInt(req.query.since, 10) || 0);
  res.setHeader("Cache-Control", "no-store");
  res.json(await getStore().changes(since));
}));
app.get("/api/db/doc/:col/:id", auth(), wrap(async (req, res) => {
  if (!okKey(req.params.col, req.params.id)) return res.status(400).json({ error: "bad_key" });
  const d = await getStore().getDoc(req.params.col, req.params.id);
  res.setHeader("Cache-Control", "no-store");
  res.json({ exists: !!d, data: d });
}));
app.post("/api/db/batch", auth(), json, wrap(async (req, res) => {
  const store = getStore();
  const ops = Array.isArray(req.body.ops) ? req.body.ops : [];
  if (!ops.length) return res.json({ revs: [] });
  if (ops.length > 500) return res.status(400).json({ error: "too_many" });
  const ctx = await ctxOf(req);
  const denied = [];
  for (let i = 0; i < ops.length; i++) {
    const o = ops[i];
    if (!okKey(o.col, o.id) || (o.data != null && (typeof o.data !== "object" || Array.isArray(o.data)))) return res.status(400).json({ error: "bad_op", index: i });
    if (!(await mayWrite(store, ctx, o.col, o.id, o.data))) denied.push(i);
  }
  if (denied.length) return res.status(403).json({ error: "permission_denied", denied, message: `Your role (${ctx.role}) can't make this change.` });
  const w = ops.map(o => ({ col: o.col, id: o.id, data: o.data == null ? null : o.data }));
  const sent = w.map(o => o.data);
  const revs = await store.write(w);
  // docs the server filled in (task S.No) go back, so the page shows the saved version straight away
  const data = {};
  w.forEach((o, i) => { if (o.data !== sent[i]) data[i] = o.data; });
  res.json({ revs, data });
}));
// renumber tasks 1..N per project (all projects, or one), keeping their current order
app.post("/api/items/renumber", auth(), json, wrap(async (req, res) => {
  const ctx = await ctxOf(req);
  if (!["Admin", "Manager"].includes(ctx.role)) return res.status(403).json({ error: "permission_denied", message: "Only admins and project managers can renumber tasks." });
  const project = req.body && typeof req.body.project === "string" ? req.body.project : null;
  res.json(await getStore().renumberItems(project));
}));

// ----- files
const INLINE = /^(image\/(png|jpe?g|gif|webp|avif)|application\/pdf|video\/(mp4|webm|ogg)|audio\/|text\/plain|text\/csv)/i;
app.post("/api/assets", auth(), express.raw({ type: () => true, limit: process.env.VERCEL ? "4.4mb" : MAX_FILE }), wrap(async (req, res) => {
  const ctx = await ctxOf(req);
  if (ctx.role === "Viewer") return res.status(403).json({ error: "not_granted", message: "Viewers can't attach files." });
  const buf = req.body;
  if (!Buffer.isBuffer(buf) || !buf.length) return res.status(400).json({ error: "empty" });
  if (buf.length > MAX_FILE) return res.status(413).json({ error: "too_large" });
  const name = decodeURIComponent(String(req.headers["x-filename"] || "file")).slice(0, 200);
  const contentType = String(req.headers["content-type"] || "application/octet-stream").slice(0, 120);
  const id = newId("f_");
  await getStore().putBlob({ id, name, contentType, size: buf.length, data: buf, by: req.user.id });
  res.json({ id, contentType, sizeBytes: buf.length });
}));
app.delete("/api/assets/:id", auth(), wrap(async (req, res) => {
  const ctx = await ctxOf(req);
  if (ctx.role === "Viewer") return res.status(403).json({ error: "not_granted" });
  await getStore().deleteBlob(req.params.id);
  res.json({ ok: true });
}));
app.get("/_blob/:id", auth(), wrap(async (req, res) => {
  const b = await getStore().getBlob(req.params.id);
  if (!b) return res.status(404).send("Not found");
  const type = b.contentType || "application/octet-stream";
  const inline = INLINE.test(type) && req.query.download === undefined;
  res.setHeader("Content-Type", inline ? type : "application/octet-stream");
  res.setHeader("Content-Disposition", `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(b.name || "file")}`);
  res.setHeader("Cache-Control", "private, max-age=86400");
  // PDFs need the browser's built-in viewer, which a sandboxed page can't use; everything else is sandboxed
  if (!/^application\/pdf/i.test(type) || !inline) res.setHeader("Content-Security-Policy", "default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'; sandbox");
  res.end(Buffer.from(b.data));
}));

app.get("/api/health", wrap(async (req, res) => { await getStore().init(); res.json({ ok: true, storage: getStore().kind }); }));

// ----- static pages (self-hosting; on Vercel the CDN serves /public directly)
app.use(express.static(PUBLIC, { extensions: ["html"], index: "index.html" }));

app.use((err, req, res, next) => {
  console.error(err);
  if (err.type === "entity.too.large") return res.status(413).json({ error: "too_large", message: "That is too large to upload here." });
  res.status(500).json({ error: "server_error", message: err.expose || process.env.NODE_ENV !== "production" ? String(err.message || err) : "Server error" });
});

module.exports = app;
module.exports.hashPass = hashPass;
