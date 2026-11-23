import type { AutoData, ReminderDTO } from "@/server/reminders-data";
import type { TemplateKey } from "@/lib/settings-defaults";

const nowHM = () => {
  const d = new Date();
  return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
};

const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const isDue = (r: ReminderDTO) =>
  !r.done &&
  !!r.date &&
  (r.date < localToday() || (r.date === localToday() && (r.time || "00:00") <= nowHM()));

export type AutoReminder = {
  key: string;
  title: string;
  sub: string;
  color: string;
  tpl?: TemplateKey;
  devIds?: string[];
  meetingId?: string;
};

/** Reminders that come from the settings (daily updates, overdue items) and from meetings starting soon. Uses local time. */
export function autoReminders(a: AutoData): AutoReminder[] {
  const out: AutoReminder[] = [];
  const now = Date.now();
  for (const m of a.meetings) {
    const st = new Date(`${m.date}T${m.startTime || "09:00"}:00`).getTime();
    if (st > now - 15 * 6e4 && st - now <= m.remindMinutes * 6e4) {
      out.push({
        key: "meet:" + m.id,
        title: `${m.type || "Meeting"} ${st < now ? "started" : "at " + m.startTime}: ${m.title}`,
        sub: `${m.attendees} attendees · ${m.mode}`,
        color: "var(--accent)",
        meetingId: m.id,
      });
    }
  }
  if (a.dailyOn && a.days.includes(new Date().getDay()) && nowHM() >= a.dailyTime && a.missingUpdates.length) {
    out.push({
      key: "daily",
      title: `${a.missingUpdates.length} developer${a.missingUpdates.length === 1 ? "" : "s"} haven't sent today's update`,
      sub: a.missingUpdates.map(d => d.name).join(", ") + ` · due ${a.dailyTime}`,
      color: "var(--warn)",
      tpl: "daily",
      devIds: a.missingUpdates.map(d => d.id),
    });
  }
  if (a.overdueOn && a.overdue.length) {
    out.push({
      key: "overdue",
      title: `Overdue items for ${a.overdue.length} developer${a.overdue.length === 1 ? "" : "s"}`,
      sub: a.overdue.map(o => `${o.name} (${o.n})`).join(", "),
      color: "var(--bad)",
      tpl: "overdue",
      devIds: a.overdue.map(o => o.id),
    });
  }
  return out;
}
