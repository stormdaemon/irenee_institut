import { requireDirectorPage } from "@/lib/admin-auth";

export default async function AdminLegalLayout({ children }: { children: React.ReactNode }) {
  await requireDirectorPage("/admin/legal");
  return <>{children}</>;
}
