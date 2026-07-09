import { privatePageMetadata } from "@/lib/seo";
import { requireAdminPage } from "@/lib/admin-auth";

export const metadata = privatePageMetadata;

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdminPage();
  return <div className="admin-shell">{children}</div>;
}
