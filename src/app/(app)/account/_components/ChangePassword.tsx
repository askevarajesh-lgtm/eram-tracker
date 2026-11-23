"use client";
import { useState, useTransition } from "react";
import { changeOwnPassword } from "@/server/accounts";
import { toast } from "@/components/ui/Toaster";
import { AntPassword } from "@/components/ui/antd";

export function ChangePassword() {
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [error, setError] = useState("");
  const [busy, start] = useTransition();
  return (
    <form
      className="form"
      style={{ gridTemplateColumns: "1fr" }}
      onSubmit={e => {
        e.preventDefault();
        if (next !== again) { setError("The new passwords don't match."); return; }
        start(async () => {
          setError("");
          const r = await changeOwnPassword(cur, next);
          if (!r.ok) { setError(r.error); return; }
          setCur(""); setNext(""); setAgain("");
          toast("Password changed");
        });
      }}
    >
      <h2 className="sec" style={{ margin: 0 }}>Change password</h2>
      <div className="field"><label htmlFor="pw_cur">Current password</label><AntPassword id="pw_cur" autoComplete="current-password" required value={cur} onChange={e => setCur(e.target.value)} /></div>
      <div className="field"><label htmlFor="pw_new">New password</label><AntPassword id="pw_new" autoComplete="new-password" minLength={8} required value={next} onChange={e => setNext(e.target.value)} /></div>
      <div className="field"><label htmlFor="pw_again">New password again</label><AntPassword id="pw_again" autoComplete="new-password" minLength={8} required value={again} onChange={e => setAgain(e.target.value)} /></div>
      {error && <p role="alert" style={{ color: "var(--bad)", margin: 0 }}>{error}</p>}
      <div><button className="btn primary" type="submit" disabled={busy}>{busy ? "Saving…" : "Change password"}</button></div>
    </form>
  );
}
