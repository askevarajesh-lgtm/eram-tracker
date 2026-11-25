import { addDays, initials } from "@/lib/work";
import type { CalEvent, Dev, Rec, MeetingDTO } from "./CalendarTypes";

export const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];

export const HOUR_HEIGHT = 64; // height of each hour slot in px

export const formatHour = (h: number) => {
  const period = h >= 12 ? "pm" : "am";
  const num = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${num} ${period}`;
};

/**
 * Returns 7 days of the week starting from Monday of the selected day's week.
 */
export function getWeekDays(selectedDay: string): string[] {
  const d = new Date(selectedDay + "T00:00:00Z");
  // JS getUTCDay(): 0 = Sun, 1 = Mon, ..., 6 = Sat
  // Monday start: 0 = Mon, 6 = Sun
  const dayOfWeek = (d.getUTCDay() + 6) % 7;
  const monday = addDays(selectedDay, -dayOfWeek);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

export function formatTimeRange(startTime?: string, endTime?: string): string {
  if (!startTime) return "";
  const fmt = (t: string) => {
    const [hStr, mStr] = t.split(":");
    let h = parseInt(hStr, 10);
    const m = mStr || "00";
    if (isNaN(h)) return t;
    const ampm = h >= 12 ? "pm" : "am";
    h = h % 12 || 12;
    return `${h}:${m} ${ampm}`;
  };
  return endTime ? `${fmt(startTime)} – ${fmt(endTime)}` : fmt(startTime);
}

/**
 * Parses "HH:mm" into a float hour offset from startHour (e.g. 8 am).
 */
export function getEventPosition(
  startTime?: string,
  endTime?: string,
  startHour = 8
) {
  if (!startTime) return { top: 0, height: HOUR_HEIGHT };
  const [sh, sm] = startTime.split(":").map(Number);
  const startDec = (sh || 0) + (sm || 0) / 60;
  
  let endDec = startDec + 1; // default 1 hour
  if (endTime) {
    const [eh, em] = endTime.split(":").map(Number);
    const candidate = (eh || 0) + (em || 0) / 60;
    if (candidate > startDec) endDec = candidate;
  }

  const top = Math.max(0, (startDec - startHour) * HOUR_HEIGHT);
  const duration = Math.max(0.5, endDec - startDec);
  const height = Math.max(38, duration * HOUR_HEIGHT);

  return { top, height };
}

/**
 * Pastel theme classes corresponding to reference design
 */
export function getEventTheme(e: CalEvent): string {
  if (e.status === "Cancelled") return "cal-theme-slate";
  if (e.kind === "due") return "cal-theme-sky";
  if (e.kind === "rem") return "cal-theme-amber";
  if (e.kind === "live") return "cal-theme-mint";

  // Meetings by meetingType
  const ty = (e.meetingType || "").toLowerCase();
  if (ty.includes("discussion") || ty.includes("user")) return "cal-theme-lavender";
  if (ty.includes("demo") || ty.includes("sap")) return "cal-theme-amber";
  if (ty.includes("training") || ty.includes("go-live")) return "cal-theme-mint";
  if (ty.includes("uat")) return "cal-theme-rose";
  if (ty.includes("review")) return "cal-theme-sky";
  
  // Deterministic fallback based on title length
  const palettes = [
    "cal-theme-lavender",
    "cal-theme-sky",
    "cal-theme-mint",
    "cal-theme-amber",
    "cal-theme-rose",
  ];
  const idx = Math.abs(e.title.charCodeAt(0) + (e.title.charCodeAt(1) || 0)) % palettes.length;
  return palettes[idx];
}

const AVATAR_PALETTE = [
  "#3b82f6", // blue
  "#10b981", // emerald
  "#8b5cf6", // violet
  "#f59e0b", // amber
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#14b8a6", // teal
  "#6366f1", // indigo
];

export function getAvatarColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
  }
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}

export function getAttendees(
  developerIds: string[] = [],
  inviteeRecordIds: string[] = [],
  guests = "",
  developers: Dev[] = [],
  records: Rec[] = []
) {
  const devs = developers
    .filter((d) => developerIds.includes(d.id))
    .map((d) => ({
      id: d.id,
      name: d.name,
      email: d.email,
      initials: initials(d.name),
      color: getAvatarColor(d.name),
      type: "Developer" as const,
    }));

  const recs = records
    .filter((r) => inviteeRecordIds.includes(r.id))
    .map((r) => ({
      id: "u:" + r.id,
      name: r.name,
      email: r.email,
      initials: initials(r.name),
      color: getAvatarColor(r.name),
      type: "User" as const,
    }));

  const guestList = guests
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((g) => {
      const name = g.includes("@") ? g.split("@")[0] : g;
      return {
        id: "g:" + g,
        name,
        email: g.includes("@") ? g : "",
        initials: initials(name),
        color: getAvatarColor(name),
        type: "Guest" as const,
      };
    });

  return [...devs, ...recs, ...guestList];
}

export function icsDownload(
  m: MeetingDTO,
  attendees: { name: string; email: string }[]
) {
  const esc = (s: string) =>
    String(s || "")
      .replace(/[\\;,]/g, (c) => "\\" + c)
      .replace(/\n/g, "\\n");
  const local = (d: string, t: string) => new Date(`${d}T${t || "09:00"}:00`);
  const stamp = (d: Date) =>
    d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const start = local(m.date, m.startTime);
  let end = local(m.date, m.endTime || m.startTime || "10:00");
  if (end <= start) end = new Date(start.getTime() + 3600e3);
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ERAM HCM Business Tools//EN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${m.id}@eram-hcm-tools`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${esc(m.title)}`,
    `LOCATION:${esc([m.mode, m.location].filter(Boolean).join(" · "))}`,
    `DESCRIPTION:${esc((m.agenda || "") + (origin ? "\n\n" + origin : ""))}`,
    ...attendees
      .filter((a) => a.email)
      .map((a) => `ATTENDEE;CN=${esc(a.name)}:mailto:${a.email}`),
    ...(m.remindMinutes
      ? [
          "BEGIN:VALARM",
          "ACTION:DISPLAY",
          "DESCRIPTION:Reminder",
          `TRIGGER:-PT${m.remindMinutes}M`,
          "END:VALARM",
        ]
      : []),
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  if (typeof document === "undefined") return;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
  a.download = `${m.title.replace(/[^\w\- ]+/g, "").slice(0, 40) || "meeting"}.ics`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

