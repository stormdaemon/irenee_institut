import { requireDirectorPage } from "@/lib/admin-auth";

export default async function AdminAccessLayout({ children }: { children: React.ReactNode }) {
  await requireDirectorPage("/admin/access");
  return <>{children}</>;
}
