"use client";

import Link from "next/link";
import type { TaskStatus, Priority } from "@prisma/client";
import { ACTIVE_STATUSES, TASK_STATUSES, projectColor } from "@/lib/constants";
import { averageProgress } from "@/lib/work";
import { fmtDay } from "@/lib/dates";
import { Kpi } from "@/components/ui/Kpi";
import { Empty, SegBar } from "@/components/ui/bits";
import { AntTable, type ColumnsType } from "@/components/ui/antd";

export type OverviewTask = {
  id: string;
  title: string;
  projectId: string | null;
  subModule: string;
  type: string;
  status: TaskStatus;
  progress: number | null;
  dueDate: string | null;
  priority: Priority | null;
  testStatus: string;
  acceptStatus: string;
  projectName?: string;
  assignees: { developerId: string; developerName: string }[];
};

export type OverviewProject = {
  id: string;
  name: string;
  fullName: string;
  phase: string | null;
  target: string | null;
};

export type OverviewDeveloper = {
  id: string;
  name: string;
  title: string | null;
};

type Props = {
  todayStr: string;
  projects: OverviewProject[];
  tasks: OverviewTask[];
  developers: OverviewDeveloper[];
};

export function OverviewView({ todayStr, projects, tasks, developers }: Props) {
  const over = (t: OverviewTask) => t.status !== "done" && !!t.dueDate && t.dueDate < todayStr;
  const active = (s: string) => (ACTIVE_STATUSES as readonly string[]).includes(s);

  const sum = (G: OverviewTask[]) => ({
    total: G.length,
    screens: G.filter(t => t.type === "Screen").length,
    reports: G.filter(t => t.type === "Report").length,
    process: G.filter(t => t.type === "Process").length,
    done: G.filter(t => t.status === "done").length,
    prog: G.filter(t => active(t.status)).length,
    open: G.filter(t => t.status === "pending" || t.status === "hold").length,
    tested: G.filter(t => t.testStatus === "Completed").length,
    accepted: G.filter(t => t.acceptStatus === "Accepted").length,
    pct: averageProgress(G),
  });

  const maxLoad = Math.max(
    1,
    ...developers.map(d =>
      tasks.filter(t => t.assignees.some(a => a.developerId === d.id) && t.status !== "done" && t.status !== "pending").length
    )
  );

  const attention = tasks
    .filter(t => t.status !== "done" && (over(t) || t.status === "hold" || t.priority === "Critical"))
    .sort((a, b) => Number(over(b)) - Number(over(a)) || (a.dueDate || "9999").localeCompare(b.dueDate || "9999"))
    .slice(0, 10);

  type ModuleStatusRow = {
    key: string;
    projectId: string;
    projectName: string;
    showProject: boolean;
    module: string;
    total: number;
    screens: number;
    reports: number;
    process: number;
    done: number;
    prog: number;
    open: number;
    tested: number;
    accepted: number;
    pct: number;
    isTotal: boolean;
  };

  const moduleRows: ModuleStatusRow[] = projects
    .filter(p => tasks.some(t => t.projectId === p.id && t.subModule))
    .flatMap(p => {
      const L = tasks.filter(t => t.projectId === p.id);
      const subs = [...new Set(L.map(t => t.subModule))].sort();
      const tot = sum(L);
      return [
        ...subs.map((sb, ix) => {
          const r = sum(L.filter(t => t.subModule === sb));
          return {
            key: `${p.id}_${sb}`,
            projectId: p.id,
            projectName: p.name,
            showProject: ix === 0,
            module: sb || "(no module)",
            total: r.total,
            screens: r.screens,
            reports: r.reports,
            process: r.process,
            done: r.done,
            prog: r.prog,
            open: r.open,
            tested: r.tested,
            accepted: r.accepted,
            pct: r.pct,
            isTotal: false,
          };
        }),
        {
          key: `${p.id}_tot`,
          projectId: p.id,
          projectName: p.name,
          showProject: false,
          module: `Total ${p.name}`,
          total: tot.total,
          screens: tot.screens,
          reports: tot.reports,
          process: tot.process,
          done: tot.done,
          prog: tot.prog,
          open: tot.open,
          tested: tot.tested,
          accepted: tot.accepted,
          pct: tot.pct,
          isTotal: true,
        },
      ];
    });

  const moduleColumns: ColumnsType<ModuleStatusRow> = [
    {
      title: "Project",
      dataIndex: "projectName",
      key: "projectName",
      width: 110,
      render: (_, r) =>
        r.showProject ? (
          <span className="mtag" style={{ ["--mc" as string]: projectColor(r.projectName) }}>
            {r.projectName}
          </span>
        ) : null,
    },
    {
      title: "Module",
      dataIndex: "module",
      key: "module",
      render: (mod: string, r) =>
        r.isTotal ? (
          <b>{mod}</b>
        ) : (
          <Link href={`/tasks?project=${r.projectId}&q=${encodeURIComponent(mod)}`} style={{ color: "inherit", fontWeight: 500 }}>
            {mod}
          </Link>
        ),
    },
    {
      title: "Total",
      dataIndex: "total",
      key: "total",
      align: "right",
      render: (val: number, r) => (r.isTotal ? <b>{val}</b> : val),
    },
    {
      title: "Screens",
      dataIndex: "screens",
      key: "screens",
      align: "right",
      render: (val: number, r) => (r.isTotal ? <b>{val}</b> : <span className="muted">{val}</span>),
    },
    {
      title: "Reports",
      dataIndex: "reports",
      key: "reports",
      align: "right",
      render: (val: number, r) => (r.isTotal ? <b>{val}</b> : <span className="muted">{val}</span>),
    },
    {
      title: "Process",
      dataIndex: "process",
      key: "process",
      align: "right",
      render: (val: number, r) => (r.isTotal ? <b>{val}</b> : <span className="muted">{val}</span>),
    },
    {
      title: "Developed",
      dataIndex: "done",
      key: "done",
      align: "right",
      render: (val: number, r) => (r.isTotal ? <b>{val}</b> : val),
    },
    {
      title: "In progress",
      dataIndex: "prog",
      key: "prog",
      align: "right",
      render: (val: number, r) => (r.isTotal ? <b>{val}</b> : <span style={val ? { color: "var(--info)", fontWeight: 600 } : undefined}>{val}</span>),
    },
    {
      title: "Open",
      dataIndex: "open",
      key: "open",
      align: "right",
      render: (val: number, r) => (r.isTotal ? <b>{val}</b> : <span style={val ? { color: "var(--warn)", fontWeight: 600 } : undefined}>{val}</span>),
    },
    {
      title: "Tested",
      dataIndex: "tested",
      key: "tested",
      align: "right",
      render: (val: number, r) => (r.isTotal ? <b>{val}</b> : val),
    },
    {
      title: "Accepted",
      dataIndex: "accepted",
      key: "accepted",
      align: "right",
      render: (val: number, r) => (r.isTotal ? <b>{val}</b> : val),
    },
    {
      title: "Progress",
      dataIndex: "pct",
      key: "pct",
      width: 140,
      render: (pct: number, r) =>
        r.isTotal ? (
          <span className="mono">
            <b>{pct}%</b>
          </span>
        ) : (
          <div className="progress">
            <div className="bar">
              <i style={{ width: pct + "%", background: projectColor(r.projectName) }} />
            </div>
            <span className="mono">{pct}%</span>
          </div>
        ),
    },
  ];

  type DevWorkloadRow = {
    id: string;
    name: string;
    title: string | null;
    total: number;
    ongoing: number;
    open: number;
    done: number;
    overdue: number;
    loadRatio: number;
  };

  const devRows: DevWorkloadRow[] = developers.map(d => {
    const L = tasks.filter(t => t.assignees.some(a => a.developerId === d.id));
    const on = L.filter(t => ["progress", "qa", "uat", "hold"].includes(t.status)).length;
    const ov = L.filter(over).length;
    return {
      id: d.id,
      name: d.name,
      title: d.title,
      total: L.length,
      ongoing: on,
      open: L.filter(t => t.status === "pending").length,
      done: L.filter(t => t.status === "done").length,
      overdue: ov,
      loadRatio: (on / maxLoad) * 100,
    };
  });

  const devColumns: ColumnsType<DevWorkloadRow> = [
    {
      title: "Developer",
      dataIndex: "name",
      key: "name",
      render: (name: string, r) => (
        <div>
          <Link href={`/tasks?dev=${r.id}`} style={{ color: "inherit", fontWeight: 700 }}>
            {name}
          </Link>
          <div className="muted" style={{ fontSize: 12 }}>
            {r.title}
          </div>
        </div>
      ),
    },
    {
      title: "Total",
      dataIndex: "total",
      key: "total",
      align: "right",
    },
    {
      title: "Ongoing",
      dataIndex: "ongoing",
      key: "ongoing",
      align: "right",
    },
    {
      title: "Open",
      dataIndex: "open",
      key: "open",
      align: "right",
    },
    {
      title: "Done",
      dataIndex: "done",
      key: "done",
      align: "right",
    },
    {
      title: "Overdue",
      dataIndex: "overdue",
      key: "overdue",
      align: "right",
      render: (ov: number) => <span style={ov ? { color: "var(--bad)", fontWeight: 600 } : undefined}>{ov}</span>,
    },
    {
      title: "Load",
      dataIndex: "loadRatio",
      key: "loadRatio",
      width: 120,
      render: (pct: number) => (
        <div className="progress">
          <div className="bar">
            <i style={{ width: pct + "%" }} />
          </div>
        </div>
      ),
    },
  ];

  return (
    <>
      <p className="eyebrow">Portfolio · as of {fmtDay(todayStr)}</p>
      <div className="kpis">
        <Kpi n={tasks.length} label="Total items" href="/tasks" />
        <Kpi n={tasks.filter(t => active(t.status)).length} label="Ongoing" />
        <Kpi n={tasks.filter(t => t.status === "pending").length} label="Pending start" href="/tasks?status=pending" />
        <Kpi n={tasks.filter(t => t.status === "done").length} label="Developed" href="/delivered" />
        <Kpi n={tasks.filter(t => t.acceptStatus === "Accepted").length} label="User accepted" />
        <Kpi n={tasks.filter(over).length} label="Overdue" bad={tasks.some(over)} />
        <Kpi n={averageProgress(tasks) + "%"} label="Overall progress" />
      </div>

      <h2 className="sec">Projects</h2>
      {!projects.length ? (
        <Empty title="No projects yet">Add projects under Setup → Projects.</Empty>
      ) : (
        <div className="modgrid">
          {projects.map(p => {
            const L = tasks.filter(t => t.projectId === p.id);
            const devs = new Set(L.filter(t => t.status !== "done").flatMap(t => t.assignees.map(a => a.developerId)));
            const next = L.filter(t => t.status !== "done" && t.dueDate)
              .sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || ""))[0];
            const late = L.filter(over).length;
            return (
              <Link
                key={p.id}
                href={`/tasks?project=${p.id}`}
                className="mod"
                style={{ ["--mc" as string]: projectColor(p.name), textDecoration: "none", color: "inherit" }}
              >
                <h3>
                  {p.name}
                  <span className="pct">{averageProgress(L)}%</span>
                </h3>
                <div className="meta">
                  <span>{p.fullName}</span>
                  {p.phase && <span>Phase: {p.phase}</span>}
                  {p.target && <span>Go-live {p.target}</span>}
                </div>
                <SegBar statuses={L.map(t => t.status)} />
                <div className="legend">
                  {TASK_STATUSES.map(s => {
                    const c = L.filter(t => t.status === s.key).length;
                    return c ? (
                      <span key={s.key}>
                        <i className="dot" style={{ background: s.color }} />
                        {s.label} {c}
                      </span>
                    ) : null;
                  })}
                  {!L.length && <span>No items yet</span>}
                </div>
                <div className="meta">
                  <span>{L.length} items</span>
                  <span>
                    {devs.size} developer{devs.size === 1 ? "" : "s"} active
                  </span>
                  {late > 0 && <span style={{ color: "var(--bad)" }}>{late} overdue</span>}
                  {next && <span>Next due {fmtDay(next.dueDate)}</span>}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {tasks.some(t => t.subModule) && (
        <>
          <h2 className="sec">Module status report</h2>
          <div className="tablewrap">
            <AntTable
              dataSource={moduleRows}
              columns={moduleColumns}
              rowKey="key"
              pagination={false}
              rowClassName={r => (r.isTotal ? "total-row" : "")}
              emptyText="No module tasks recorded"
            />
          </div>
        </>
      )}

      <div className="two">
        <div>
          <h2 className="sec">Developer workload</h2>
          {!developers.length ? (
            <Empty title="No developers yet">Add your team on the Developers page.</Empty>
          ) : (
            <div className="tablewrap">
              <AntTable
                dataSource={devRows}
                columns={devColumns}
                rowKey="id"
                pagination={false}
                emptyText="No developers yet"
              />
            </div>
          )}
        </div>
        <div>
          <h2 className="sec">Needs attention</h2>
          {!attention.length ? (
            <Empty title="Nothing flagged">Overdue, blocked, critical and due-this-week items appear here.</Empty>
          ) : (
            <div className="alist">
              {attention.map(t => {
                const isOver = over(t);
                const c = isOver || t.status === "hold" ? "var(--bad)" : t.priority === "Critical" ? "var(--warn)" : "var(--info)";
                const why = isOver ? "Overdue" : t.status === "hold" ? "On hold / blocked" : t.priority === "Critical" ? "Critical" : "Due soon";
                const devName = t.assignees[0]?.developerName;
                return (
                  <Link
                    key={t.id}
                    href={`/tasks?edit=${t.id}`}
                    className="aitem"
                    style={{ ["--c" as string]: c, textDecoration: "none", color: "inherit" }}
                  >
                    <span className="stripe" />
                    <div style={{ minWidth: 0 }}>
                      <div className="t">{t.title}</div>
                      <div className="s">
                        {why}
                        {devName && ` · ${devName}`}
                        {t.dueDate && ` · due ${fmtDay(t.dueDate)}`}
                      </div>
                    </div>
                    <span />
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
