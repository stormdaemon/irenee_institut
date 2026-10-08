import {privatePageMetadata} from "@/lib/seo";
import {requireAdminPage} from "@/lib/admin-auth";
import {AdminNavigation} from "@/components/AdminNavigation";
export const metadata=privatePageMetadata;
export default async function AdminLayout({children}:{children:React.ReactNode}){const profile=await requireAdminPage();return <div className="admin-shell"><AdminNavigation isDirector={profile.role==="directeur"}/><div className="apostolos-admin-content">{children}</div></div>}
