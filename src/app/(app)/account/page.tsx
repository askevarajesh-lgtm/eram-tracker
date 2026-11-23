import type { Metadata } from "next";
import { requireViewer } from "@/lib/session";
import { db } from "@/lib/db";
import { ChangePassword } from "./_components/ChangePassword";

export const metadata: Metadata = { title: "My account" };

export default async function MyAccountPage() {
  const viewer = await requireViewer();
  const dev = viewer.developerId ? await db.developer.findUnique({ where: { id: viewer.developerId }, select: { name: true } }) : null;
  return (
    <div style={{ maxWidth: 520 }}>
      <div className="tablewrap" style={{ padding: "16px 18px", marginBottom: 20 }}>
        <div style={{ fontWeight: 600, fontSize: 16 }}>{viewer.name}</div>
        <div className="muted">{viewer.email}</div>
        <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>
          Role: {viewer.role}{dev ? ` · Developer record: ${dev.name}` : ""}
        </div>
      </div>
      <ChangePassword />
    </div>
  );
}
