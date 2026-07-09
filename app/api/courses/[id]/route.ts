import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/api-auth";
import { CoursePersistenceError, updateCourse } from "@/lib/course-admin";
import { CourseInputError, parseCourseForm } from "@/lib/course-input";
import { readFormDataBodyWithLimit, RequestBodyError } from "@/lib/request-body";
import { hashAuditSubject, recordSecurityEvent } from "@/lib/security-audit";

const MAX_COURSE_FORM_BYTES = 1_500_000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function courseErrorResponse(error: unknown) {
  if (error instanceof CourseInputError || error instanceof CoursePersistenceError) {
    return NextResponse.json({ ok: false, verified: false, error: error.message }, { status: error.status });
  }
  if (error instanceof RequestBodyError) {
    return NextResponse.json({ ok: false, verified: false, error: error.message }, { status: error.status });
  }
  console.error("course_update_failed", { error: error instanceof Error ? error.message : String(error) });
  return NextResponse.json({ ok: false, verified: false, error: "Le cours n'a pas pu être enregistré." }, { status: 500 });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeRequest(request, ["directeur", "formateur"]);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  if (!UUID_PATTERN.test(id)) {
    return NextResponse.json({ ok: false, verified: false, error: "Identifiant de cours invalide." }, { status: 400 });
  }

  try {
    const input = parseCourseForm(await readFormDataBodyWithLimit(request, MAX_COURSE_FORM_BYTES));
    const data = await updateCourse(id, input, {
      email: auth.profile.email,
      id: auth.profile.id,
      nom: auth.profile.nom,
      prenom: auth.profile.prenom,
      role: auth.profile.role as "directeur" | "formateur"
    });
    await recordSecurityEvent({
      actorUserId: auth.user.id,
      eventType: input.course.statut === "publie" ? "course.published" : "course.updated",
      metadata: {
        reason: input.course.statut,
        route: "/api/courses/[id]",
        subject_hash: hashAuditSubject(id)
      },
      request
    });
    return NextResponse.json({ ok: true, verified: true, data });
  } catch (error) {
    return courseErrorResponse(error);
  }
}
