"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { NAV, navByHref } from "@/lib/nav";
import { Icon } from "@/components/Icon";

type Props = { counts: Record<string, number | null>; role: string; version: string };

const MINI_KEY = "dev360side";   // "mini" = icon-only sidebar (desktop)
const GRP_KEY = "dev360navgrp";  // JSON list of collapsed nav groups

export function Sidebar({ counts, role, version }: Props) {
  const path = usePathname();
  const current = navByHref(path)?.key;
  // close the mobile drawer after navigating
  useEffect(() => document.body.classList.remove("navopen"), [path]);

  // icon-only mode; the pre-paint script in the root layout sets data-side so there is no flash
  const [mini, setMini] = useState(false);
  const [closed, setClosed] = useState<string[]>([]);
  useEffect(() => {
    setMini(document.documentElement.getAttribute("data-side") === "mini");
    try { setClosed(JSON.parse(localStorage.getItem(GRP_KEY) || "[]")); } catch {}
  }, []);
  const toggleMini = () => {
    const next = !mini;
    setMini(next);
    if (next) document.documentElement.setAttribute("data-side", "mini"); else document.documentElement.removeAttribute("data-side");
    try { localStorage.setItem(MINI_KEY, next ? "mini" : "full"); } catch {}
  };
  const toggleGroup = (g: string) => {
    const next = closed.includes(g) ? closed.filter(x => x !== g) : [...closed, g];
    setClosed(next);
    try { localStorage.setItem(GRP_KEY, JSON.stringify(next)); } catch {}
  };

  const canManage = role === "Admin" || role === "Manager";
  return (
    <>
      <aside className="side" id="side" aria-label="Main navigation">
        <Link href="/" className="logo" style={{ textDecoration: "none" }}>
          <span className="mark">E</span>
          <div className="logotx">
            <b>ERAM HCM</b>
            <small>Business Tools <span className="tag">Tracker</span></small>
          </div>
        </Link>
        <nav className="nav">
          {NAV.map(g => {
            const items = g.items.filter(i => (!i.adminOnly || role === "Admin") && (!i.managerOnly || canManage));
            if (!items.length) return null;
            const open = mini || !closed.includes(g.group);
            const id = "grp-" + g.group.replace(/\W+/g, "-").toLowerCase();
            return (
              <div key={g.group} className="navgrp">
                <button type="button" className="grp" aria-expanded={open} aria-controls={id} onClick={() => toggleGroup(g.group)}>
                  <span className="gdot" />
                  <span className="gname">{g.group}</span>
                  <span className="gline" />
                  <span className="gct">{items.length}</span>
                  <Icon name="chevD" className="i gchev" />
                </button>
                <div className="navitems" id={id} hidden={!open}>
                  {items.map(i => {
                    const n = counts[i.key];
                    const on = current === i.key;
                    return (
                      <Link key={i.key} href={i.href} title={mini ? i.label : undefined} aria-current={on ? "page" : undefined} prefetch={i.ready}>
                        <span className="nico"><Icon name={i.key} /></span>
                        <span className="nlbl">{i.label}</span>
                        {n != null && n > 0 && <span className="ct">{n}</span>}
                        {on && <Icon name="chevR" className="i nchev" />}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>
        <div className="side-foot">
          <div className="sysok" title="All systems operational">
            <span className="pulse" />
            <div className="sytx"><b>All systems operational</b><small>Eram Tracker</small></div>
            <span className="ver">v{version}</span>
          </div>
        </div>
      </aside>
      <button type="button" className="sidetoggle" onClick={toggleMini} aria-label={mini ? "Expand sidebar" : "Collapse sidebar"} title={mini ? "Expand sidebar" : "Collapse sidebar"}>
        <Icon name={mini ? "chevR" : "chevL"} />
      </button>
      <div className="navscrim" onClick={() => document.body.classList.remove("navopen")} />
    </>
  );
}
