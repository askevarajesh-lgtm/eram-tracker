"use client";
import { useMemo, useState, useTransition } from "react";
import { createAccount, updateAccount } from "@/server/accounts";
import { Chip } from "@/components/ui/Chip";
import { Panel } from "@/components/ui/Panel";
import { toast } from "@/components/ui/Toaster";
import { AntInput, AntSelect, AntCheckbox, AntTable, type ColumnsType } from "@/components/ui/antd";

type AccountRow = {
  id: string; name: string; email: string; role: string; active: boolean; isOwner: boolean;
  developerId: string; developerName: string; createdAt: string;
};
type Dev = { id: string; name: string; title: string; accountId: string };

const ROLE_LABEL: Record<string, string> = { Admin: "Admin", Viewer: "Viewer (read-only)", Manager: "Manager", Developer: "Developer" };

/** Random temporary password, e.g. "kq7-Tm2x-9pRw". */
function tempPassword() {
  const c = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const r = crypto.getRandomValues(new Uint32Array(12));
  const s = Array.from(r, n => c[n % c.length]).join("");
  return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8)}`;
}

export function AccountsView({ meId, accounts, developers }: { meId: string; accounts: AccountRow[]; developers: Dev[] }) {
  const [open, setOpen] = useState<AccountRow | "new" | null>(null);
  const unlinked = developers.filter(d => !d.accountId);
  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <span className="muted">
          People who sign in to this tracker. Developers are a separate list: link an account to a developer record when the person also builds things.
        </span>
        <button className="btn primary" type="button" onClick={() => setOpen("new")}>+ Add account</button>
      </div>
      {(() => {
        const columns: ColumnsType<AccountRow> = [
          {
            title: "Name",
            dataIndex: "name",
            key: "name",
            render: (name: string, a: AccountRow) => (
              <div>
                <b style={{ fontWeight: 600 }}>{name}</b>
                {a.id === meId && <span className="muted"> (you)</span>}
                {a.isOwner && <> <Chip color="var(--accent)">Owner</Chip></>}
              </div>
            ),
          },
          {
            title: "Email",
            dataIndex: "email",
            key: "email",
            className: "muted",
          },
          {
            title: "Role",
            dataIndex: "role",
            key: "role",
            render: (role: string) => ROLE_LABEL[role] ?? role,
          },
          {
            title: "Developer record",
            dataIndex: "developerName",
            key: "developerName",
            render: (devName?: string) => devName || <span className="muted">—</span>,
          },
          {
            title: "Status",
            dataIndex: "active",
            key: "active",
            render: (active: boolean) => active ? <Chip color="var(--ok)">Active</Chip> : <Chip color="var(--hold)">Suspended</Chip>,
          },
          {
            title: "Added",
            dataIndex: "createdAt",
            key: "createdAt",
            className: "mono muted",
            render: (at: string) => new Date(at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
          },
          {
            title: "",
            key: "action",
            align: "right",
            render: (_: unknown, a: AccountRow) => (
              <button className="btn" type="button" onClick={e => { e.stopPropagation(); setOpen(a); }}>
                Edit
              </button>
            ),
          },
        ];

        return (
          <AntTable<AccountRow>
            dataSource={accounts}
            columns={columns}
            rowKey="id"
            onRowClick={a => setOpen(a)}
            emptyTitle="No accounts yet"
            emptyDescription="Create sign-in accounts for administrators and team members."
            emptyAction={<button className="btn primary" type="button" onClick={() => setOpen("new")}>+ Add account</button>}
          />
        );
      })()}
      {unlinked.length > 0 && (
        <p className="muted" style={{ fontSize: 13, marginTop: 12 }}>
          Developers without a sign-in account: {unlinked.map(d => d.name + (d.title ? ` (${d.title})` : "")).join(", ")}. That's fine for contract developers who only get tasks assigned.
        </p>
      )}
      {open && <AccountForm key={open === "new" ? "new" : open.id} account={open === "new" ? null : open} meId={meId} developers={developers} onClose={() => setOpen(null)} />}
    </>
  );
}

function AccountForm({ account, meId, developers, onClose }: { account: AccountRow | null; meId: string; developers: Dev[]; onClose: () => void }) {
  const initial = useMemo(() => ({
    name: account?.name ?? "", email: account?.email ?? "", role: account?.role === "Viewer" ? "Viewer" : "Admin",
    developerId: account?.developerId ?? "", active: account?.active ?? true, password: account ? "" : tempPassword(),
  }), [account]);
  const [f, setF] = useState(initial);
  const [error, setError] = useState("");
  const [busy, start] = useTransition();
  const dirty = JSON.stringify(f) !== JSON.stringify(initial);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF(p => ({ ...p, [k]: v }));
  const locked = !!account && (account.isOwner || account.id === meId);
  // developers not linked to another account
  const devOptions = developers.filter(d => !d.accountId || d.accountId === account?.id);

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      setError("");
      const role = f.role as "Admin" | "Viewer";
      const r = account
        ? await updateAccount({ id: account.id, name: f.name, role, developerId: f.developerId, active: f.active, password: f.password })
        : await createAccount({ name: f.name, email: f.email, password: f.password, role, developerId: f.developerId });
      if (!r.ok) { setError(r.error); return; }
      toast(account ? (f.password ? "Saved. Give them the new temporary password." : "Saved") : "Account created. Give them the temporary password.");
      onClose();
    });
  };

  return (
    <Panel
      title={account ? `Edit ${account.name}` : "Add account"}
      subtitle={account ? account.email : "They sign in with this email and the temporary password, then change it under My account."}
      dirty={dirty}
      onClose={onClose}
      footer={<><span /><div>
        <button className="btn" type="button" onClick={() => { if (!dirty || confirm("You have unsaved changes. Close without saving?")) onClose(); }}>Cancel</button>
        <button className="btn primary" type="submit" form="accform" disabled={busy}>{busy ? "Saving…" : account ? "Save" : "Create account"}</button>
      </div></>}
    >
      <form className="form" id="accform" onSubmit={save}>
        <div className="field"><label htmlFor="a_name">Name</label><AntInput id="a_name" required value={f.name} onChange={e => set("name", e.target.value)} autoFocus={!account} /></div>
        <div className="field"><label htmlFor="a_email">Email</label><AntInput id="a_email" type="email" required value={f.email} disabled={!!account} onChange={e => set("email", e.target.value)} /></div>
        <div className="field">
          <label htmlFor="a_role">Role</label>
          <AntSelect
            id="a_role"
            value={f.role}
            disabled={locked}
            onChange={e => set("role", e.target.value)}
            options={[["Admin", "Admin"], ["Viewer", "Viewer (read-only)"]]}
          />
        </div>
        <div className="field">
          <label htmlFor="a_dev">Developer record</label>
          <AntSelect
            id="a_dev"
            value={f.developerId}
            onChange={e => set("developerId", e.target.value)}
            empty="Not a developer"
            options={devOptions.map(d => [d.id, `${d.name}${d.title ? ` · ${d.title}` : ""}`])}
          />
        </div>
        <div className="field full">
          <label htmlFor="a_pw">{account ? "Reset password (leave empty to keep the current one)" : "Temporary password"}</label>
          <div style={{ display: "flex", gap: 8 }}>
            <AntInput id="a_pw" value={f.password} minLength={8} required={!account} onChange={e => set("password", e.target.value)} className="mono" style={{ flex: 1 }} autoComplete="off" />
            <button className="btn" type="button" onClick={() => set("password", tempPassword())}>Generate</button>
          </div>
        </div>
        {account && (
          <div className="field full">
            <label style={{ display: "flex", gap: 8, alignItems: "center", color: "var(--fg)", fontSize: 14 }}>
              <AntCheckbox checked={f.active} disabled={locked} onChange={e => set("active", e.target.checked)}>
                Account is active (untick to suspend: they can't sign in, their history stays)
              </AntCheckbox>
            </label>
            {locked && <span className="muted" style={{ fontSize: 12 }}>{account.isOwner ? "The owner account always stays an active Admin." : "You can't change your own role or suspend yourself."}</span>}
          </div>
        )}
        {error && <p className="field full" role="alert" style={{ color: "var(--bad)", margin: 0 }}>{error}</p>}
      </form>
    </Panel>
  );
}
