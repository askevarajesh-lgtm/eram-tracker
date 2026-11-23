import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireViewer } from "@/lib/session";
import { isAdmin } from "@/lib/permissions";
import { AccountsView } from "./_components/AccountsView";

export const metadata: Metadata = { title: "Sign-in accounts" };

export default async function AccountsPage() {
  const viewer = await requireViewer();
  if (!isAdmin(viewer)) redirect("/");
  const [accounts, developers] = await Promise.all([
    db.account.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }], include: { developer: { select: { id: true, name: true } } } }),
    db.developer.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, title: true, account: { select: { id: true } } } }),
  ]);
  return (
    <AccountsView
      meId={viewer.id}
      accounts={accounts.map(a => ({
        id: a.id, name: a.name, email: a.email, role: a.role, active: a.active, isOwner: a.isOwner,
        developerId: a.developerId ?? "", developerName: a.developer?.name ?? "", createdAt: a.createdAt.toISOString(),
      }))}
      developers={developers.map(d => ({ id: d.id, name: d.name, title: d.title, accountId: d.account?.id ?? "" }))}
    />
  );
}
