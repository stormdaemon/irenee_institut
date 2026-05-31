import { privatePageMetadata } from "@/lib/seo";

export const metadata = privatePageMetadata;

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return children;
}
