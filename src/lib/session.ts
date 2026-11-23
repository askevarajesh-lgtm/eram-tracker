import "server-only";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { Role } from "@prisma/client";
import { db } from "./db";

// Same cookie name and token format as the old app, so people stay signed in after the switch.
export const SESSION_COOKIE = "d360_session";
const SESSION_DAYS = 30;

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("SESSION_SECRET is not set. Set it to a long random string.");
    }
    return "dev-only-secret-change-me";
  }
  return secret;
}

const sign = (s: string) => crypto.createHmac("sha256", getSecret()).update(s).digest("base64url");

export function makeToken(uid: string): string {
  const body = Buffer.from(JSON.stringify({ uid, exp: Date.now() + SESSION_DAYS * 864e5 })).toString("base64url");
  return body + "." + sign(body);
}

export function readToken(t: string | undefined): string | null {
  if (!t) return null;
  const [body, sig] = t.split(".");
  if (!body || !sig) return null;
  const good = sign(body);
  if (sig.length !== good.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good))) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString());
    return p.exp > Date.now() ? String(p.uid) : null;
  } catch {
    return null;
  }
}

export async function startSession(uid: string) {
  (await cookies()).set(SESSION_COOKIE, makeToken(uid), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 86400,
  });
}

export async function endSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

// Each account's own role is used (almost everyone is Admin). OPEN_ACCESS=true makes every account an Admin,
// like the old app's POC mode; it's off by default.
export const OPEN_ACCESS = String(process.env.OPEN_ACCESS ?? "false").toLowerCase() === "true";

export type Viewer = {
  id: string;
  name: string;
  email: string;
  isOwner: boolean;
  role: Role;
  developerId: string | null;
};

/** The signed-in account, or null. Cached for the length of one request. */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const uid = readToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (!uid) return null;
  const a = await db.account.findUnique({ where: { id: uid } });
  if (!a || !a.active) return null;
  return {
    id: a.id,
    name: a.name,
    email: a.email,
    isOwner: a.isOwner,
    role: a.isOwner || OPEN_ACCESS ? "Admin" : a.role,
    developerId: a.developerId,
  };
});

/** Use in pages and layouts: sends the visitor to /login when signed out. */
export async function requireViewer(): Promise<Viewer> {
  const v = await getViewer();
  if (!v) redirect("/login");
  return v;
}
