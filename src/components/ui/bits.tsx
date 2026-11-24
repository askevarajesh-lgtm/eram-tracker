import Link from "next/link";
import type { TaskStatus } from "@prisma/client";
import { TASK_STATUSES, STATUS_MAP } from "@/lib/constants";
import { Chip } from "./Chip";

/** Coloured bar showing how many tasks are in each status. */
export function SegBar({ statuses, height = 8 }: { statuses: TaskStatus[]; height?: number }) {
  const n = statuses.length || 1;
  return (
    <div className="segbar" style={{ height }}>
      {TASK_STATUSES.map(s => {
        const c = statuses.filter(x => x === s.key).length;
        return c ? <i key={s.key} style={{ width: (c / n) * 100 + "%", background: s.color }} title={`${s.label}: ${c}`} /> : null;
      })}
    </div>
  );
}

export const StatusChip = ({ status }: { status: TaskStatus }) => <Chip color={STATUS_MAP[status].color} dot>{STATUS_MAP[status].label}</Chip>;

const VALUE_COLOR: Record<string, string> = { Completed: "var(--ok)", Accepted: "var(--ok)", Ongoing: "var(--warn)", "Partially completed": "var(--warn)", Pending: "var(--warn)", Open: "var(--hold)", Live: "var(--ok)" };
/** Chip for testing / acceptance / requirement values; a dash when empty. */
export const ValueChip = ({ v }: { v: string }) => (v ? <Chip color={VALUE_COLOR[v] ?? "var(--info)"}>{v}</Chip> : <span className="muted">—</span>);

export function Empty({ title, children, action }: { title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return <div className="empty"><b>{title}</b>{children}{action && <div>{action}</div>}</div>;
}

/** A row in an "alist": coloured stripe, title, subtitle, and something on the right. */
export function AItem({ color, title, sub, right, href, onClick }: { color: string; title: React.ReactNode; sub?: React.ReactNode; right?: React.ReactNode; href?: string; onClick?: () => void }) {
  const inner = (
    <>
      <span className="stripe" />
      <div style={{ minWidth: 0 }}>
        <div className="t">{title}</div>
        {sub && <div className="s">{sub}</div>}
      </div>
      {right ?? <span />}
    </>
  );
  const style = { ["--c" as string]: color, textDecoration: "none", color: "inherit" };
  if (href) return <Link className="aitem" href={href} style={style}>{inner}</Link>;
  return <div className="aitem" style={{ ...style, cursor: onClick ? "pointer" : "default" }} onClick={onClick}>{inner}</div>;
}

/** Tab-like segmented links that set a query parameter. */
export function SegLinks({ items, current, param, base }: { items: [string, React.ReactNode][]; current: string; param: string; base: string }) {
  return (
    <span className="seg" role="tablist">
      {items.map(([k, l]) => (
        <Link key={k} href={`${base}?${param}=${encodeURIComponent(k)}`} role="tab" aria-pressed={current === k}>
          {l}
        </Link>
      ))}
    </span>
  );
}

/** A titled card box. */
export function Card({ title, extra, children }: { title: React.ReactNode; extra?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="tablewrap" style={{ padding: "16px 18px" }}>
      <div className="grouph" style={{ margin: "0 0 10px" }}><h3 style={{ flex: 1 }}>{title}</h3>{extra}</div>
      {children}
    </div>
  );
}
