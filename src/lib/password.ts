import crypto from "node:crypto";

// Same format as the old app ("s1$salt$hash", scrypt), so migrated accounts keep their passwords.
export function hashPassword(pw: string): string {
  const salt = crypto.randomBytes(16);
  const h = crypto.scryptSync(pw, salt, 64);
  return "s1$" + salt.toString("hex") + "$" + h.toString("hex");
}

export function checkPassword(pw: string, stored: string): boolean {
  const [v, salt, hex] = String(stored).split("$");
  if (v !== "s1" || !salt || !hex) return false;
  const h = crypto.scryptSync(pw, Buffer.from(salt, "hex"), 64);
  const want = Buffer.from(hex, "hex");
  return h.length === want.length && crypto.timingSafeEqual(h, want);
}
