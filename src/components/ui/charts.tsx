// Small SVG charts (ported from the old Reports page). Rendered on the server; no chart library needed.

type Series = { name: string; color: string; values: number[] };

const AXIS = { fontSize: 10, fill: "var(--muted)", fontFamily: "var(--mono)" } as const;

/** Grouped (or stacked) bars per label. */
export function Bars({ labels, series, height = 170, stacked = false }: { labels: string[]; series: Series[]; height?: number; stacked?: boolean }) {
  const h = height, W = Math.max(520, labels.length * 56), pad = 28, bw = (W - pad) / Math.max(1, labels.length);
  const tot = labels.map((_, k) => (stacked ? series.reduce((a, s) => a + (s.values[k] || 0), 0) : Math.max(0, ...series.map(s => s.values[k] || 0))));
  const mx = Math.max(1, ...tot);
  const step = mx > 10 ? 5 : 1;
  const nice = Math.ceil(mx / step) * step;
  const grid = nice >= 4 ? [0, 0.5, 1] : [0, 1];
  return (
    <>
      <div style={{ overflowX: "auto" }}>
        <svg viewBox={`0 0 ${W} ${h + 30}`} style={{ width: "100%", minWidth: Math.min(W, 520), display: "block" }} role="img" aria-label={series.map(s => s.name).join(", ")}>
          {grid.map(t => (
            <g key={t}>
              <line x1={pad} x2={W} y1={h - t * h + 6} y2={h - t * h + 6} stroke="var(--line)" />
              <text x={pad - 6} y={h - t * h + 10} textAnchor="end" {...AXIS}>{Math.round(nice * t)}</text>
            </g>
          ))}
          {labels.map((l, k) => {
            const x = pad + k * bw;
            let y = h + 6;
            return (
              <g key={k}>
                {stacked
                  ? series.map(s => {
                      const v = s.values[k] || 0, hh = (v / nice) * h;
                      if (!v) return null;
                      y -= hh;
                      return <rect key={s.name} x={x + bw * 0.2} y={y} width={bw * 0.6} height={hh} rx={2} fill={s.color}><title>{`${l} · ${s.name}: ${v}`}</title></rect>;
                    })
                  : series.map((s, j) => {
                      const v = s.values[k] || 0, hh = (v / nice) * h, w = (bw * 0.7) / series.length, xx = x + bw * 0.15 + j * w;
                      return (
                        <g key={s.name}>
                          <rect x={xx} y={h + 6 - hh} width={Math.max(1, w - 2)} height={hh} rx={2} fill={s.color}><title>{`${l} · ${s.name}: ${v}`}</title></rect>
                          {v > 0 && <text x={xx + w / 2 - 1} y={h + 2 - hh} textAnchor="middle" fontSize={10} fill="var(--fg)" fontFamily="var(--mono)">{v}</text>}
                        </g>
                      );
                    })}
                {stacked && tot[k] > 0 && <text x={x + bw / 2} y={y - 4} textAnchor="middle" fontSize={10.5} fontWeight={700} fill="var(--fg)" fontFamily="var(--mono)">{tot[k]}</text>}
                <text x={x + bw / 2} y={h + 22} textAnchor="middle" {...AXIS}>{l}</text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="legend" style={{ marginTop: 6 }}>
        {series.map(s => <span key={s.name}><i className="dot" style={{ background: s.color }} />{s.name}</span>)}
      </div>
    </>
  );
}

/** A single line with a soft area under it. */
export function Line({ labels, values, color = "var(--accent)", height = 150 }: { labels: string[]; values: number[]; color?: string; height?: number }) {
  const h = height, W = Math.max(520, labels.length * 56), pad = 28, bw = (W - pad) / Math.max(1, labels.length), mx = Math.max(1, ...values);
  const pt = (v: number, k: number): [number, number] => [pad + k * bw + bw / 2, h + 6 - (v / mx) * h * 0.92];
  const pts = values.map(pt);
  const last = pts[pts.length - 1];
  return (
    <div style={{ overflowX: "auto" }}>
      <svg viewBox={`0 0 ${W} ${h + 30}`} style={{ width: "100%", minWidth: 520, display: "block" }} role="img">
        {(mx >= 4 ? [0, 0.5, 1] : [0, 1]).map(t => (
          <g key={t}>
            <line x1={pad} x2={W} y1={h - t * h * 0.92 + 6} y2={h - t * h * 0.92 + 6} stroke="var(--line)" />
            <text x={pad - 6} y={h - t * h * 0.92 + 10} textAnchor="end" {...AXIS}>{Math.round(mx * t)}</text>
          </g>
        ))}
        {pts.length > 0 && (
          <>
            <polygon points={`${pad + bw / 2},${h + 6} ${pts.map(p => p.join(",")).join(" ")} ${last[0]},${h + 6}`} fill={`color-mix(in srgb,${color} 12%,transparent)`} />
            <polyline fill="none" stroke={color} strokeWidth={2.2} points={pts.map(p => p.join(",")).join(" ")} />
            {pts.map((p, k) => <circle key={k} cx={p[0]} cy={p[1]} r={k === pts.length - 1 ? 4.5 : 2.5} fill={color}><title>{`${labels[k]}: ${values[k]}`}</title></circle>)}
            <text x={last[0]} y={last[1] - 10} textAnchor="end" fontSize={11} fontWeight={700} fill={color} fontFamily="var(--mono)">{values[values.length - 1]}</text>
          </>
        )}
        {labels.map((l, k) => <text key={k} x={pad + k * bw + bw / 2} y={h + 22} textAnchor="middle" {...AXIS}>{l}</text>)}
      </svg>
    </div>
  );
}
