"use client";
import type { LicencePool } from "@/server/queries";
import { AntTable, type ColumnsType } from "@/components/ui/antd";

export function Utilisation({ assigned, total }: { assigned: number; total: number }) {
  const pct = total ? Math.min(100, Math.round((assigned / total) * 100)) : assigned ? 100 : 0;
  const color = assigned > total ? "var(--bad)" : pct >= 90 ? "var(--warn)" : "var(--accent)";
  return (
    <div className="progress">
      <div className="bar"><i style={{ width: pct + "%", background: color }} /></div>
      <span className="mono" style={{ fontSize: 12 }}>{total ? Math.round((assigned / total) * 100) : 0}%</span>
    </div>
  );
}

/** Purchased / assigned / available per licence type, for one software. */
export function Summary({ pools }: { pools: LicencePool[] }) {
  const types = [...new Set(pools.map(p => p.type))];
  const sum = (f: (p: LicencePool) => number) => types.map(t => pools.filter(p => p.type === t).reduce((a, p) => a + f(p), 0));
  const P = sum(p => p.quantity), A = sum(p => p.assigned), V = P.map((n, i) => n - A[i]);
  const total = (a: number[]) => a.reduce((x, y) => x + y, 0);

  type SummaryRow = {
    key: string;
    label: string;
    values: number[];
    total: number;
    avail?: boolean;
  };

  const dataSource: SummaryRow[] = [
    { key: "purchased", label: "Purchased", values: P, total: total(P) },
    { key: "assigned", label: "Assigned", values: A, total: total(A) },
    { key: "available", label: "Available", values: V, total: total(V), avail: true },
  ];

  const columns: ColumnsType<SummaryRow> = [
    {
      title: "Pool",
      dataIndex: "label",
      key: "label",
      width: 140,
      render: (label: string) => <b style={{ fontWeight: 600 }}>{label}</b>,
    },
    ...types.map((t, idx) => ({
      title: t,
      key: t,
      align: "right" as const,
      render: (_: any, r: SummaryRow) => {
        const n = r.values[idx];
        return (
          <span style={r.avail && n < 0 ? { color: "var(--bad)", fontWeight: 600 } : undefined}>
            {n}
          </span>
        );
      },
    })),
    {
      title: "Total",
      dataIndex: "total",
      key: "total",
      align: "right",
      render: (tot: number) => (
        <b style={{ background: "color-mix(in srgb,var(--sap) 16%,transparent)", padding: "2px 6px", borderRadius: 4 }}>
          {tot}
        </b>
      ),
    },
  ];

  return (
    <div className="tablewrap" style={{ margin: "8px 0 0" }}>
      <AntTable
        dataSource={dataSource}
        columns={columns}
        rowKey="key"
        pagination={false}
        size="small"
        emptyText="No licence pools"
      />
    </div>
  );
}
