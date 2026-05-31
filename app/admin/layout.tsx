import { privatePageMetadata } from "@/lib/seo";

export const metadata = privatePageMetadata;

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
