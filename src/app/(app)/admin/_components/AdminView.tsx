"use client";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import {
  Building2,
  Globe2,
  Users,
  KeyRound,
  UserCheck,
  CheckCircle2,
  CalendarClock,
  Code2,
  ArrowUpRight,
} from "lucide-react";
import { AntTable, type ColumnsType } from "@/components/ui/antd";
import type { LicencePool } from "@/server/queries";
import { deleteCompany, saveCompany } from "@/server/companies";
import { projectColor } from "@/lib/constants";
import { fmtDay } from "@/lib/dates";
import { AItem, Empty } from "@/components/ui/bits";
import { EntityEditor, type FieldDef } from "@/components/ui/EntityEditor";
import { Summary, Utilisation } from "@/components/shared/licences/LicenceWidgets";
import { CompanyBarChart, LicenceDonutChart, TrendLineChart, type TrendPoint } from "./AdminCharts";
import "./admin-dashboard.css";

type Company = { id: string; name: string; country: string; code: string; sapDb: string; branches: string[]; notes: string; holding: boolean; parentId: string; users: number; licencesHeld: number; access: Record<string, number>; devItems: number };
export type AdminData = {
  asOf: string;
  kpis: { companies: number; countries: number; activeUsers: number; purchased: number; assigned: number; available: number; renewals: number; openDev: number };
  trend: TrendPoint[];
  pools: LicencePool[];
  holding: { id: string; name: string } | null;
  companies: Company[];
  projects: { id: string; name: string }[];
  attention: { color: string; title: string; sub: string; href: string }[];
};

function KpiCard({
  label,
  value,
  sub,
  icon,
  href,
  color = "var(--accent)",
  bg = "var(--accent-soft)",
  bad = false,
}: {
  label: string;
  value: number;
  sub: string;
  icon: ReactNode;
  href?: string;
  color?: string;
  bg?: string;
  bad?: boolean;
}) {
  const content = (
    <>
      <div className="adm-kpi-top">
        <span className="adm-kpi-label">{label}</span>
        <span className="adm-kpi-icon" style={{ ["--kpi-c" as string]: color, ["--kpi-bg" as string]: bg }}>
          {icon}
        </span>
      </div>
      <div className="adm-kpi-mid">
        <span className="adm-kpi-val">{value}</span>
        {href && <ArrowUpRight size={15} style={{ color: "var(--muted)" }} />}
      </div>
      <div className="adm-kpi-sub">
        <span>{sub}</span>
      </div>
    </>
  );
  const style = { ["--kpi-c" as string]: bad ? "var(--bad)" : color, ["--kpi-bg" as string]: bad ? "rgba(211,47,47,0.12)" : bg };
  if (href) {
    return (
      <Link href={href} className={`adm-kpi-card${bad ? " is-bad" : ""}`} style={style}>
        {content}
      </Link>
    );
  }
  return (
    <div className={`adm-kpi-card${bad ? " is-bad" : ""}`} style={style}>
      {content}
    </div>
  );
}

