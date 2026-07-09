import { privatePageMetadata } from "@/lib/seo";

export const metadata = {
  ...privatePageMetadata,
  title: "Espace de cours",
  description: "Lecture des cours et suivi de progression de l'Institut Saint Irénée."
};

export default function CourseLayout({ children }: { children: React.ReactNode }) {
  return <div className="course-area">{children}</div>;
}
