export function Chip({ color, dot, children }: { color: string; dot?: boolean; children: React.ReactNode }) {
  return (
    <span className="chip" style={{ ["--c" as string]: color }}>
      {dot && <span className="dot" />}
      {children}
    </span>
  );
}
