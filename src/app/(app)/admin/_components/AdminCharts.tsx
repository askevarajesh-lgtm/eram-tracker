"use client";
import { useState } from "react";

export type TrendPoint = {
  month: string;
  opened: number;
  completed: number;
};

export function TrendLineChart({ data }: { data: TrendPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const w = 520;
  const h = 190;
  const padL = 32;
  const padR = 16;
  const padT = 16;
  const padB = 28;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;

  const maxVal = Math.max(4, ...data.flatMap(d => [d.opened, d.completed]));
  const stepX = data.length > 1 ? innerW / (data.length - 1) : innerW;

  const pts = data.map((d, i) => ({
    x: padL + i * stepX,
    yOpen: padT + innerH - (d.opened / maxVal) * innerH,
    yDone: padT + innerH - (d.completed / maxVal) * innerH,
    ...d,
  }));

  const linePath = (key: "yOpen" | "yDone") =>
    pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p[key].toFixed(1)}`).join(" ");

  const areaPath = (key: "yOpen" | "yDone") =>
    pts.length
      ? `${linePath(key)} L ${pts[pts.length - 1].x.toFixed(1)} ${(padT + innerH).toFixed(1)} L ${pts[0].x.toFixed(1)} ${(padT + innerH).toFixed(1)} Z`
      : "";

  const ticks = [0, 0.5, 1].map(t => Math.round(maxVal * t));

  return (
    <div className="adm-card">
      <div className="adm-card-head">
        <div>
          <h3 className="adm-card-title">Dev items &amp; delivery trend</h3>
          <p className="adm-card-sub">6-month created vs completed items</p>
        </div>
        <div className="adm-legend">
          <span className="adm-legend-item">
            <span className="adm-legend-dot" style={{ background: "var(--accent)" }} />
            Completed
          </span>
          <span className="adm-legend-item">
            <span className="adm-legend-dot" style={{ background: "var(--info)" }} />
            Created
          </span>
        </div>
      </div>

      <div style={{ position: "relative", width: "100%" }}>
        <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: "auto", display: "block", overflow: "visible" }}>
          <defs>
            <linearGradient id="admGradDone" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.28" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.02" />
            </linearGradient>
            <linearGradient id="admGradOpen" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--info)" stopOpacity="0.22" />
              <stop offset="100%" stopColor="var(--info)" stopOpacity="0.01" />
            </linearGradient>
          </defs>

          {ticks.map((val, idx) => {
            const y = padT + innerH - (val / maxVal) * innerH;
            return (
              <g key={idx}>
                <line x1={padL} y1={y} x2={w - padR} y2={y} stroke="var(--line)" strokeDasharray="3 3" />
                <text x={padL - 8} y={y + 4} textAnchor="end" fontSize="10" fill="var(--muted)">
                  {val}
                </text>
              </g>
            );
          })}

          {pts.length > 1 && (
            <>
              <path d={areaPath("yOpen")} fill="url(#admGradOpen)" />
              <path d={areaPath("yDone")} fill="url(#admGradDone)" />
              <path d={linePath("yOpen")} fill="none" stroke="var(--info)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
              <path d={linePath("yDone")} fill="none" stroke="var(--accent)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
            </>
          )}

          {pts.map((p, i) => (
            <g
              key={p.month}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              style={{ cursor: "pointer" }}
            >
              <rect x={p.x - 18} y={padT} width={36} height={innerH + 20} fill="transparent" />
              {hover === i && (
                <line x1={p.x} y1={padT} x2={p.x} y2={padT + innerH} stroke="var(--line2)" strokeWidth="1" />
              )}
              <circle cx={p.x} cy={p.yOpen} r={hover === i ? 5 : 3.5} fill="var(--surface)" stroke="var(--info)" strokeWidth="2.2" />
              <circle cx={p.x} cy={p.yDone} r={hover === i ? 5.5 : 3.8} fill="var(--surface)" stroke="var(--accent)" strokeWidth="2.4" />
              <text x={p.x} y={h - 6} textAnchor="middle" fontSize="10.5" fontWeight={hover === i ? 700 : 500} fill={hover === i ? "var(--fg)" : "var(--muted)"}>
                {p.month}
              </text>
            </g>
          ))}
        </svg>

        {hover !== null && pts[hover] && (
          <div
            style={{
              position: "absolute",
              top: 6,
              right: 8,
              background: "var(--surface)",
              border: "1px solid var(--line2)",
              borderRadius: 8,
              padding: "6px 10px",
              fontSize: 11.5,
              boxShadow: "var(--sh)",
              pointerEvents: "none",
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 2 }}>{pts[hover].month}</div>
            <div style={{ color: "var(--accent)" }}>Completed: <b>{pts[hover].completed}</b></div>
            <div style={{ color: "var(--info)" }}>Created: <b>{pts[hover].opened}</b></div>
          </div>
        )}
      </div>
    </div>
  );
}

export function LicenceDonutChart({
  purchased,
  assigned,
  available,
  renewals,
}: {
  purchased: number;
  assigned: number;
  available: number;
  renewals: number;
}) {
  const pct = purchased > 0 ? Math.min(100, Math.round((assigned / purchased) * 100)) : 0;
  const r = 52;
  const c = 2 * Math.PI * r;
  const dash = (pct / 100) * c;

  return (
    <div className="adm-card">
      <div className="adm-card-head">
        <div>
          <h3 className="adm-card-title">Licence utilisation</h3>
          <p className="adm-card-sub">Seat allocation across all pools</p>
        </div>
        <span className="adm-kpi-pill">{pct}% used</span>
      </div>

      <div className="adm-donut-wrap">
        <svg width="136" height="136" viewBox="0 0 136 136" style={{ flexShrink: 0 }}>
          <circle cx="68" cy="68" r={r} fill="none" stroke="var(--sunk)" strokeWidth="14" />
          <circle
            cx="68"
            cy="68"
            r={r}
            fill="none"
            stroke={available < 0 ? "var(--bad)" : "var(--accent)"}
            strokeWidth="14"
            strokeDasharray={`${dash} ${c}`}
            strokeLinecap="round"
            transform="rotate(-90 68 68)"
          />
          <text x="68" y="65" textAnchor="middle" fontSize="22" fontWeight="700" fill="var(--fg)">
            {pct}%
          </text>
          <text x="68" y="83" textAnchor="middle" fontSize="10.5" fill="var(--muted)">
            {assigned}/{purchased} seats
          </text>
        </svg>

        <div className="adm-donut-stats">
          <div className="adm-stat-row">
            <span className="adm-legend-item">
              <span className="adm-legend-dot" style={{ background: "var(--accent)" }} />
              Assigned seats
            </span>
            <strong>{assigned}</strong>
          </div>
          <div className="adm-stat-row">
            <span className="adm-legend-item">
              <span className="adm-legend-dot" style={{ background: available < 0 ? "var(--bad)" : "var(--ok)" }} />
              Available headroom
            </span>
            <strong style={{ color: available < 0 ? "var(--bad)" : undefined }}>{available}</strong>
          </div>
          <div className="adm-stat-row">
            <span className="adm-legend-item">
              <span className="adm-legend-dot" style={{ background: renewals > 0 ? "var(--warn)" : "var(--muted)" }} />
              Renewals ≤ 60d
            </span>
            <strong style={{ color: renewals > 0 ? "var(--warn)" : undefined }}>{renewals}</strong>
          </div>
        </div>
      </div>
    </div>
  );
}

export function CompanyBarChart({
  companies,
}: {
  companies: { id: string; name: string; users: number; licencesHeld: number; devItems: number }[];
}) {
  const top = companies.slice(0, 6);
  const maxVal = Math.max(1, ...top.flatMap(c => [c.users, c.licencesHeld, c.devItems]));

  return (
    <div className="adm-card" style={{ marginTop: 16 }}>
      <div className="adm-card-head">
        <div>
          <h3 className="adm-card-title">Company footprint</h3>
          <p className="adm-card-sub">People, licences held, and open dev items by company</p>
        </div>
        <div className="adm-legend">
          <span className="adm-legend-item"><span className="adm-legend-dot" style={{ background: "var(--accent)" }} />People</span>
          <span className="adm-legend-item"><span className="adm-legend-dot" style={{ background: "var(--info)" }} />Licences</span>
          <span className="adm-legend-item"><span className="adm-legend-dot" style={{ background: "var(--warn)" }} />Open dev</span>
        </div>
      </div>

      {!top.length ? (
        <p className="muted" style={{ fontSize: 13, margin: 0 }}>No subsidiary companies recorded yet.</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${top.length}, minmax(70px, 1fr))`, gap: 14, alignItems: "end", paddingTop: 10 }}>
          {top.map(c => (
            <div key={c.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 5, height: 96 }}>
                {[
                  { val: c.users, color: "var(--accent)", label: "People" },
                  { val: c.licencesHeld, color: "var(--info)", label: "Licences" },
                  { val: c.devItems, color: "var(--warn)", label: "Open dev" },
                ].map((bar, idx) => {
                  const barH = Math.max(bar.val > 0 ? 8 : 3, Math.round((bar.val / maxVal) * 88));
                  return (
                    <div
                      key={idx}
                      title={`${c.name} · ${bar.label}: ${bar.val}`}
                      style={{
                        width: 12,
                        height: barH,
                        borderRadius: "4px 4px 2px 2px",
                        background: bar.val > 0 ? bar.color : "var(--line)",
                        transition: "height 0.2s ease",
                      }}
                    />
                  );
                })}
              </div>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--fg)", textAlign: "center", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>
                {c.name}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
