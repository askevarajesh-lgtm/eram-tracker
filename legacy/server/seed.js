"use strict";
// Loads seed data into an EMPTY database the first time the app starts.
//  - seed/*.json (except accounts.json): records in the old tracker's "JSON backup" format
//    { "modules":[{id,...}], "items":[...], "developers":[...], ... }, loaded in alphabetical order.
//  - seed/accounts.json: sign-in accounts. Any listed account that doesn't exist yet is created on start.
// Records are loaded only into an empty database; existing accounts are never changed.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const SEED_DIR = process.env.SEED_DIR || path.join(__dirname, "..", "seed");
const ACCOUNTS_FILE = "accounts.json";
const SKIP = new Set(["members", "audit", "exported"]); // member ids belong to the old platform's accounts

function readSeedOps(dir = SEED_DIR) {
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir).filter(f => f.toLowerCase().endsWith(".json") && f.toLowerCase() !== ACCOUNTS_FILE).sort();
  const ops = [];
  for (const f of files) {
    const j = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
    if (!j || Array.isArray(j)) continue;
    for (const [col, rows] of Object.entries(j)) {
      if (SKIP.has(col) || !Array.isArray(rows) || !/^[A-Za-z0-9_-]{1,60}$/.test(col)) continue;
      for (const r of rows) {
        if (!r || r.id == null) continue;
        const { id, ...data } = r;
        ops.push({ col, id: String(id), data });
      }
    }
  }
  return ops;
}

function readAccounts(dir = SEED_DIR) {
  const f = path.join(dir, ACCOUNTS_FILE);
  if (!fs.existsSync(f)) return [];
  const list = JSON.parse(fs.readFileSync(f, "utf8"));
  return (Array.isArray(list) ? list : list.accounts || []).filter(a => a && a.email && a.name);
}

async function writeAll(store, ops) {
  for (let i = 0; i < ops.length; i += 200) await store.write(ops.slice(i, i + 200));
  return ops.length;
}

const ROLES = ["Admin", "Manager", "Developer", "Viewer"];
const tempPass = () => crypto.randomBytes(9).toString("base64url");

// Creates the accounts in seed/accounts.json. Returns [{email, password}] for accounts that were created.
async function seedAccounts(store, hashPass, accounts = readAccounts()) {
  if (!accounts.length) return [];
  const { docs } = await store.changes(0);
  const devs = docs.filter(d => d.col === "developers");
  const findDev = n => n ? devs.find(d => String(d.data.name || "").trim().toLowerCase() === String(n).trim().toLowerCase()) : null;
  const shared = process.env.SEED_PASSWORD || "";
  const created = [], memberOps = [];
  let ownerSet = (await store.countUsers()) > 0;
  for (const a of accounts) {
    const email = String(a.email).trim().toLowerCase();
    if (await store.userByEmail(email)) continue;
    const id = "u_" + Date.now().toString(36) + crypto.randomBytes(6).toString("hex");
    const password = a.password || shared || tempPass();
    const isOwner = !ownerSet && !!a.owner;
    if (isOwner) ownerSet = true;
    await store.createUser({ id, email, name: String(a.name).trim(), pass: hashPass(password), isOwner });
    const dev = findDev(a.developer);
    memberOps.push({ col: "members", id, data: { role: ROLES.includes(a.role) ? a.role : "Viewer", devId: dev ? dev.id : "", active: true, addedOn: new Date().toISOString().slice(0, 10), updatedAt: new Date().toISOString() } });
    created.push({ email, password, generated: !a.password && !shared, owner: isOwner, role: isOwner ? "Admin (owner)" : a.role });
  }
  if (memberOps.length) await store.write(memberOps);
  return created;
}

function logAccounts(created) {
  if (!created.length) return;
  console.log("[dev360] Created sign-in accounts from seed/accounts.json:");
  created.forEach(c => console.log(`  ${c.email}  ·  ${c.role}  ·  password: ${c.generated ? c.password + "  (generated, change after first sign-in)" : "(from SEED_PASSWORD / accounts.json)"}`));
}

// true when seed/accounts.json lists an account that doesn't exist yet (new entries are added on the next start)
async function missingAccounts(store) {
  for (const a of readAccounts()) if (!(await store.userByEmail(String(a.email).trim().toLowerCase()))) return true;
  return false;
}

let once = null;
function seedIfEmpty(store, { hashPass } = {}) {
  return (once ||= (async () => {
    if (String(process.env.SEED_ON_START || "true").toLowerCase() === "false") return 0;
    await store.init();
    if ((await store.changes(0)).docs.length && !(hashPass && (await missingAccounts(store)))) return 1; // nothing to do: skip the lock
    return store.exclusive(async () => {
      const { docs } = await store.changes(0);
      if (!docs.length) {
        const ops = readSeedOps();
        if (ops.length) console.log(`[dev360] Seeded ${await writeAll(store, ops)} records from ${SEED_DIR}`);
      }
      if (hashPass && (await missingAccounts(store))) logAccounts(await seedAccounts(store, hashPass));
      return 1;
    });
  })().catch(e => { console.error("[dev360] Seeding failed:", e.message); once = null; return 0; }));
}

module.exports = { seedIfEmpty, readSeedOps, readAccounts, seedAccounts, logAccounts, writeAll, SEED_DIR };
