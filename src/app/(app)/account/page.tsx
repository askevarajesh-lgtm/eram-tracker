import type { Metadata } from "next";
import { requireViewer } from "@/lib/session";
import { db } from "@/lib/db";
import { ProfileView, type ProfileData } from "./_components/ProfileView";

export const metadata: Metadata = { title: "My account" };

function formatDate(d: Date | null | undefined): string {
  if (!d) return "Active member";
  try {
    return new Intl.DateTimeFormat("en-US", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(d));
  } catch {
    return "Active member";
  }
}

export default async function MyAccountPage() {
  const viewer = await requireViewer();
  const acc = await db.account.findUnique({
    where: { id: viewer.id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isOwner: true,
      active: true,
      createdAt: true,
      developer: {
        select: {
          id: true,
          name: true,
          title: true,
        },
      },
    },
  });

  const profileData: ProfileData = {
    id: viewer.id,
    name: acc?.name ?? viewer.name,
    email: acc?.email ?? viewer.email,
    role: acc?.role ?? viewer.role,
    isOwner: acc?.isOwner ?? viewer.isOwner,
    active: acc?.active ?? true,
    createdAt: formatDate(acc?.createdAt),
    developerName: acc?.developer?.name ?? null,
    developerTitle: acc?.developer?.title ?? null,
  };

  return <ProfileView profile={profileData} />;
}
