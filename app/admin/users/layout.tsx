import { requireDirectorPage } from "@/lib/admin-auth";

export default async function AdminUsersLayout({ children }: { children: React.ReactNode }) {
  await requireDirectorPage("/admin/users");
  return <>{children}</>;
}
