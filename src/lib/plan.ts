import { today } from "./dates";

// Milestone status colours and the "Missed" rule, shared by Plan & control and Reports.
export const MILESTONE_COLOR: Record<string, string> = { Planned: "var(--hold)", "On track": "var(--info)", "At risk": "var(--warn)", Done: "var(--ok)", Missed: "var(--bad)" };
export const milestoneStatus = (m: { status: string; target: string }) => (m.status === "Done" ? "Done" : m.target && m.target < today() ? "Missed" : m.status || "Planned");
