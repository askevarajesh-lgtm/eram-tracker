"use client";

import React, { useState, useTransition } from "react";
import { Check, X, AlertTriangle, CheckCircle2, User, Sparkles, Send } from "lucide-react";
import { Panel } from "@/components/ui/Panel";
import { AntCheckbox, AntTextArea, AntInput } from "@/components/ui/antd";
import { toast } from "@/components/ui/Toaster";
import { useCompose } from "@/components/shared/compose/Compose";
import { decideIssue } from "@/server/issues";
import { decideTask, decideChange } from "@/server/approvals";
import type { QueueItem, DeveloperOption } from "./types";

export type DecideModalProps = {
  q: QueueItem;
  act: "approve" | "reject";
  developers: DeveloperOption[];
  onClose: () => void;
};

export function DecideModal({ q, act, developers, onClose }: DecideModalProps) {
  const [devs, setDevs] = useState<string[]>(q.assigneeIds);
  const [devSearch, setDevSearch] = useState("");
  const [note, setNote] = useState("");
  const [convert, setConvert] = useState(true);
  const [message, setMessage] = useState(true);
  const [error, setError] = useState("");
  const [busy, start] = useTransition();
  const compose = useCompose();
  const approve = act === "approve";

  const filteredDevs = developers.filter((d) =>
    d.name.toLowerCase().includes(devSearch.toLowerCase())
  );

  const toggleDev = (id: string) => {
    setDevs((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSelectAllDevs = () => {
    setDevs(filteredDevs.map((d) => d.id));
  };

  const handleClearDevs = () => {
    setDevs([]);
  };

  const handleAction = () => {
    if (!approve && !note.trim()) {
      setError("Please provide a reason for rejecting this item.");
      return;
    }

    start(async () => {
      setError("");
      const decision = approve ? "approved" : "rejected";
      const res =
        q.kind === "issue"
          ? await decideIssue(q.id, decision, note, approve ? devs : undefined)
          : q.kind === "task"
          ? await decideTask(q.id, decision, note, approve ? devs : undefined)
          : await decideChange(q.id, decision, note, convert);

      if (!res.ok) {
        setError(res.error || "Action failed");
        return;
      }

      toast(
        approve
          ? q.kind === "change" && convert
            ? `Change request ${q.ref} approved and task created`
            : `${q.ref} has been approved`
          : `${q.ref} has been rejected`
      );

      onClose();

      if (approve && message && q.kind !== "change" && devs.length) {
        compose(
          q.kind === "task"
            ? {
                tpl: "assign",
                devIds: devs,
                item: { title: q.title, project: q.projectName || "", due: "" },
              }
            : {
                tpl: "custom",
                devIds: devs,
                subject: `${q.ref}: ${q.title}`,
                body: `Hi {name},\n\n${q.ref} is approved and assigned to you:\n${q.title}\n\n{link}`,
              }
        );
      }
    });
  };

  return (
    <Panel
      title={`${approve ? "Approve" : "Reject"}: ${q.title}`}
      subtitle={`${q.ref} · ${q.kind.toUpperCase()}`}
      onClose={onClose}
      dirty={!!note || devs.length !== q.assigneeIds.length}
      footer={({ requestClose }) => (
        <>
          <button
            className="btn"
            type="button"
            onClick={requestClose}
            disabled={busy}
            style={{ minWidth: 80 }}
          >
            Cancel
          </button>
          <button
            className={"btn " + (approve ? "primary" : "danger")}
            type="button"
            disabled={busy}
            onClick={handleAction}
            style={{
              minWidth: 100,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              ...(approve
                ? {
                    background: "linear-gradient(135deg, #0d9488 0%, #0f766e 100%)",
                    borderColor: "#0f766e",
                    color: "#ffffff",
                    boxShadow: "0 2px 8px rgba(15, 118, 110, 0.28)",
                  }
                : {}),
            }}
          >
            {approve ? <Check size={14} /> : <X size={14} />}
            {busy ? "Processing…" : approve ? "Confirm Approval" : "Confirm Rejection"}
          </button>
        </>
      )}
    >
      <form className="form" onSubmit={(e) => e.preventDefault()}>
        {/* Banner */}
        <div
          style={{
            padding: "12px 14px",
            borderRadius: 8,
            background: approve
              ? "color-mix(in srgb, var(--ok) 8%, var(--surface))"
              : "color-mix(in srgb, var(--bad) 8%, var(--surface))",
            border: `1px solid color-mix(in srgb, ${approve ? "var(--ok)" : "var(--bad)"} 25%, transparent)`,
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
          }}
        >
          <div
            style={{
              color: approve ? "var(--ok)" : "var(--bad)",
              marginTop: 1,
            }}
          >
            {approve ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.45 }}>
            <strong style={{ color: "var(--fg)", display: "block", marginBottom: 2 }}>
              {approve ? "Sign-off and developer assignment" : "Reject and notify requester"}
            </strong>
            <span style={{ color: "var(--muted)" }}>
              {approve
                ? "Approving this item clears it from the pending triage queue and authorizes the team to commence work."
                : "Rejecting this item marks its status as rejected or on-hold. A clear reason is required for the audit record."}
            </span>
          </div>
        </div>

        {/* Item Summary Card */}
        <div
          style={{
            padding: "10px 14px",
            borderRadius: 8,
            background: "var(--sunk)",
            border: "1px solid var(--line)",
            fontSize: 13,
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", color: "var(--muted)", fontSize: 11.5 }}>
            <span className="mono" style={{ fontWeight: 700, color: "var(--fg)" }}>{q.ref}</span>
            <span>{q.projectName || "General"}</span>
          </div>
          <div style={{ fontWeight: 600, color: "var(--fg)" }}>{q.title}</div>
          {q.raisedBy && (
            <div style={{ color: "var(--muted)", fontSize: 12 }}>
              Requested by: {q.raisedBy}
            </div>
          )}
        </div>

        {/* Assignee Selection (for Issues and Tasks when approving) */}
        {approve && q.kind !== "change" && (
          <div className="field full">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <label style={{ margin: 0, fontWeight: 600 }}>Assign to Developers</label>
              <div style={{ display: "flex", gap: 8, fontSize: 12 }}>
                <button
                  type="button"
                  onClick={handleSelectAllDevs}
                  style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer", padding: 0 }}
                >
                  Select all
                </button>
                <span className="muted">·</span>
                <button
                  type="button"
                  onClick={handleClearDevs}
                  style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", padding: 0 }}
                >
                  Clear
                </button>
              </div>
            </div>

            {developers.length > 8 && (
              <div style={{ marginBottom: 8 }}>
                <AntInput
                  placeholder="Filter developers…"
                  value={devSearch}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDevSearch(e.target.value)}
                  size="small"
                />
              </div>
            )}

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
                gap: 8,
                maxHeight: 180,
                overflowY: "auto",
                padding: "8px 10px",
                borderRadius: 8,
                background: "var(--surface)",
                border: "1px solid var(--line)",
              }}
            >
              {filteredDevs.map((d) => {
                const checked = devs.includes(d.id);
                return (
                  <label
                    key={d.id}
                    onClick={() => toggleDev(d.id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "6px 8px",
                      borderRadius: 6,
                      background: checked
                        ? "color-mix(in srgb, var(--accent) 10%, var(--surface))"
                        : "transparent",
                      border: `1px solid ${checked ? "var(--accent)" : "transparent"}`,
                      cursor: "pointer",
                      fontSize: 12.5,
                      color: "var(--fg)",
                      transition: "all 0.12s ease",
                    }}
                  >
                    <AntCheckbox
                      checked={checked}
                      onChange={() => {}} // handled by label click
                    />
                    <span style={{ fontWeight: checked ? 600 : 400 }}>{d.name}</span>
                  </label>
                );
              })}
              {filteredDevs.length === 0 && (
                <div className="muted" style={{ gridColumn: "1 / -1", textAlign: "center", padding: "12px 0", fontSize: 12.5 }}>
                  No developers match the filter
                </div>
              )}
            </div>
            {devs.length > 0 && (
              <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 4 }}>
                {devs.length} developer{devs.length === 1 ? "" : "s"} selected
              </div>
            )}
          </div>
        )}

        {/* Change Request to Task conversion */}
        {approve && q.kind === "change" && (
          <div
            style={{
              padding: "10px 14px",
              borderRadius: 8,
              background: "var(--sunk)",
              border: "1px solid var(--line)",
            }}
          >
            <label
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                cursor: "pointer",
                margin: 0,
              }}
            >
              <AntCheckbox
                checked={convert}
                onChange={(e) => setConvert(e.target.checked)}
                style={{ marginTop: 2 }}
              />
              <div style={{ fontSize: 13, lineHeight: 1.4 }}>
                <strong style={{ color: "var(--fg)", display: "block" }}>
                  Automatically create development task
                </strong>
                <span className="muted" style={{ fontSize: 12 }}>
                  Generates an Enhancement task under {q.projectName || "General"} with matching effort and priority.
                </span>
              </div>
            </label>
          </div>
        )}

        {/* Notes & Feedback */}
        <div className="field full">
          <label htmlFor="ap_note" style={{ fontWeight: 600 }}>
            {approve ? "Approval Note / Instructions (Optional)" : "Reason for Rejection *"}
          </label>
          <AntTextArea
            id="ap_note"
            rows={3}
            value={note}
            onChange={(e) => {
              setNote(e.target.value);
              if (error) setError("");
            }}
            placeholder={
              approve
                ? "Add optional guidance, priority instructions, or delivery notes…"
                : "Specify the reason for rejection (required for audit trail)…"
            }
            autoFocus={!approve}
          />
        </div>

        {/* Messaging Toggle */}
        {approve && q.kind !== "change" && devs.length > 0 && (
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 13,
              color: "var(--fg)",
              cursor: "pointer",
              padding: "4px 2px",
            }}
          >
            <AntCheckbox
              checked={message}
              onChange={(e) => setMessage(e.target.checked)}
            />
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              <Send size={13} style={{ color: "var(--accent)" }} />
              Send email / message notification to assigned developers
            </span>
          </label>
        )}

        {/* Error alert */}
        {error && (
          <div
            role="alert"
            style={{
              padding: "9px 12px",
              borderRadius: 6,
              background: "color-mix(in srgb, var(--bad) 10%, var(--surface))",
              border: "1px solid var(--bad)",
              color: "var(--bad)",
              fontSize: 13,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <AlertTriangle size={15} />
            <span>{error}</span>
          </div>
        )}
      </form>
    </Panel>
  );
}
