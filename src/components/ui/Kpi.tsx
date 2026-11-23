import Link from "next/link";

/** A number tile. Turns red when `bad`; clickable when given an href. */
export function Kpi({ n, label, bad, href }: { n: number | string; label: string; bad?: boolean; href?: string }) {
  const body = (<><div className="n">{n}</div><div className="l">{label}</div></>);
  const cls = "kpi" + (bad ? " bad" : "");
  return href
    ? <Link href={href} className={cls} style={{ color: "inherit", textDecoration: "none" }}>{body}</Link>
    : <div className={cls}>{body}</div>;
}
