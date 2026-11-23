#!/usr/bin/env node
"use strict";
// Set a new sign-in password for an account (when the generated one is lost):
//   npm run set-password -- you@company.com "NewPassword123"
//   npm run set-password                       (lists the accounts)
// Uses DATABASE_URL (Postgres, e.g. prod) when set in the environment or .env, otherwise the local SQLite file.
try { require("fs").readFileSync(".env", "utf8").split(/\r?\n/).forEach(l => { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }); } catch {}
const getStore = require("../server/store");
const { hashPass } = require("../server/app");

(async () => {
  const [email, pw] = process.argv.slice(2);
  const store = getStore();
  await store.init();
  console.log(`Database: ${store.kind}`);
  if (!email) {
    const users = await store.listUsers();
    if (!users.length) console.log("No accounts yet. Start the app once to create the accounts from seed/accounts.json.");
    users.forEach(u => console.log(`  ${u.email}  ·  ${u.name}${u.isOwner ? "  ·  owner" : ""}${u.active ? "" : "  ·  suspended"}`));
    console.log('\nUsage: npm run set-password -- <email> "<new password>"');
    process.exit(0);
  }
  if (!pw || pw.length < 8) { console.error("Give a new password of at least 8 characters."); process.exit(1); }
  const u = await store.userByEmail(String(email).trim().toLowerCase());
  if (!u) { console.error(`No account with email ${email}. Run without arguments to list accounts.`); process.exit(1); }
  await store.updateUser(u.id, { pass: hashPass(pw), active: true });
  console.log(`Password updated for ${u.email}. Sign in with it now.`);
  process.exit(0);
})().catch(e => { console.error("Failed:", e.message); process.exit(1); });
