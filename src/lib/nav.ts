import { PAGES, type PageKey } from "./pages";

export type NavItem = { key: PageKey; href: string; label: string; adminOnly?: boolean; managerOnly?: boolean; ready: boolean };

// Route for each page. `ready` = rebuilt in Next.js (all pages now); used to decide link prefetching.
const href = (k: PageKey) => (k === "home" ? "/" : k === "modules" ? "/projects" : k === "panel" ? "/admin-panel" : "/" + k);
const item = (key: PageKey, ready = false, extra: Partial<NavItem> = {}): NavItem => ({
  key, href: href(key), label: key === "home" ? "Development stats" : PAGES[key].title, ready, ...extra,
});

export const NAV: { group: string; items: NavItem[] }[] = [
  { group: "Overview", items: [item("home", true), item("approvals", true, { managerOnly: true }), item("issues", true), item("calendar", true), item("reminders", true), item("chat", true), item("admin", true), item("daily", true)] },
  { group: "Delivery", items: [item("overview", true), item("tasks", true), item("workload", true), item("uat", true), item("plan", true), item("reports", true), item("delivered", true), item("manuals", true)] },
  { group: "People & access", items: [item("developers", true), item("users", true), item("licences", true)] },
  { group: "Setup", items: [item("modules", true), item("health", true, { managerOnly: true }), item("accounts", true, { adminOnly: true }), item("panel", true, { adminOnly: true })] },
];

export const ALL_NAV = NAV.flatMap(g => g.items);
export const navByHref = (path: string) => ALL_NAV.find(n => n.href === path) ?? ALL_NAV.find(n => n.href !== "/" && path.startsWith(n.href + "/"));
