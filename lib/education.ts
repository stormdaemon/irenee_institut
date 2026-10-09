import { pgInsert, pgRead } from "@/lib/postgres";
import type { LearningDocument, LearningDocumentKind } from "@/lib/learning-documents";
import type { createServerContext } from "@/lib/postgres";

type IssuableDocument = {
  courseId?: string | null;
  courseTitle?: string | null;
  documentKind: LearningDocumentKind;
  moduleId?: string | null;
  moduleTitle?: string | null;
  userId: string;
};

function documentKey(input: IssuableDocument) {
  if (input.documentKind === "final_certificate") return `final_certificate:${input.userId}`;
  if (input.documentKind === "course_parchment") return `course_parchment:${input.userId}:${input.courseId}`;
  return `module_parchment:${input.userId}:${input.moduleId}`;
}

function recipientName(profile: { prenom?: string | null; nom?: string | null; email?: string | null }) {
  return `${profile.prenom || ""} ${profile.nom || ""}`.trim() || String(profile.email || "Étudiant");
}

export async function issueLearningDocument(context: NonNullable<ReturnType<typeof createServerContext>>, input: IssuableDocument) {
  const { data: profile, error: profileError } = await pgRead("select t.\"email\", t.\"prenom\", t.\"nom\" from public.\"profiles\" t where t.\"id\" = $1", [input.userId], "one");
  if (profileError || !profile) throw new Error(profileError?.message || "Profil introuvable.");

  const key = documentKey(input);
  const { data: existing, error: existingError } = await pgRead("select t.* from public.\"learning_documents\" t where t.\"document_key\" = $1", [key], "optional");
  if (existingError) throw new Error(existingError.message);
  if (existing) return existing as LearningDocument;

  const { data: document, error: insertError } = await pgInsert("learning_documents", {
      course_id: input.courseId || null,
      course_title: input.courseTitle || null,
      document_key: key,
      document_kind: input.documentKind,
      module_id: input.moduleId || null,
      module_title: input.moduleTitle || null,
      recipient_name: recipientName(profile),
      user_id: input.userId
    }, { returning: "one" });
  if (insertError) throw new Error(insertError.message);

  return document as LearningDocument;
}
