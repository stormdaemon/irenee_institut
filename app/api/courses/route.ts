import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/api-auth";
import { CoursePersistenceError, createCourse } from "@/lib/course-admin";
import { CourseInputError, parseCourseForm } from "@/lib/course-input";
import { readFormDataBodyWithLimit, RequestBodyError } from "@/lib/request-body";
import { hashAuditSubject, recordSecurityEvent } from "@/lib/security-audit";
import { getCourses } from "@/lib/server-data";

const MAX_COURSE_FORM_BYTES = 1_500_000;

function courseErrorResponse(error: unknown) {
  if (error instanceof CourseInputError || error instanceof CoursePersistenceError) {
    return NextResponse.json({ ok: false, verified: false, error: error.message }, { status: error.status });
  }
  if (error instanceof RequestBodyError) {
    return NextResponse.json({ ok: false, verified: false, error: error.message }, { status: error.status });
  }
  console.error("course_create_failed", { error: error instanceof Error ? error.message : String(error) });
  return NextResponse.json({ ok: false, verified: false, error: "Le cours n'a pas pu être enregistré." }, { status: 500 });
}

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, ["directeur", "formateur"]);
  if (!auth.ok) return auth.response;
  const authorId = auth.profile.role === "formateur" ? auth.user.id : undefined;
  return NextResponse.json(await getCourses("admin", { authorId }), { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, ["directeur", "formateur"]);
  if (!auth.ok) return auth.response;

  try {
    const input = parseCourseForm(await readFormDataBodyWithLimit(request, MAX_COURSE_FORM_BYTES));
    const data = await createCourse(input, {
      email: auth.profile.email,
      id: auth.profile.id,
      nom: auth.profile.nom,
      prenom: auth.profile.prenom,
      role: auth.profile.role as "directeur" | "formateur"
    });
    await recordSecurityEvent({
      actorUserId: auth.user.id,
      eventType: input.course.statut === "publie" ? "course.published" : "course.created",
      metadata: {
        reason: input.course.statut,
        route: "/api/courses",
        subject_hash: hashAuditSubject(String(data.id))
      },
      request
    });
    return NextResponse.json({ ok: true, verified: true, data }, { status: 201 });
  } catch (error) {
    return courseErrorResponse(error);
  }
}
