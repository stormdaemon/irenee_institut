import type { LearningDocument, LearningDocumentKind } from "@/lib/learning-documents";
import type { createServerClient } from "@/lib/supabase";

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

export async function issueLearningDocument(supabase: NonNullable<ReturnType<typeof createServerClient>>, input: IssuableDocument) {
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("email, prenom, nom")
    .eq("id", input.userId)
    .single();
  if (profileError) throw new Error(profileError.message);

  const key = documentKey(input);
  const { data: existing, error: existingError } = await supabase
    .from("learning_documents")
    .select("*")
    .eq("document_key", key)
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);
  if (existing) return existing as LearningDocument;

  const { data: document, error: insertError } = await supabase
    .from("learning_documents")
    .insert({
      course_id: input.courseId || null,
      course_title: input.courseTitle || null,
      document_key: key,
      document_kind: input.documentKind,
      module_id: input.moduleId || null,
      module_title: input.moduleTitle || null,
      recipient_name: recipientName(profile),
      user_id: input.userId
    })
    .select()
    .single();
  if (insertError) throw new Error(insertError.message);

  return document as LearningDocument;
}
