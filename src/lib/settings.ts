import "server-only";
import { unstable_cache } from "next/cache";
import { db } from "./db";
import { LIST_DEFAULTS, TEMPLATE_DEFAULTS, type Lists, type NotifySettings, type TemplateKey } from "./settings-defaults";

export type { NotifySettings, Lists };

// App-wide options saved in the Setting table. Keys and field names match the old app ("notify", "lists").

export const getNotifySettings = unstable_cache(
  async (): Promise<NotifySettings> => {
    const row = await db.setting.findUnique({ where: { key: "notify" } });
    const n = (row?.value ?? {}) as Record<string, any>;
    const num = (v: unknown, d: number) => (Number(v) > 0 ? Number(v) : d);
    const tpl = (n.tpl ?? {}) as Record<string, any>;
    return {
      managerName: n.managerName || "",
      managerEmail: n.managerEmail || "",
      managerWa: n.managerWa || "",
      link: n.link || process.env.APP_URL || "",
      dailyTime: n.dailyTime || "17:00",
      days: Array.isArray(n.days) ? n.days.map(Number) : [0, 1, 2, 3, 4],
      dailyOn: n.dailyOn !== false,
      overdueOn: n.overdueOn !== false,
      sla: { Urgent: num(n.slaUrgent, 4), High: num(n.slaHigh, 24), Normal: num(n.slaNormal, 72) },
      approvalPriorities: Array.isArray(n.apIss) ? n.apIss : ["Urgent", "High"],
      approveDevTasks: n.apDevTasks !== false,
      templates: Object.fromEntries(
        (Object.keys(TEMPLATE_DEFAULTS) as TemplateKey[]).map(k => [k, { ...TEMPLATE_DEFAULTS[k], ...(tpl[k] ?? {}), label: TEMPLATE_DEFAULTS[k].label }]),
      ) as NotifySettings["templates"],
    };
  },
  ["app-notify-settings"],
  { revalidate: 60, tags: ["settings"] }
);

/** Values for the dropdowns (request types, modules, branches...). */
export const getLists = unstable_cache(
  async (): Promise<Lists> => {
    const row = await db.setting.findUnique({ where: { key: "lists" } });
    const v = (row?.value ?? {}) as Record<string, unknown>;
    return Object.fromEntries(
      (Object.keys(LIST_DEFAULTS) as (keyof Lists)[]).map(k => [k, Array.isArray(v[k]) && (v[k] as unknown[]).length ? (v[k] as string[]) : LIST_DEFAULTS[k]]),
    ) as Lists;
  },
  ["app-lists"],
  { revalidate: 60, tags: ["settings", "lookups"] }
);
