/**
 * Creates the sign-in accounts listed in seed/accounts.json that don't exist yet.
 * Password: SEED_PASSWORD from .env, or a random one printed here (change it after first sign-in).
 *   npm run db:seed
 * To load project data into an empty database, use the migration script instead:
 *   npm run migrate:legacy -- --json seed/eram-hcm-2026-10-26.json
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { PrismaClient, type Role } from "@prisma/client";
import { hashPassword } from "../src/lib/password";

const ROLES: Role[] = ["Admin", "Manager", "Developer", "Viewer"];

async function main() {
  const file = path.join(process.cwd(), "seed", "accounts.json");
  if (!fs.existsSync(file)) { console.log("No seed/accounts.json, nothing to do."); return; }
  const list: any[] = JSON.parse(fs.readFileSync(file, "utf8"));
  const db = new PrismaClient();
  try {
    let hasOwner = (await db.account.count({ where: { isOwner: true } })) > 0;
    for (const a of list) {
      const email = String(a.email || "").trim().toLowerCase();
      if (!email || !a.name || (await db.account.findUnique({ where: { email } }))) continue;
      const password = a.password || process.env.SEED_PASSWORD || crypto.randomBytes(9).toString("base64url");
      const dev = a.developer ? await db.developer.findFirst({ where: { name: { equals: String(a.developer), mode: "insensitive" }, account: null } }) : null;
      const isOwner = !hasOwner && !!a.owner;
      if (isOwner) hasOwner = true;
      await db.account.create({
        data: { email, name: String(a.name).trim(), passwordHash: hashPassword(password), isOwner, role: ROLES.includes(a.role) ? a.role : "Admin", developerId: dev?.id ?? null },
      });
      const shown = a.password || process.env.SEED_PASSWORD ? "(from accounts.json / SEED_PASSWORD)" : `${password}  (generated, change after first sign-in)`;
      console.log(`Created ${email} · ${isOwner ? "owner" : a.role || "Admin"} · password: ${shown}`);
    }
  } finally {
    await db.$disconnect();
  }
}
main().catch(e => { console.error(e.message); process.exit(1); });
