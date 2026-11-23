// Date-only values are stored as UTC midnight (Postgres DATE). These helpers convert to and from
// the "YYYY-MM-DD" strings used by <input type="date">.

export const toDay = (s: string | null | undefined): Date | null => {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null;
};

export const dayStr = (d: Date | null | undefined): string => (d ? d.toISOString().slice(0, 10) : "");

export const today = () => new Date().toISOString().slice(0, 10);

export const fmtDay = (d: Date | string | null | undefined) => {
  const s = typeof d === "string" ? d : dayStr(d);
  if (!s) return "";
  const [y, m, dd] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, dd)).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
};
