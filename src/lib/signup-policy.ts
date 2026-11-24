import "server-only";
import { db } from "./db";

// ALLOWED_EMAIL_DOMAIN may list several domains: "eramengineering.com, eramhcm.com"
export const allowedDomains = () =>
  (process.env.ALLOWED_EMAIL_DOMAIN || "").split(/[,\s;]+/).map(d => d.trim().toLowerCase().replace(/^@/, "")).filter(Boolean);

export async function signupPolicy() {
  const n = await db.account.count();
  return {
    hasAccounts: n > 0,
    open: n === 0,
    domain: null,
  };
}

