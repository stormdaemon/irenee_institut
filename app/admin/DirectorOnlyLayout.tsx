import { redirect } from "next/navigation";
import { requireDirectorSession } from "@/lib/server-auth";

export async function DirectorOnlyLayout({ children }: { children: React.ReactNode }) {
  if (!await requireDirectorSession()) redirect("/admin/courses");
  return children;
}
