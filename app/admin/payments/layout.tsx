import { requireDirectorPage } from "@/lib/admin-auth";

export default async function AdminPaymentsLayout({ children }: { children: React.ReactNode }) {
  await requireDirectorPage("/admin/payments");
  return <>{children}</>;
}
