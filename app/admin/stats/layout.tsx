import { requireDirectorPage } from "@/lib/admin-auth";

export default async function AdminStatsLayout({ children }: { children: React.ReactNode }) {
  await requireDirectorPage("/admin/stats");
  return <>{children}</>;
}