export function AdminView({ data, canManage }: { data: AdminData; canManage: boolean }) {
  const [edit, setEdit] = useState<Company | "new" | null>(null);
  const { kpis } = data;
  const subs = data.companies.filter(c => !c.holding);
  const software = [...new Set(data.pools.map(p => p.software))];
  const maxB = Math.max(1, ...subs.map(c => c.branches.length));
  const cur = edit && edit !== "new" ? edit : null;

  return (
    <>
      <div className="adm-head">
        <p className="adm-eyebrow">
          <span className="adm-eyebrow-dot" />
          Group administration · as of {fmtDay(data.asOf)}
        </p>
      </div>

      <div className="adm-kpi-grid">
        <KpiCard label="Group companies" value={kpis.companies} sub="Active subsidiaries" icon={<Building2 size={17} />} />
        <KpiCard label="Countries" value={kpis.countries} sub="Operating regions" icon={<Globe2 size={17} />} color="var(--info)" bg="rgba(37,99,235,0.12)" />
        <KpiCard label="Active business users" value={kpis.activeUsers} sub="View users & access" icon={<Users size={17} />} href="/users" />
        <KpiCard label="Licences purchased" value={kpis.purchased} sub="Total seat capacity" icon={<KeyRound size={17} />} href="/licences" color="var(--info)" bg="rgba(37,99,235,0.12)" />
        <KpiCard label="Licences assigned" value={kpis.assigned} sub="Currently allocated" icon={<UserCheck size={17} />} color="var(--ok)" bg="rgba(21,146,74,0.12)" />
        <KpiCard label="Licences available" value={kpis.available} sub={kpis.available < 0 ? "Over-allocated" : "Ready to assign"} icon={<CheckCircle2 size={17} />} bad={kpis.available < 0} color="var(--ok)" bg="rgba(21,146,74,0.12)" />
        <KpiCard label="Renewals ≤ 60 days" value={kpis.renewals} sub={kpis.renewals > 0 ? "Action required" : "All up to date"} icon={<CalendarClock size={17} />} bad={kpis.renewals > 0} color="var(--warn)" bg="rgba(199,116,8,0.12)" />
        <KpiCard label="Open dev items" value={kpis.openDev} sub="View task board" icon={<Code2 size={17} />} href="/tasks" color="var(--lms)" bg="rgba(109,85,196,0.12)" />
      </div>

      <div className="adm-charts-grid">
        <TrendLineChart data={data.trend} />
        <LicenceDonutChart purchased={kpis.purchased} assigned={kpis.assigned} available={kpis.available} renewals={kpis.renewals} />
      </div>

      <CompanyBarChart companies={subs} />

      <div className="grouph" style={{ marginTop: 28 }}>
        <h2 className="sec" style={{ margin: 0, flex: 1 }}>Licence position <span className="muted" style={{ font: "500 12px var(--body)" }}>business-user licences count business users only</span></h2>
        <Link className="btn" href="/licences">Manage licences</Link>
      </div>
      {!software.length ? <Empty title="No licences recorded" action={<Link className="btn primary" href="/licences?new=1">+ Add licence</Link>}>Add the licences you own for SAP B1 and other software.</Empty> : (
        <div className="two" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,420px),1fr))" }}>
          {software.map(sw => {
            const list = data.pools.filter(p => p.software === sw);
            const proj = list.find(p => p.projectId);
            return (
              <div key={sw} style={{ minWidth: 0 }}>
                <div className="grouph" style={{ margin: "0 0 8px" }}>
                  <span className="mtag" style={{ ["--mc" as string]: proj ? projectColor(proj.projectName) : "var(--other)" }}>{sw}</span>
                  <div style={{ flex: 1 }}><Utilisation assigned={list.reduce((a, p) => a + p.assigned, 0)} total={list.reduce((a, p) => a + p.quantity, 0)} /></div>
                </div>
                <Summary pools={list} />
              </div>
            );
          })}
        </div>
      )}

      <div className="grouph" style={{ marginTop: 28 }}>
        <h2 className="sec" style={{ margin: 0, flex: 1 }}>Group companies &amp; branches</h2>
        {canManage && <button className="btn primary" type="button" onClick={() => setEdit("new")}>+ Add company</button>}
      </div>
      {data.holding && (
        <div className="banner" style={{ marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <span><b>{data.holding.name}</b> is the holding company: {subs.length} companies in {kpis.countries} countries.</span>
          {canManage && <button className="btn" type="button" onClick={() => setEdit(data.companies.find(c => c.id === data.holding!.id)!)}>Edit holding</button>}
        </div>
      )}
      {(() => {
        const companyColumns: ColumnsType<Company> = [
          {
            title: "Country",
            dataIndex: "country",
            key: "country",
            render: (country: string, c: Company, ix: number) =>
              ix === 0 || subs[ix - 1]?.country !== country ? <b>{country || "—"}</b> : <span className="muted">{country}</span>,
          },
          {
            title: "Company",
            dataIndex: "name",
            key: "name",
            render: (name: string, c: Company) => (
              <>
                <b style={{ fontWeight: 600 }}>{name}</b>
                {c.code && <> <span className="mono muted" style={{ fontSize: 11 }}>{c.code}</span></>}
              </>
            ),
          },
          ...Array.from({ length: maxB }, (_, i) => ({
            title: `Branch-${i + 1}`,
            key: `branch-${i}`,
            render: (_: unknown, c: Company) => c.branches[i] ?? "",
          })),
          {
            title: "People",
            dataIndex: "users",
            key: "users",
            align: "right" as const,
            className: "num",
            render: (users: number, c: Company) =>
              users ? <Link href={`/users?comp=${c.id}`} className="adm-badge-num">{users}</Link> : <span className="muted">0</span>,
          },
          {
            title: "Licences held",
            dataIndex: "licencesHeld",
            key: "licencesHeld",
            align: "right" as const,
            className: "num",
            render: (licencesHeld: number) => licencesHeld ? <span className="adm-badge-num">{licencesHeld}</span> : <span className="muted">0</span>,
          },
          ...data.projects.map(p => ({
            title: <span className="mtag" style={{ ["--mc" as string]: projectColor(p.name) }}>{p.name}</span>,
            key: p.id,
            align: "right" as const,
            className: "num",
            render: (_: unknown, c: Company) => c.access[p.id] || <span className="muted">·</span>,
          })),
          {
            title: "Open dev items",
            dataIndex: "devItems",
            key: "devItems",
            align: "right" as const,
            className: "num",
            render: (devItems: number) => devItems ? <span className="adm-badge-num adm-badge-warn">{devItems}</span> : <span className="muted">0</span>,
          },
          ...(canManage
            ? [
                {
                  title: "",
                  key: "action",
                  align: "right" as const,
                  render: (_: unknown, c: Company) => (
                    <button className="btn" type="button" onClick={() => setEdit(c)}>
                      Edit
                    </button>
                  ),
                },
              ]
            : []),
        ];

        return (
          <div className="adm-table-card">
            <AntTable<Company>
              dataSource={subs}
              columns={companyColumns}
              rowKey="id"
              pagination={false}
              emptyTitle="No companies yet"
              emptyDescription="Add each group company with its country and branches."
              emptyAction={canManage ? <button className="btn primary" type="button" onClick={() => setEdit("new")}>+ Add company</button> : undefined}
            />
          </div>
        );
      })()}

      <h2 className="sec">Needs attention</h2>
      {!data.attention.length ? <Empty title="Nothing flagged">Over-allocated licences, renewals, inactive people and data mismatches appear here.</Empty> : (
        <div className="alist">{data.attention.map((a, i) => <AItem key={i} color={a.color} href={a.href} title={<span style={{ whiteSpace: "normal" }}>{a.title}</span>} sub={a.sub} right={<span className="muted" aria-hidden="true">›</span>} />)}</div>
      )}

      {edit && (
        <CompanyEditor key={cur?.id ?? "new"} company={cur} companies={data.companies} onClose={() => setEdit(null)} />
      )}
    </>
  );
}

