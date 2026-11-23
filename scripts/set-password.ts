/**
 * Set (or reset) an account's password from the command line.
 *   npm run set-password -- someone@eramhcm.com "new password"
 */
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password";

async function main() {
  const [email, pw] = process.argv.slice(2);
  if (!email || !pw) throw new Error('Usage: npm run set-password -- <email> "<new password>"');
  if (pw.length < 8) throw new Error("Use a password of at least 8 characters.");
  const db = new PrismaClient();
  try {
    const acc = await db.account.findUnique({ where: { email: email.trim().toLowerCase() } });
    if (!acc) throw new Error(`No account with email ${email}.`);
    await db.account.update({ where: { id: acc.id }, data: { passwordHash: hashPassword(pw), active: true } });
    console.log(`Password updated for ${acc.email}.`);
  } finally {
    await db.$disconnect();
  }
}
main().catch(e => { console.error(e.message); process.exit(1); });
