import Link from "next/link";
import { Download } from "lucide-react";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireViewer } from "@/lib/session";
import { getNotifySettings } from "@/lib/settings";
import { dayStr, fmtDay, today } from "@/lib/dates";
import { addDays, weekStart } from "@/lib/work";
import { OPEN_STATUSES } from "@/lib/issues";
import { historyTasks, openAtEnd } from "@/server/history";
import { Bars, Line } from "@/components/ui/charts";
import { AItem, Card } from "@/components/ui/bits";
import { Chip } from "@/components/ui/Chip";
import { Kpi } from "@/components/ui/Kpi";
import { UrlFilters } from "@/components/ui/UrlFilters";
import { MILESTONE_COLOR, milestoneStatus } from "@/lib/plan";

export const metadata: Metadata = { title: "Reports" };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  await requireViewer();
  const sp = await searchParams;
  const P = sp.p ?? "";
  const D = today();
  const [projects, L, developers, issues, releases, milestones, cfg] = await Promise.all([
    db.project.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
    historyTasks(P ? { projectId: P } : {}),
    db.developer.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.issue.findMany({ where: P ? { projectId: P } : {}, include: { assignees: true } }),
    db.release.findMany({ where: { status: "Released" }, include: { tasks: { select: { id: true } } } }),
    db.milestone.findMany({ where: P ? { projectId: P } : {}, orderBy: { target: "asc" }, include: { project: { select: { name: true } } } }),
    getNotifySettings(),
  ]);
  const weeks = Array.from({ length: 12 }, (_, k) => weekStart(addDays(D, -7 * (11 - k))));
  const wl = weeks.map(w => new Date(w + "T00:00:00Z").toLocaleDateString(undefined, { day: "numeric", month: "short", timeZone: "UTC" }));
  const inWeek = (x: string, w: string) => !!x && x >= w && x < addDays(w, 7);
  const live = new Set(releases.flatMap(r => r.tasks.map(t => t.id)));
  const done = L.filter(t => t.status === "done");
  const undated = done.filter(t => !t.doneOn).length;
  const stages: [string, number, string][] = [
    ["All items", L.length, "var(--muted)"], ["Developed", done.length, "var(--info)"],
    ["Tested by business users", L.filter(t => t.testStatus === "Completed" || t.acceptStatus === "Accepted").length, "var(--lms)"],
    ["Accepted", L.filter(t => t.acceptStatus === "Accepted").length, "var(--accent)"], ["Live", L.filter(t => t.reqStatus === "Live" || live.has(t.id)).length, "var(--ok)"],
  ];
  const slaDue = (x: (typeof issues)[number]) => x.createdAt.getTime() + (cfg.sla[x.priority as keyof typeof cfg.sla] ?? 72) * 3600e3;
  const res = issues.filter(x => x.resolvedAt);
  const inSla = res.filter(x => x.resolvedAt!.getTime() <= slaDue(x)).length;
  const avgH = res.length ? res.reduce((a, x) => a + (x.resolvedAt!.getTime() - x.createdAt.getTime()) / 36e5, 0) / res.length : 0;
  const openIss = issues.filter(x => (OPEN_STATUSES as string[]).includes(x.status));
  const late = openIss.filter(x => slaDue(x) < Date.now()).length;
  const d28 = addDays(D, -28);

  return (
    <>
      <UrlFilters selects={[{ key: "p", all: "All projects", options: projects.map(p => [p.id, p.name]) }]}>
        <span style={{ flex: 1 }} />
        <a className="btn" href={`/api/reports/week?d=${D}`} download>
          <Download size={14} style={{ display: "inline-block", verticalAlign: "-2px", marginRight: 6 }} />
          Week report
        </a>
        <a className="btn primary" href="/api/reports/mgmt" download>
          <Download size={14} style={{ display: "inline-block", verticalAlign: "-2px", marginRight: 6 }} />
          Management summary
        </a>
      </UrlFilters>

      <Card title="Delivery stages: from developed to live">
        <div style={{ display: "grid", gap: 8 }}>
          {stages.map(([l, n, c], k) => (
            <div key={l} style={{ display: "grid", gridTemplateColumns: "190px 1fr 80px", gap: 12, alignItems: "center" }}>
              <span style={{ fontWeight: 600 }}>{l}</span>
              <div style={{ height: 22, background: "var(--sunk)", borderRadius: 6, overflow: "hidden" }}><i style={{ display: "block", height: "100%", width: (L.length ? (n / L.length) * 100 : 0) + "%", background: c, borderRadius: 6 }} /></div>
              <span className="mono" style={{ textAlign: "right" }}><b>{n}</b> {k > 0 && <span className="muted">{L.length ? Math.round((n / L.length) * 100) : 0}%</span>}</span>
            </div>
          ))}
        </div>
        <p className="muted" style={{ fontSize: 12, margin: "10px 0 0" }}>&quot;Live&quot; means the item is in a released version or marked Live. Record sign-off in UAT &amp; sign-off and releases in Plan &amp; control to move items along.</p>
      </Card>

      <div className="two" style={{ marginTop: 18 }}>
        <Card title="Completed per week" extra={undated > 0 ? <Chip color="var(--warn)">{undated} done items have no completed date</Chip> : undefined}>
          <Bars labels={wl} series={[
            { name: "Completed", color: "var(--ok)", values: weeks.map(w => L.filter(t => inWeek(t.doneOn, w)).length) },
            { name: "New", color: "var(--info)", values: weeks.map(w => L.filter(t => !t.source && inWeek(t.created, w)).length) },
          ]} />
        </Card>
        <Card title="Open items over time"><Line labels={wl} values={weeks.map(w => L.filter(t => openAtEnd(t, addDays(w, 6))).length)} /></Card>
      </div>

      <div className="two" style={{ marginTop: 18 }}>
        <Card title="Urgent issues per week">
          <Bars labels={wl} series={[
            { name: "Raised", color: "var(--bad)", values: weeks.map(w => issues.filter(x => inWeek(x.createdAt.toISOString().slice(0, 10), w)).length) },
            { name: "Resolved", color: "var(--ok)", values: weeks.map(w => issues.filter(x => inWeek(x.resolvedAt?.toISOString().slice(0, 10) ?? "", w)).length) },
          ]} />
        </Card>
        <Card title="Issue response performance">
          <div className="kpis" style={{ gridTemplateColumns: "repeat(2,1fr)" }}>
            <Kpi n={issues.length} label="Raised" /><Kpi n={res.length} label="Resolved" />
            <Kpi n={res.length ? Math.round((inSla / res.length) * 100) + "%" : "—"} label="Resolved within target" /><Kpi n={res.length ? avgH.toFixed(1) + "h" : "—"} label="Average time to resolve" />
            <Kpi n={late} label="Open past target" bad={late > 0} /><Kpi n={openIss.length} label="Open now" />
          </div>
        </Card>
      </div>

      <div className="two" style={{ marginTop: 18 }}>
        <Card title="Developer output · last 4 weeks">
          <Bars labels={developers.map(v => v.name.split(" ")[0])} series={[
            { name: "Completed", color: "var(--ok)", values: developers.map(v => L.filter(t => t.devIds.includes(v.id) && t.doneOn >= d28).length) },
            { name: "Status changes", color: "var(--info)", values: developers.map(v => L.filter(t => t.devIds.includes(v.id)).reduce((a, t) => a + t.moves.filter(m => m.d >= d28).length, 0)) },
            { name: "Issues resolved", color: "var(--bad)", values: developers.map(v => issues.filter(x => x.assignees.some(a => a.developerId === v.id) && (x.resolvedAt?.toISOString().slice(0, 10) ?? "") >= d28).length) },
          ]} />
        </Card>
        <Card title="Milestones" extra={<Link className="btn" href="/plan?tab=milestones">Manage</Link>}>
          {!milestones.length ? <p className="muted" style={{ margin: 0 }}>No milestones yet. Add target dates per project in Plan &amp; control.</p> : (
            <div className="alist">
              {milestones.slice(0, 10).map(m => {
                const st = milestoneStatus({ status: m.status, target: dayStr(m.target) });
                return <AItem key={m.id} color={MILESTONE_COLOR[st]} href={`/plan?tab=milestones&edit=${m.id}`} title={m.title} sub={`${m.project?.name ?? ""} · target ${fmtDay(m.target)}${m.doneOn ? " · done " + fmtDay(m.doneOn) : ""}`} right={<Chip color={MILESTONE_COLOR[st]}>{st}</Chip>} />;
              })}
            </div>
          )}
        </Card>
      </div>
      <p className="muted" style={{ fontSize: 12, marginTop: 14 }}>New items per week exclude rows loaded from Excel.</p>
    </>
  );
}