function CompanyEditor({ company, companies, onClose }: { company: Company | null; companies: Company[]; onClose: () => void }) {
  const holdings = companies.filter(c => c.holding && c.id !== company?.id);
  const fields: FieldDef<Record<string, string>>[] = [
    { key: "name", label: "Company", required: true },
    { key: "country", label: "Country", list: [...new Set(companies.map(c => c.country))] },
    { key: "code", label: "Short code", placeholder: "Used in reports, e.g. ECL" },
    { key: "sapDb", label: "SAP B1 company database", placeholder: "Optional" },
    { key: "holding", label: "Holding company", type: "select", options: [["no", "No"], ["yes", "Yes, this is the holding company"]] },
    { key: "parentId", label: "Part of", type: "select", options: holdings.map(c => [c.id, c.name]), empty: "—" },
    { key: "branches", label: "Branches / divisions (comma separated)", full: true, placeholder: "MPD, SMP, Trading, Floor" },
    { key: "notes", label: "Notes", type: "textarea" },
  ];
  return (
    <EntityEditor title={company ? "Edit company" : "Add company"} isNew={!company} fields={fields} onClose={onClose}
      initial={{ name: company?.name ?? "", country: company?.country ?? "", code: company?.code ?? "", sapDb: company?.sapDb ?? "", holding: company?.holding ? "yes" : "no", parentId: company?.parentId || (company?.holding ? "" : holdings[0]?.id ?? ""), branches: company?.branches.join(", ") ?? "", notes: company?.notes ?? "" }}
      onSave={v => saveCompany({ ...v, id: company?.id, holding: v.holding === "yes" })}
      onDelete={company ? () => deleteCompany(company.id) : undefined}
      deleteLabel={company ? `Delete ${company.name}? Tasks, people and licences linked to it stay, without a company.` : undefined} />
  );
}
