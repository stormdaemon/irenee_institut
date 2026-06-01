import { privatePageMetadata } from "@/lib/seo";
import { requireDirectorPage } from "@/lib/admin-auth";

export const metadata = privatePageMetadata;

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireDirectorPage();
  return children;
}
