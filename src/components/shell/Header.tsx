"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { SearchPanel } from "./Search";
import { ImportPanel } from "@/components/shared/excel/ImportPanel";
import { Icon } from "@/components/Icon";
import { Menu } from "./Menu";
import { ThemeToggle } from "./ThemeToggle";
import { logout } from "@/server/auth";

/** Live counts shown in the notification bell. `approvals` is null for users who cannot approve. */
export type Alerts = { issues: number; approvals: number | null; calendar: number; uat: number };

type Props = {
  canEdit: boolean; canImport: boolean; projects: { id: string; name: string }[];
  name: string; role: string; alerts: Alerts;
};

const initials = (n: string) => {
  const w = n.trim().split(/\s+/).filter(Boolean);
  return (w.length > 1 ? w[0][0] + w[1][0] : (w[0] ?? "?").slice(0, 2)).toUpperCase();
};

export function Header({ canEdit, canImport, projects, name, role, alerts }: Props) {
  const [importing, setImporting] = useState(false);
  const [searching, setSearching] = useState(false);
  // Ctrl+K / ⌘K opens search
  useEffect(() => {
    const on = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setSearching(true); } };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, []);

  const notes = [
    { key: "issues", href: "/issues", label: "Open urgent issues", n: alerts.issues, tone: "bad" },
    ...(alerts.approvals != null ? [{ key: "approvals", href: "/approvals", label: "Waiting for approval", n: alerts.approvals, tone: "warn" }] : []),
    { key: "calendar", href: "/calendar", label: "Meetings planned today", n: alerts.calendar, tone: "info" },
    { key: "uat", href: "/uat", label: "Waiting for user sign-off", n: alerts.uat, tone: "ok" },
  ];
  // the badge counts things that need action today; UAT is listed but not counted
  const badge = alerts.issues + (alerts.approvals ?? 0) + alerts.calendar;

  return (
    <>
      <header className="top">
      <div className="topin">
        <button className="iconbtn navbtn" type="button" aria-label="Open navigation" onClick={() => document.body.classList.add("navopen")}>
          <Icon name="menu" />
        </button>

        <button className="tsearch" type="button" title="Search (Ctrl+K)" aria-label="Search" onClick={() => setSearching(true)}>
          <Icon name="search" />
          <span className="ph">Search modules, tasks, people…</span>
          <kbd>Ctrl K</kbd>
        </button>

        <div className="tright">
          {canImport && (
            <button className="tbtn" type="button" title="Upload data from Excel or CSV" onClick={() => setImporting(true)}>
              <Icon name="upload" /><span className="lbl">Upload</span>
            </button>
          )}
          <a className="tbtn" href="/api/export" download title="Download everything as an Excel workbook">
            <Icon name="download" /><span className="lbl">Download Excel</span>
          </a>
          <Link className="tbtn bad" href="/issues?new=1" title="Raise urgent issue">
            <Icon name="alert" /><span className="lbl">Raise issue</span>
          </Link>

          {canEdit && (
            <Link className="tcreate" href="/tasks?new=1" title="Create task" style={{ textDecoration: "none" }}>
              <span className="plus"><Icon name="plus" /></span><span className="lbl">Create task</span>
            </Link>
          )}

          <Menu label={badge ? `Notifications (${badge})` : "Notifications"} btnClass="ticon" trigger={<>
            <Icon name="bell" />
            {badge > 0 && <span className="nbadge">{badge > 99 ? "99+" : badge}</span>}
          </>}>
            <div className="tpophead"><b>Notifications</b><span className="muted">Live counts</span></div>
            {notes.map(x => (
              <Link key={x.key} href={x.href} className="tpopitem" role="menuitem">
                <span className={"nico " + x.tone}><Icon name={x.key} /></span>
                <span className="grow">{x.label}</span>
                <span className={"npill" + (x.n ? " " + x.tone : "")}>{x.n}</span>
              </Link>
            ))}
            <Link href="/reminders" className="tpopfoot" role="menuitem">Open reminders <Icon name="chevR" /></Link>
          </Menu>

          <Menu label="Account menu" btnClass="tuser" trigger={<>
            <span className="uav">{initials(name)}<i /></span>
            <span className="utx"><b>{name}</b><small>{role === "Admin" ? "Administrator" : role}</small></span>
            <Icon name="chevD" className="i uchev" />
          </>}>
            <div className="tpophead"><b>{name}</b><span className="muted">{role}</span></div>
            <Link href="/account" className="tpopitem" role="menuitem">
              <span className="nico"><Icon name="account" /></span><span className="grow">Account &amp; password</span>
            </Link>
            <div className="tpopsec">Theme</div>
            <div className="tpoptheme"><ThemeToggle /></div>
            <form action={logout} className="tpopform">
              <button type="submit" className="tpopitem danger" role="menuitem">
                <span className="nico bad"><Icon name="logout" /></span><span className="grow">Sign out</span>
              </button>
            </form>
          </Menu>
        </div>
      </div>
    </header>
    {searching && <SearchPanel onClose={() => setSearching(false)} />}
    {importing && <ImportPanel projects={projects} onClose={() => setImporting(false)} />}
  </>
  );
}
