import type { Metadata } from "next";
import { NotFoundView } from "@/components/ui/NotFoundView";

export const metadata: Metadata = {
  title: "Page Not Found",
};

export default function CatchAllNotFoundPage() {
  return <NotFoundView standalone={false} />;
}
