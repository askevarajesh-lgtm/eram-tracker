export const MEETING_TYPES: [string, string][] = [
  ["Meeting", "var(--accent)"],
  ["Discussion", "var(--info)"],
  ["User requirement session", "var(--lms)"],
  ["Demo", "var(--sap)"],
  ["UAT session", "var(--warn)"],
  ["Training", "var(--ok)"],
  ["Review", "var(--crm)"],
];

export const meetingColor = (t: string) =>
  MEETING_TYPES.find(x => x[0] === t)?.[1] ?? "var(--accent)";
