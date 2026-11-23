/** What every server action returns: data on success, or a message to show the user. */
export type ActionResult<T = unknown> = { ok: true; data?: T } | { ok: false; error: string };

export const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });
