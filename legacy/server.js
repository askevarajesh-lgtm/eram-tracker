"use strict";
// Self-hosted entry point:  node server.js   (PORT defaults to 3000)
try { require("fs").readFileSync(".env", "utf8").split(/\r?\n/).forEach(l => { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }); } catch {}
const app = require("./server/app");
const getStore = require("./server/store");
const port = +process.env.PORT || 3002;
getStore().init().then(() => {
  app.listen(port, () => console.log(`Dev 360 Tracker running on http://localhost:${port}  (storage: ${getStore().kind})`));
}).catch(e => { console.error("Could not open the database:", e.message); process.exit(1); });
