"use client";
import React from "react";
import { AUDIENCES, daysUntil, type Audience } from "@/lib/licensing";
import { fmtDay } from "@/lib/dates";
import { projectColor } from "@/lib/constants";
import { Chip } from "@/components/ui/Chip";
import { RecordDetailModal } from "@/components/ui/RecordDetailModal";
import { Utilisation } from "@/components/shared/licences/LicenceWidgets";
import { deleteLicence } from "@/server/licences";
import { toast } from "@/components/ui/Toaster";
import type { LicencePool } from "@/server/queries";
import type { AssignRecord } from "./AssignPanel";

type Props = {
  pool: LicencePool;
  records: AssignRecord[];
  canManage: boolean;
  onEdit: () => void;
  onAssign: () => void;
  onClose: () => void;
};

function RenewalBadge({ day }: { day: string }) {
  const n = daysUntil(day);
  if (n == null) return <span className="muted">—</span>;
  const color = n < 0 ? "var(--bad)" : n <= 60 ? "var(--warn)" : "var(--fg)";
  return (
    <span style={{ whiteSpace: "nowrap" }}>
      <span className="mono" style={{ color, fontWeight: n <= 60 ? 600 : undefined }}>
        {fmtDay(day)}
      </span>{" "}
      {n < 0 ? <Chip color="var(--bad)">Expired</Chip> : n <= 60 ? <Chip color="var(--warn)">{n} days</Chip> : null}
    </span>
  );
}

export function LicenceDetailModal({ pool, records, canManage, onEdit, onAssign, onClose }: Props) {
  const avail = pool.quantity - pool.assigned;
  const holders = records.filter(r => pool.holderIds.includes(r.id));

  const handleDelete = async () => {
    const r = await deleteLicence(pool.id);
    if (!r.ok) {
      toast(r.error ?? "Failed to delete licence");
      return;
    }
    toast(`Licence deleted${r.data?.released ? ` and released from ${r.data.released} people` : ""}`);
  };

  return (
    <RecordDetailModal
      title={`${pool.software} — ${pool.type}`}
      subtitle={`Model: ${pool.model || "Perpetual"}${pool.contract ? ` · Contract: ${pool.contract}` : ""}`}
      badges={
        <>
          {pool.audience && (
            <Chip color={pool.audience === "endusers" ? "var(--accent)" : "var(--lms)"}>
              {AUDIENCES[pool.audience as Audience] ?? pool.audience}
            </Chip>
          )}
          {pool.projectName && <Chip color={projectColor(pool.projectName)}>{pool.projectName}</Chip>}
          <Chip color="var(--muted)">{pool.companyName || "Group-wide"}</Chip>
          {avail < 0 ? (
            <Chip color="var(--bad)">Over-assigned ({Math.abs(avail)})</Chip>
          ) : (
            <Chip color="var(--ok)">{avail} available</Chip>
          )}
        </>
      }
      onClose={onClose}
      onEdit={canManage ? onEdit : undefined}
      onDelete={canManage ? handleDelete : undefined}
      canEdit={canManage}
      canDelete={canManage}
      deleteConfirmTitle={`Delete ${pool.software} (${pool.type}) licence?`}
      deleteConfirmMessage={
        pool.assigned > 0
          ? `Are you sure you want to delete this ${pool.software} (${pool.type}) licence? It is currently assigned to ${pool.assigned} ${pool.assigned === 1 ? "person" : "people"}. Deleting it will release their licence assignments.`
          : `Are you sure you want to delete this ${pool.software} (${pool.type}) licence? This action cannot be undone.`
      }
      extraFooter={
        canManage ? (
          <button className="btn primary" type="button" onClick={onAssign}>
            Assign holders ({pool.assigned})
          </button>
        ) : undefined
      }
      sections={[
        {
          title: "Licence Overview & Allocation",
          items: [
            { label: "Software", value: pool.software },
            { label: "Licence Type", value: pool.type },
            { label: "Audience", value: AUDIENCES[pool.audience as Audience] ?? pool.audience },
            { label: "Company Scope", value: pool.companyName || "Group-wide (shared)" },
            { label: "Linked System", value: pool.projectName || "None" },
            { label: "Quantity Purchased", value: String(pool.quantity) },
            { label: "Currently Assigned", value: String(pool.assigned) },
            {
              label: "Available",
              value: <span style={avail < 0 ? { color: "var(--bad)", fontWeight: 700 } : undefined}>{avail}</span>,
            },
            {
              label: "Utilisation",
              value: <Utilisation assigned={pool.assigned} total={pool.quantity} />,
            },
          ],
        },
        {
          title: "Commercial & Renewal Details",
          items: [
            { label: "Licence Model", value: pool.model || "Perpetual" },
            { label: "Vendor / Supplier", value: pool.vendor || "—" },
            { label: "Contract Reference", value: pool.contract || "—" },
            { label: "Renewal / Expiry", value: <RenewalBadge day={pool.renewal} /> },
            {
              label: "Annual Cost",
              value: pool.cost ? `${Number(pool.cost).toLocaleString()} ${pool.currency || "SAR"}` : "—",
            },
          ],
        },
        ...(pool.notes
          ? [
              {
                title: "Notes & Terms",
                items: [{ label: "Notes", value: pool.notes, full: true }],
              },
            ]
          : []),
      ]}
    >
      <div className="record-detail-section" style={{ marginTop: 20 }}>
        <div className="record-detail-section-header">
          <h4 className="record-detail-section-title">Current Holders</h4>
          <span className="record-detail-section-count">
            {holders.length} {holders.length === 1 ? "holder" : "holders"}
          </span>
          <div className="record-detail-section-line" />
        </div>
        {holders.length === 0 ? (
          <p className="muted" style={{ margin: "10px 0", fontSize: 13 }}>
            No users currently assigned to this licence. Use the "Assign holders" button to allocate seats.
          </p>
        ) : (
          <div style={{ maxHeight: 220, overflowY: "auto", marginTop: 8 }}>
            <table className="record-detail-table" style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)", textAlign: "left", color: "var(--muted)" }}>
                  <th style={{ padding: "6px 8px" }}>Name</th>
                  <th style={{ padding: "6px 8px" }}>Email</th>
                  <th style={{ padding: "6px 8px" }}>Company / Branch</th>
                  <th style={{ padding: "6px 8px" }}>Department</th>
                  <th style={{ padding: "6px 8px" }}>User Type</th>
                </tr>
              </thead>
              <tbody>
                {holders.map(h => (
                  <tr key={h.id} style={{ borderBottom: "1px solid var(--border-subtle, rgba(255,255,255,0.06))" }}>
                    <td style={{ padding: "6px 8px", fontWeight: 500 }}>{h.name}</td>
                    <td style={{ padding: "6px 8px" }} className="mono muted">
                      {h.email || "—"}
                    </td>
                    <td style={{ padding: "6px 8px" }}>
                      {h.companyName || "—"}
                      {h.branch ? ` (${h.branch})` : ""}
                    </td>
                    <td style={{ padding: "6px 8px" }} className="muted">
                      {h.dept || "—"}
                    </td>
                    <td style={{ padding: "6px 8px" }}>
                      <Chip color={h.userType === "Developer" ? "var(--accent)" : "var(--info)"}>
                        {h.userType || "User"}
                      </Chip>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </RecordDetailModal>
  );
}
