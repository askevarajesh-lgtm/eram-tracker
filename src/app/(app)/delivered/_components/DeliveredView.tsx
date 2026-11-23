"use client";

import Link from "next/link";
import { Download } from "lucide-react";
import { projectColor } from "@/lib/constants";
import { fmtDay } from "@/lib/dates";
import { Empty, ValueChip } from "@/components/ui/bits";
import { AntTable, type ColumnsType } from "@/components/ui/antd";

export type DeliveredTask = {
  id: string;
  sno: number | null;
  projectId: string | null;
  subModule: string;
  title: string;
  version: string | null;
  type: string;
  branch: string;
  endUsers: string;
  acceptStatus: string;
  completedDate: string | null;
  assignees: { developerName: string }[];
};

export type DeliveredProject = {
  id: string | null;
  name: string;
  full: string;
};

type Props = {
  groups: DeliveredProject[];
  tasks: DeliveredTask[];
};

export function DeliveredView({ groups, tasks }: Props) {
  const deliveredColumns: ColumnsType<DeliveredTask> = [
    {
      title: "S.No",
      dataIndex: "sno",
      key: "sno",
      className: "num mono muted",
      width: 75,
    },
    {
      title: "Module",
      dataIndex: "subModule",
      key: "subModule",
    },
    {
      title: "Item",
      dataIndex: "title",
      key: "title",
      render: (title: string, t) => (
        <div>
          <Link href={`/tasks?edit=${t.id}`} style={{ color: "inherit", fontWeight: 500 }}>
            {title}
          </Link>
          {t.version && <> <span className="mono muted">{t.version}</span></>}
        </div>
      ),
    },
    {
      title: "Type",
      dataIndex: "type",
      key: "type",
      className: "muted",
    },
    {
      title: "Developed by",
      key: "developedBy",
      render: (_, t) => t.assignees.map(a => a.developerName).filter(Boolean).join(", ") || "—",
    },
    {
      title: "Branch",
      dataIndex: "branch",
      key: "branch",
    },
    {
      title: "Business users",
      dataIndex: "endUsers",
      key: "endUsers",
      className: "muted",
    },
    {
      title: "Acceptance",
      dataIndex: "acceptStatus",
      key: "acceptStatus",
      render: (v: string) => <ValueChip v={v} />,
    },
    {
      title: "Completed",
      dataIndex: "completedDate",
      key: "completedDate",
      className: "mono",
      render: (d: string | null) => fmtDay(d),
    },
  ];

  return (
    <>
      <div className="filters">
        <span className="muted" style={{ flex: 1 }}>
          Everything developed and completed, by project. {tasks.length} item{tasks.length === 1 ? "" : "s"} delivered.
        </span>
        <a className="btn" href="/api/export" download>
          <Download size={14} style={{ display: "inline-block", verticalAlign: "-2px", marginRight: 6 }} />
          Download Excel
        </a>
      </div>
      {!tasks.length && (
        <Empty title="Nothing delivered yet">
          Tasks moved to Completed are listed here as the delivered software register.
        </Empty>
      )}
      {groups.map(g => {
        const G = tasks.filter(t => t.projectId === g.id);
        if (!G.length) return null;
        return (
          <section key={g.id ?? "none"}>
            <div className="grouph">
              <span className="mtag" style={{ ["--mc" as string]: projectColor(g.name) }}>
                {g.name}
              </span>
              <h3>{g.full || g.name}</h3>
              <span className="muted mono">{G.length}</span>
            </div>
            <AntTable<DeliveredTask>
              dataSource={G}
              columns={deliveredColumns}
              rowKey="id"
              pagination={{ pageSize: 20, showSizeChanger: true }}
              emptyText="No delivered tasks"
            />
          </section>
        );
      })}
    </>
  );
}
