import { privatePageMetadata } from "@/lib/seo";
import { requireDirectorSession } from "@/lib/server-auth";
import { redirect } from "next/navigation";

export const metadata = privatePageMetadata;

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!await requireDirectorSession()) redirect("/auth/login?next=/admin");
  return children;
}
