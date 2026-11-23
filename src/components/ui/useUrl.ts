"use client";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useTransition } from "react";

/**
 * Change query-string values without a full reload. Always starts from the live URL (not a
 * render-time snapshot), so two quick updates (e.g. a debounced search and closing a panel)
 * never undo each other.
 */
export function useUrlUpdate() {
  const router = useRouter();
  const path = usePathname();
  const [pending, start] = useTransition();
  const update = useCallback(
    (changes: Record<string, string | null | undefined>) => {
      const next = new URLSearchParams(window.location.search);
      for (const [k, v] of Object.entries(changes)) {
        if (v) next.set(k, v); else next.delete(k);
      }
      const qs = next.toString();
      start(() => router.replace(`${path}${qs ? "?" + qs : ""}`, { scroll: false }));
    },
    [router, path],
  );
  return { update, pending };
}
