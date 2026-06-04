import { createServerClient } from "@/lib/supabase";
import type { Course, Profile } from "@/lib/types";

type ProfileSummary = Pick<Profile, "id" | "email" | "prenom" | "nom" | "role" | "created_at">;

type CourseSummary = Pick<Course, "id" | "titre" | "slug" | "numero" | "statut">;

type EnrollmentRow = {
  id: string;
  course_id: string;
  etudiant_id: string;
  statut?: string | null;
  created_at?: string | null;
};

type AnnualPassRow = {
  id: string;
  user_id: string;
  provider_order_id?: string | null;
  amount_total?: number | null;
  currency?: string | null;
  status?: string | null;
  starts_at?: string | null;
  expires_at?: string | null;
  created_at?: string | null;
};

export type AdminCourseEnrollment = EnrollmentRow & {
  course: CourseSummary | null;
};

export type AdminEnrolledStudent = ProfileSummary & {
  courses: AdminCourseEnrollment[];
  hasActiveAnnualPass: boolean;
};

export type AdminAnnualPass = AnnualPassRow & {
  profile: ProfileSummary | null;
  isActive: boolean;
};

export type AdminAccessAudit = {
  students: AdminEnrolledStudent[];
  annualPasses: AdminAnnualPass[];
  stats: {
    students: number;
    studentsWithCourses: number;
    activeAnnualPasses: number;
  };
};

function isActivePass(pass: AnnualPassRow, now = new Date()) {
  return pass.status === "active" && Boolean(pass.expires_at) && new Date(pass.expires_at || 0) > now;
}

function sortCourses(left: AdminCourseEnrollment, right: AdminCourseEnrollment) {
  const leftNumber = Number(left.course?.numero ?? 9999);
  const rightNumber = Number(right.course?.numero ?? 9999);
  if (leftNumber !== rightNumber) return leftNumber - rightNumber;
  return (left.course?.titre || "").localeCompare(right.course?.titre || "", "fr");
}

export async function getAdminAccessAudit(): Promise<AdminAccessAudit> {
  const supabase = createServerClient();
  if (!supabase) {
    return {
      students: [],
      annualPasses: [],
      stats: { students: 0, studentsWithCourses: 0, activeAnnualPasses: 0 }
    };
  }

  const [profilesResult, coursesResult, enrollmentsResult, passesResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("id,email,prenom,nom,role,created_at")
      .order("nom", { ascending: true }),
    supabase
      .from("courses")
      .select("id,titre,slug,numero,statut")
      .order("numero", { ascending: true }),
    supabase
      .from("course_enrollments")
      .select("id,course_id,etudiant_id,statut,created_at")
      .order("created_at", { ascending: false }),
    supabase
      .from("annual_access_passes")
      .select("id,user_id,provider_order_id,amount_total,currency,status,starts_at,expires_at,created_at")
      .order("created_at", { ascending: false })
  ]);

  const firstError = profilesResult.error || coursesResult.error || enrollmentsResult.error || passesResult.error;
  if (firstError) throw new Error(firstError.message);

  const profiles = (profilesResult.data || []) as ProfileSummary[];
  const courses = (coursesResult.data || []) as CourseSummary[];
  const enrollments = (enrollmentsResult.data || []) as EnrollmentRow[];
  const annualPassRows = (passesResult.data || []) as AnnualPassRow[];
  const now = new Date();

  const profileById = new Map(profiles.map(profile => [profile.id, profile]));
  const courseById = new Map(courses.map(course => [course.id, course]));
  const activePassUserIds = new Set(annualPassRows.filter(pass => isActivePass(pass, now)).map(pass => pass.user_id));

  const enrollmentsByUser = new Map<string, AdminCourseEnrollment[]>();
  for (const enrollment of enrollments) {
    const list = enrollmentsByUser.get(enrollment.etudiant_id) || [];
    list.push({
      ...enrollment,
      course: courseById.get(enrollment.course_id) || null
    });
    enrollmentsByUser.set(enrollment.etudiant_id, list);
  }

  const students = profiles
    .filter(profile => profile.role === "etudiant")
    .map(profile => ({
      ...profile,
      courses: (enrollmentsByUser.get(profile.id) || []).sort(sortCourses),
      hasActiveAnnualPass: activePassUserIds.has(profile.id)
    }));

  const annualPasses = annualPassRows.map(pass => ({
    ...pass,
    profile: profileById.get(pass.user_id) || null,
    isActive: isActivePass(pass, now)
  }));

  return {
    students,
    annualPasses,
    stats: {
      students: students.length,
      studentsWithCourses: students.filter(student => student.courses.length > 0).length,
      activeAnnualPasses: annualPasses.filter(pass => pass.isActive).length
    }
  };
}
