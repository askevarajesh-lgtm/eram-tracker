"use server";
// Sign-in accounts: the IT team who use the tracker. (Developers are a separate list; an account can
// optionally be linked to the person's developer record.)
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireViewer } from "@/lib/session";
import { isAdmin } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { fail, type ActionResult } from "@/lib/action";
import { checkPassword, hashPassword } from "@/lib/password";

const DENIED = "Only admins can manage accounts.";
const password = z.string().min(8, "Use a password of at least 8 characters.");
const done = () => revalidatePath("/", "layout");

const createInput = z.object({
  name: z.string().trim().min(1, "Enter a name."),
  email: z.string().trim().toLowerCase().email("Enter a valid email."),
  password,
  role: z.enum(["Admin", "Viewer"]).default("Admin"),
  developerId: z.string().default(""),
});
export type CreateAccountInput = z.input<typeof createInput>;

const linkError = (e: unknown) =>
  e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002"
    ? (e.meta?.target as string[] | undefined)?.includes("email") ? "An account with this email already exists." : "That developer is already linked to another account."
    : null;

export async function createAccount(raw: CreateAccountInput): Promise<ActionResult<{ id: string }>> {
  const viewer = await requireViewer();
  if (!isAdmin(viewer)) return fail(DENIED);
  const p = createInput.safeParse(raw);
  if (!p.success) return fail(p.error.issues[0].message);
  const f = p.data;
  try {
    const acc = await db.$transaction(async tx => {
      const a = await tx.account.create({ data: { name: f.name, email: f.email, passwordHash: hashPassword(f.password), role: f.role, developerId: f.developerId || null } });
      await audit(tx, viewer, "create", "account", a.id, `${a.name} (${a.email})`);
      return a;
    });
    done();
    return { ok: true, data: { id: acc.id } };
  } catch (e) {
    const msg = linkError(e);
    if (msg) return fail(msg);
    throw e;
  }
}

const updateInput = z.object({
  id: z.string(),
  name: z.string().trim().min(1, "Enter a name."),
  role: z.enum(["Admin", "Viewer"]),
  developerId: z.string().default(""),
  active: z.boolean(),
  /** set a new temporary password; empty = keep the current one */
  password: password.or(z.literal("")).default(""),
});
export type UpdateAccountInput = z.input<typeof updateInput>;

export async function updateAccount(raw: UpdateAccountInput): Promise<ActionResult> {
  const viewer = await requireViewer();
  if (!isAdmin(viewer)) return fail(DENIED);
  const p = updateInput.safeParse(raw);
  if (!p.success) return fail(p.error.issues[0].message);
  const f = p.data;
  const acc = await db.account.findUnique({ where: { id: f.id } });
  if (!acc) return fail("This account no longer exists.");
  if (acc.isOwner && (!f.active || f.role !== "Admin")) return fail("The owner account always stays an active Admin.");
  if (acc.id === viewer.id && (!f.active || f.role !== "Admin")) return fail("You can't remove your own admin access or suspend yourself.");
  if (acc.role === "Admin" && (f.role !== "Admin" || !f.active)) {
    const admins = await db.account.count({ where: { role: "Admin", active: true, NOT: { id: acc.id } } });
    if (!admins) return fail("At least one active Admin is needed.");
  }
  try {
    await db.$transaction(async tx => {
      await tx.account.update({
        where: { id: f.id },
        data: { name: f.name, role: f.role, active: f.active, developerId: f.developerId || null, ...(f.password ? { passwordHash: hashPassword(f.password) } : {}) },
      });
      const what = [f.password && "password reset", acc.active !== f.active && (f.active ? "reactivated" : "suspended"), acc.role !== f.role && `role ${f.role}`].filter(Boolean).join(", ");
      await audit(tx, viewer, "update", "account", f.id, `${f.name}${what ? ": " + what : ""}`);
    });
  } catch (e) {
    const msg = linkError(e);
    if (msg) return fail(msg);
    throw e;
  }
  done();
  return { ok: true };
}

/** Any signed-in person changes their own password. */
export async function changeOwnPassword(current: string, next: string): Promise<ActionResult> {
  const viewer = await requireViewer();
  const acc = await db.account.findUnique({ where: { id: viewer.id } });
  if (!acc || !checkPassword(current, acc.passwordHash)) return fail("Current password is incorrect.");
  const p = password.safeParse(next);
  if (!p.success) return fail(p.error.issues[0].message);
  await db.$transaction(async tx => {
    await tx.account.update({ where: { id: acc.id }, data: { passwordHash: hashPassword(next) } });
    await audit(tx, viewer, "update", "account", acc.id, "Changed own password");
  });
  return { ok: true };
}
