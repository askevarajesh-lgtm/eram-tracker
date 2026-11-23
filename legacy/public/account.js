/* Account controls for the self-hosted tracker: who is signed in, change password,
   sign out, and (for admins) creating and managing sign-in accounts. */
(function () {
  "use strict";
  const $ = s => document.querySelector(s);
  const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const ROLES = ["Admin", "Manager", "Developer", "Viewer"];
  let ME = null;

  async function call(url, opts = {}) {
    const r = await fetch(url, { credentials: "same-origin", ...opts, headers: { "Content-Type": "application/json", ...(opts.headers || {}) } });
    const b = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(b.message || b.error || "Request failed");
    return b;
  }
  function toast(m) { const t = document.createElement("div"); t.className = "toast"; t.textContent = m; document.body.appendChild(t); setTimeout(() => t.remove(), 2600); }
  function panel(html, wide) {
    const L = $("#layer");
    L.innerHTML = `<div class="scrim"><div class="panel ${wide ? "wide" : ""}" role="dialog" aria-modal="true">${html}</div></div>`;
    const sc = L.firstElementChild; sc.addEventListener("click", e => { if (e.target === sc) L.innerHTML = ""; });
    setTimeout(() => L.querySelector("input,select")?.focus(), 30);
    return L.querySelector(".panel");
  }
  const close = () => { $("#layer").innerHTML = ""; };
  const tempPass = () => { const a = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789"; const r = crypto.getRandomValues(new Uint32Array(12)); return [...r].map(x => a[x % a.length]).join(""); };

  function mount() {
    const foot = document.querySelector(".side-foot");
    if (!foot || !ME) return;
    const box = document.createElement("div");
    box.className = "acct";
    box.innerHTML = `<style>
      .acct{display:flex;flex-direction:column;gap:6px}
      .acct .who{display:flex;align-items:center;gap:9px;min-width:0}
      .acct .who .av2{width:30px;height:30px;border-radius:9px;display:grid;place-items:center;background:var(--side-2);color:#fff;font:700 11px var(--display);flex:none}
      .acct .who b{display:block;color:#fff;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .acct .who small{display:block;color:var(--side-muted);font-size:11.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .acct .links{display:flex;flex-wrap:wrap;gap:4px}
      .acct .links button{border:0;background:var(--side-2);color:var(--side-fg);font:500 12px var(--body);padding:5px 9px;border-radius:7px;cursor:pointer}
      .acct .links button:hover{color:#fff}
      .acct-table td,.acct-table th{white-space:nowrap}
    </style>
    <div class="who"><span class="av2">${esc((ME.name || "?").split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase()).join(""))}</span><div style="min-width:0"><b>${esc(ME.name)}</b><small>${esc(ME.email)} · ${esc(ME.role)}</small></div></div>
    <div class="links">${ME.role === "Admin" ? `<button type="button" id="ac_users">Accounts</button>` : ""}<button type="button" id="ac_pw">Password</button><button type="button" id="ac_out">Sign out</button></div>`;
    foot.insertBefore(box, foot.firstChild);
    $("#ac_out").onclick = async () => { await call("/api/auth/logout", { method: "POST" }).catch(() => {}); location.replace("/login"); };
    $("#ac_pw").onclick = openPassword;
    $("#ac_users")?.addEventListener("click", openAccounts);
  }

  function openPassword() {
    const p = panel(`<h2>Change password</h2><form class="form" id="pw_f">
      <div class="field full"><label for="pw_c">Current password</label><input id="pw_c" type="password" autocomplete="current-password"></div>
      <div class="field full"><label for="pw_n">New password (8+ characters)</label><input id="pw_n" type="password" autocomplete="new-password"></div></form>
      <p class="err" id="pw_e"></p>
      <div class="foot"><span></span><div><button class="btn" type="button" id="pw_x">Cancel</button><button class="btn primary" type="button" id="pw_s">Save password</button></div></div>`);
    p.querySelector("#pw_x").onclick = close;
    p.querySelector("#pw_s").onclick = async () => {
      try { await call("/api/me/password", { method: "POST", body: JSON.stringify({ current: p.querySelector("#pw_c").value, next: p.querySelector("#pw_n").value }) }); close(); toast("Password changed"); }
      catch (e) { p.querySelector("#pw_e").textContent = e.message; }
    };
  }

  async function openAccounts() {
    const p = panel(`<h2>Sign-in accounts</h2><p class="muted" style="margin:0">Create an account for each person, give them the temporary password, and pick their role. They can change the password after signing in. Roles and developer links can also be changed later in Admin panel → Team &amp; roles.</p>
      <div class="mod" style="--mc:var(--accent)"><b>New account</b><form class="form" id="na_f">
        <div class="field"><label for="na_n">Name</label><input id="na_n" autocomplete="off"></div>
        <div class="field"><label for="na_e">Email</label><input id="na_e" type="email" autocomplete="off"></div>
        <div class="field"><label for="na_p">Temporary password</label><input id="na_p" value="${tempPass()}" autocomplete="off" class="mono"></div>
        <div class="field"><label for="na_r">Role</label><select id="na_r">${ROLES.map(r => `<option ${r === (ME.openAccess ? "Admin" : "Viewer") ? "selected" : ""}>${r}</option>`).join("")}</select></div>
        <div class="field full"><label for="na_d">Linked developer (for the Developer role)</label><select id="na_d"><option value="">—</option></select></div></form>
        <p class="err" id="na_err" style="margin:0"></p>
        <div><button class="btn primary" type="button" id="na_s">Create account</button></div></div>
      <div id="ac_list"><p class="muted">Loading…</p></div>
      <div class="mod" style="--mc:var(--info)"><b>Bring data from the old tracker</b><span class="muted" style="font-size:13px">In the old page, open Admin panel → Data and download the <b>JSON backup</b>. Choose it here to load all projects, items, developers, users, licences, companies, rollout, daily notes, manuals and lists. Records with the same ID are overwritten. Members are skipped because accounts are new here.</span>
        <div><label class="btn" style="cursor:pointer">⇧ Choose JSON backup<input type="file" id="rs_f" accept=".json,application/json" hidden></label> <span id="rs_out" class="muted" style="font-size:13px"></span></div></div>
      <div class="foot"><span></span><div><button class="btn" type="button" id="ac_x">Close</button></div></div>`, true);
    p.querySelector("#ac_x").onclick = close;
    let db = null;
    try { db = await window.claude.use("db"); } catch (e) {}
    if (db) {
      db.collection("developers").get().then(s => {
        const sel = p.querySelector("#na_d"); if (!sel) return;
        s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => String(a.name).localeCompare(b.name)).forEach(v => sel.insertAdjacentHTML("beforeend", `<option value="${esc(v.id)}">${esc(v.name)}</option>`));
      }).catch(() => {});
    }
    p.querySelector("#na_s").onclick = async e => {
      const b = e.target, g = id => p.querySelector(id).value.trim();
      b.disabled = true; p.querySelector("#na_err").textContent = "";
      try {
        const u = await call("/api/admin/users", { method: "POST", body: JSON.stringify({ name: g("#na_n"), email: g("#na_e"), password: g("#na_p") }) });
        if (db) await db.collection("members").doc(u.id).set({ role: g("#na_r"), devId: g("#na_d"), active: true, addedOn: new Date().toISOString().slice(0, 10), updatedAt: new Date().toISOString() });
        const msg = `Sign in at ${location.origin}/login\nEmail: ${u.email}\nTemporary password: ${g("#na_p")}`;
        try { await navigator.clipboard.writeText(msg); toast("Account created · sign-in details copied"); } catch { toast("Account created"); }
        p.querySelector("#na_n").value = ""; p.querySelector("#na_e").value = ""; p.querySelector("#na_p").value = tempPass();
        loadList(p);
      } catch (x) { p.querySelector("#na_err").textContent = x.message; }
      b.disabled = false;
    };
    p.querySelector("#rs_f").onchange = async e => {
      const f = e.target.files[0], out = p.querySelector("#rs_out"); if (!f || !db) return;
      try {
        const j = JSON.parse(await f.text());
        const cols = ["modules", "developers", "items", "users", "companies", "licenses", "rollout", "daily", "manuals", "settings", "standup", "reminders", "issues", "meetings", "milestones", "changes", "releases", "risks"];
        const ops = [];
        cols.forEach(c => (Array.isArray(j[c]) ? j[c] : []).forEach(r => { if (r && r.id) { const { id, ...rest } = r; ops.push([c, String(id), rest]); } }));
        if (!ops.length) { out.textContent = "No records found in this file."; return; }
        let done = 0;
        for (let i = 0; i < ops.length; i += 150) {
          await Promise.all(ops.slice(i, i + 150).map(([c, id, d]) => db.collection(c).doc(id).set(d)));
          done = Math.min(ops.length, i + 150); out.textContent = `Loading ${done}/${ops.length}…`;
        }
        out.textContent = `Loaded ${ops.length} records.`; toast("Backup loaded");
      } catch (x) { out.textContent = "Couldn't load: " + x.message; }
      e.target.value = "";
    };
    loadList(p);
  }

  async function loadList(p) {
    const box = p.querySelector("#ac_list"); if (!box) return;
    try {
      const U = await call("/api/admin/users");
      box.innerHTML = `<div class="tablewrap"><table class="acct-table"><thead><tr><th>Name</th><th>Email</th><th>Status</th><th></th></tr></thead><tbody>${U.map(u => `<tr><td><b>${esc(u.name)}</b>${u.isOwner ? ' <span class="chip" style="--c:var(--accent)">Owner</span>' : ""}</td><td class="muted">${esc(u.email)}</td><td>${u.active ? '<span class="chip" style="--c:var(--ok)">Active</span>' : '<span class="chip" style="--c:var(--bad)">Suspended</span>'}</td><td style="text-align:right"><button class="btn" type="button" data-rp="${esc(u.id)}" style="padding:4px 9px">Reset password</button> ${u.isOwner ? "" : `<button class="btn" type="button" data-sus="${esc(u.id)}" data-on="${u.active ? 1 : 0}" style="padding:4px 9px">${u.active ? "Suspend" : "Reactivate"}</button>`}</td></tr>`).join("")}</tbody></table></div>`;
      box.querySelectorAll("[data-rp]").forEach(b => b.onclick = async () => {
        const pw = tempPass();
        try { await call("/api/admin/users/" + b.dataset.rp, { method: "PATCH", body: JSON.stringify({ password: pw }) }); try { await navigator.clipboard.writeText(pw); } catch {} b.textContent = "New: " + pw; b.classList.add("mono"); toast("Password reset (copied)"); }
        catch (e) { toast(e.message); }
      });
      box.querySelectorAll("[data-sus]").forEach(b => b.onclick = async () => {
        try { await call("/api/admin/users/" + b.dataset.sus, { method: "PATCH", body: JSON.stringify({ active: b.dataset.on !== "1" }) }); loadList(p); }
        catch (e) { toast(e.message); }
      });
    } catch (e) { box.innerHTML = `<p class="err">${esc(e.message)}</p>`; }
  }

  (window.DEV360_ME || Promise.reject()).then(m => { ME = m; if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount); else mount(); }).catch(() => {});
})();
