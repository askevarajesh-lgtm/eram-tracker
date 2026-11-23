"use client";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Input } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import { AntSelect } from "@/components/ui/antd";
import { useUrlUpdate } from "./useUrl";

export type FilterSelect = {
  key: string;
  /** label of the "no filter" choice, e.g. "All projects" */
  all: string;
  options: [value: string, label: string][];
};

type Props = {
  search?: { placeholder: string; key?: string };
  selects: FilterSelect[];
  /** extra buttons shown at the end of the row */
  children?: React.ReactNode;
};

/** Filter bar whose values live in the URL, so a filtered view can be bookmarked or shared. */
export function UrlFilters({ search, selects, children }: Props) {
  const sp = useSearchParams();
  const { update, pending } = useUrlUpdate();
  const qKey = search?.key ?? "q";
  const [q, setQ] = useState(sp.get(qKey) ?? "");

  // search as you type, after a short pause
  useEffect(() => {
    if (!search || q.trim() === (sp.get(qKey) ?? "")) return;
    const t = setTimeout(() => update({ [qKey]: q.trim() }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const keys = [...(search ? [qKey] : []), ...selects.map(s => s.key)];
  const any = keys.some(k => sp.get(k));
  return (
    <div className="filters" style={{ opacity: pending ? 0.6 : 1 }}>
      {search && (
        <Input
          prefix={<SearchOutlined style={{ color: "var(--muted)" }} />}
          placeholder={search.placeholder}
          value={q}
          onChange={e => setQ(e.target.value)}
          allowClear
          aria-label={search.placeholder}
          style={{ flex: "1 1 200px", minWidth: 200 }}
        />
      )}
      {selects.map(s => (
        <AntSelect
          key={s.key}
          aria-label={s.all}
          value={sp.get(s.key) ?? ""}
          empty={s.all}
          options={s.options}
          onChange={e => update({ [s.key]: e.target.value })}
          style={{ width: "auto", minWidth: 150 }}
        />
      ))}
      {any && <button className="btn" type="button" onClick={() => { setQ(""); update(Object.fromEntries(keys.map(k => [k, null]))); }}>Clear</button>}
      {children}
    </div>
  );
}
