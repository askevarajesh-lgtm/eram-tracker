"use client";
import { PRIORITIES, TASK_STATUSES } from "@/lib/constants";
import type { Lookups } from "@/server/queries";
import { UrlFilters } from "@/components/ui/UrlFilters";

export function TaskFilters({ lookups }: { lookups: Lookups }) {
  return (
    <UrlFilters
      search={{ placeholder: "Search tasks or S.No…" }}
      selects={[
        { key: "project", all: "All projects", options: [...lookups.projects.map(p => [p.id, p.name] as [string, string]), ["_none", "No project"]] },
        { key: "status", all: "All statuses", options: TASK_STATUSES.map(s => [s.key, s.label]) },
        { key: "dev", all: "All developers", options: [...lookups.developers.map(d => [d.id, d.name] as [string, string]), ["_none", "Unassigned"]] },
        { key: "priority", all: "All priorities", options: [...PRIORITIES.map(p => [p, p] as [string, string]), ["_none", "No priority"]] },
      ]}
    />
  );
}
