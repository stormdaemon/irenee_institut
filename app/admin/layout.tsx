import { privatePageMetadata } from "@/lib/seo";
import { requireStaffSession } from "@/lib/server-auth";
import { redirect } from "next/navigation";

export const metadata = privatePageMetadata;

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!await requireStaffSession()) redirect("/auth/login?next=/admin");
  return children;
}
