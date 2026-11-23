"use client";
import Link from "next/link";
import { useState } from "react";
import { AntTable, type ColumnsType } from "@/components/ui/antd";
import { EntityEditor, type FieldDef } from "@/components/ui/EntityEditor";
import { deleteDeveloper, saveDeveloper } from "@/server/developers";

type Row = { id: string; name: string; title: string; email: string; whatsapp: string; skills: string; account: string; open: number; done: number };
type Form = { name: string; title: string; email: string; whatsapp: string; skills: string };

const FIELDS: FieldDef<Form>[] = [
  { key: "name", label: "Name", required: true },
  { key: "title", label: "Role", placeholder: "SAP B1 Developer" },
  { key: "email", label: "Email", type: "email" },
  { key: "whatsapp", label: "WhatsApp", placeholder: "+974…" },
  { key: "skills", label: "Skills", type: "textarea", placeholder: "SAP B1 SDK, SQL, Crystal Reports…" },
];

export function DevelopersView({ rows, canManage }: { rows: Row[]; canManage: boolean }) {
  const [open, setOpen] = useState<Row | "new" | null>(null);
  const cur = open && open !== "new" ? open : null;

  return (
    <>
      {canManage && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
          <button className="btn primary" type="button" onClick={() => setOpen("new")}>+ Add developer</button>
        </div>
      )}
      {(() => {
        const columns: ColumnsType<Row> = [
          {
            title: "Name",
            dataIndex: "name",
            key: "name",
            render: (name: string, r: Row) => (
              <div>
                <b>{name}</b>
                {r.skills && <div className="muted" style={{ fontSize: 12 }}>{r.skills}</div>}
              </div>
            ),
          },
          {
            title: "Role",
            dataIndex: "title",
            key: "title",
          },
          {
            title: "Contact",
            key: "contact",
            className: "muted",
            render: (_: unknown, r: Row) => [r.email, r.whatsapp].filter(Boolean).join(" · ") || "—",
          },
          {
            title: "Sign-in account",
            dataIndex: "account",
            key: "account",
            className: "muted",
            render: (account?: string) => account || "—",
          },
          {
            title: "Open tasks",
            dataIndex: "open",
            key: "open",
            className: "num",
            align: "right",
            render: (open: number, r: Row) => (
              <Link href={`/tasks?dev=${r.id}`} onClick={e => e.stopPropagation()}>{open}</Link>
            ),
          },
          {
            title: "Completed",
            dataIndex: "done",
            key: "done",
            className: "num",
            align: "right",
          },
        ];

        return (
          <AntTable<Row>
            dataSource={rows}
            columns={columns}
            rowKey="id"
            onRowClick={canManage ? r => setOpen(r) : undefined}
            emptyTitle="No developers yet"
            emptyDescription="Add the people who build and maintain the software."
            emptyAction={canManage ? <button className="btn primary" type="button" onClick={() => setOpen("new")}>+ Add developer</button> : undefined}
          />
        );
      })()}
      {open && (
        <EntityEditor<Form>
          key={cur?.id ?? "new"}
          title={cur ? "Edit developer" : "New developer"}
          isNew={!cur}
          fields={FIELDS}
          initial={{ name: cur?.name ?? "", title: cur?.title ?? "", email: cur?.email ?? "", whatsapp: cur?.whatsapp ?? "", skills: cur?.skills ?? "" }}
          onSave={v => saveDeveloper({ ...v, id: cur?.id })}
          onDelete={cur ? () => deleteDeveloper(cur.id) : undefined}
          deleteLabel={cur ? `Remove ${cur.name}?` : undefined}
          onClose={() => setOpen(null)}
        />
      )}
    </>
  );
}
