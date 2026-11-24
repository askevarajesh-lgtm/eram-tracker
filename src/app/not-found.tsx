import type { Metadata } from "next";
import { NotFoundView } from "@/components/ui/NotFoundView";

export const metadata: Metadata = {
  title: "404 · Page Not Found",
};

export default function GlobalNotFound() {
  return <NotFoundView standalone={true} />;
}
