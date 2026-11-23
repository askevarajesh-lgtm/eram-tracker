"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { checkPassword, hashPassword } from "@/lib/password";
import { endSession, startSession } from "@/lib/session";
import { allowedDomains } from "@/lib/signup-policy";

export type AuthState = { error?: string } | undefined;

// simple in-memory throttle: 10 failed sign-ins per 15 minutes per IP + email
const attempts = new Map<string, { n: number; t: number }>();
const WINDOW = 15 * 60e3;

const safeNext = (v: FormDataEntryValue | null) => {
  const s = String(v || "/");
  return /^\/(?!\/)/.test(s) ? s : "/";
};

const loginSchema = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1) });

export async function login(_: AuthState, form: FormData): Promise<AuthState> {
  const parsed = loginSchema.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { error: "Enter your email and password." };
  const { email, password } = parsed.data;
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const key = ip + "|" + email;
  const a = attempts.get(key);
  if (a && Date.now() - a.t < WINDOW && a.n >= 10) return { error: "Too many attempts. Try again in 15 minutes." };

  const acc = await db.account.findUnique({ where: { email } });
  if (!acc || !checkPassword(password, acc.passwordHash)) {
    const cur = a && Date.now() - a.t < WINDOW ? a : { n: 0, t: Date.now() };
    attempts.set(key, { n: cur.n + 1, t: cur.t });
    return { error: "Email or password is incorrect." };
  }
  if (!acc.active) return { error: "This account is suspended. Ask an admin." };
  attempts.delete(key);
  await startSession(acc.id);
  redirect(safeNext(form.get("next")));
}

const signupSchema = z.object({
  name: z.string().trim().min(1, "Enter your name."),
  email: z.string().trim().toLowerCase().email("Enter a valid email."),
  password: z.string().min(8, "Use a password of at least 8 characters."),
});

export async function signup(_: AuthState, form: FormData): Promise<AuthState> {
  const parsed = signupSchema.safeParse({ name: form.get("name"), email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { name, email, password } = parsed.data;
  const n = await db.account.count();
  const doms = allowedDomains();
  const allowed = n === 0 || (doms.length ? doms.some(d => email.endsWith("@" + d)) : String(process.env.ALLOW_SIGNUP || "").toLowerCase() === "true");
  if (!allowed) return { error: "Sign-up is closed. Ask an admin to create your account." };
  if (await db.account.findUnique({ where: { email } })) return { error: "An account with this email already exists. Sign in instead." };
  const acc = await db.account.create({
    data: { name, email, passwordHash: hashPassword(password), isOwner: n === 0, role: n === 0 ? "Admin" : "Viewer" },
  });
  await startSession(acc.id);
  redirect(safeNext(form.get("next")));
}

export async function logout() {
  await endSession();
  redirect("/login");
}
