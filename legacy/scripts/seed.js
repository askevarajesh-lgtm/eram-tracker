#!/usr/bin/env node
"use strict";
// Manually load seed data:   npm run seed                 (all JSON files in ./seed, only if the database is empty)
//                            npm run seed -- --force      (load even if records exist; same IDs are overwritten)
//                            npm run seed -- path/to/backup.json [--force]
try { require("fs").readFileSync(".env", "utf8").split(/\r?\n/).forEach(l => { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }); } catch {}
const path = require("path");
const getStore = require("../server/store");
const { readSeedOps, writeAll, seedAccounts, logAccounts, SEED_DIR } = require("../server/seed");
const { hashPass } = require("../server/app");

(async () => {
  const args = process.argv.slice(2), force = args.includes("--force");
  const file = args.find(a => !a.startsWith("--"));
  const store = getStore();
  await store.init();
  const { docs } = await store.changes(0);
  if (docs.length && !force) console.log(`Database already has ${docs.length} records; records not loaded (use --force to load anyway).`);
  else {
    let ops;
    if (file) {
      const tmp = require("fs").mkdtempSync(path.join(require("os").tmpdir(), "seed-"));
      require("fs").copyFileSync(file, path.join(tmp, "seed.json"));
      ops = readSeedOps(tmp);
    } else ops = readSeedOps(SEED_DIR);
    if (!ops.length) console.log("No seed records found.");
    else {
      const n = await writeAll(store, ops);
      const by = ops.reduce((a, o) => (a[o.col] = (a[o.col] || 0) + 1, a), {});
      console.log(`Loaded ${n} records:`, by);
    }
  }
  // accounts from seed/accounts.json that don't exist yet (after records, so developer links resolve)
  const created = await seedAccounts(store, hashPass);
  if (created.length) logAccounts(created); else console.log("No new accounts to create.");
  process.exit(0);
})().catch(e => { console.error(e.message); process.exit(1); });
