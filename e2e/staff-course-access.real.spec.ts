import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { Pool } from "pg";
import { E2E_DIRECTOR_EMAIL } from "./global-setup";

const courseId = randomUUID();
const firstModuleId = randomUUID();
const secondModuleId = randomUUID();
const courseSlug = `apercu-directeur-${randomUUID()}`;
const courseTitle = "Parcours réel sans pass annuel";

function isolatedDatabaseUrl() {
  const databaseUrl = new URL(process.env.DATABASE_URL || "");
  const localHosts = new Set(["127.0.0.1", "localhost", "::1"]);
  if (!localHosts.has(databaseUrl.hostname) || !/security_test/i.test(databaseUrl.pathname)) {
    throw new Error("Staff access E2E refused: expected a local security_test database.");
  }
  return databaseUrl.toString();
}

test.describe("real staff course entrypoint", () => {
  let pool: Pool;
  let directorId = "";

  test.beforeAll(async () => {
    pool = new Pool({ connectionString: isolatedDatabaseUrl(), max: 1 });
    const director = await pool.query<{ id: string }>(
      "select id from public.profiles where lower(email)=lower($1) and role='directeur'",
      [E2E_DIRECTOR_EMAIL],
    );
    directorId = director.rows[0]?.id || "";
    expect(directorId, "The real-browser fixture must authenticate a server-owned director profile.").not.toBe("");

    const entitlements = await pool.query<{ enrollments: string; passes: string }>(
      `select
         (select count(*)::text from public.course_enrollments where etudiant_id=$1) as enrollments,
         (select count(*)::text from public.annual_access_passes where user_id=$1 and status='active') as passes`,
      [directorId],
    );
    expect(entitlements.rows[0]).toEqual({ enrollments: "0", passes: "0" });

    await pool.query(
      `insert into public.courses (id,titre,slug,description,statut,numero,niveau)
       values ($1,$2,$3,'Cours publié créé uniquement dans la base QA isolée.','publie',987,'debutant')`,
      [courseId, courseTitle, courseSlug],
    );
    await pool.query(
      `insert into public.course_modules
        (id,course_id,titre,description,ordre,type_contenu,contenu,contenu_html,duree,quiz,ressources)
       values
        ($1,$3,'Premier module réel','Premier module',1,'texte','Premier contenu','<h2>Premier contenu réel</h2>',10,'[]'::jsonb,'[]'::jsonb),
        ($2,$3,'Second module réel','Module normalement verrouillé',2,'texte','Second contenu','<h2>Second contenu réel</h2>',12,'[]'::jsonb,'[]'::jsonb)`,
      [firstModuleId, secondModuleId, courseId],
    );
  });

  test.afterAll(async () => {
    if (!pool) return;
    await pool.query("delete from public.courses where id=$1", [courseId]).catch(() => undefined);
    await pool.end();
  });

  test("director reaches a later published module from Mes cours without a pass or mocked APIs", async ({ page }) => {
    const progressWrites: string[] = [];
    page.on("request", request => {
      if (request.method() === "POST" && new URL(request.url()).pathname === "/api/progress/update") {
        progressWrites.push(request.postData() || "<empty>");
      }
    });

    const dashboardResponsePromise = page.waitForResponse(response => (
      response.request().method() === "GET" && new URL(response.url()).pathname === "/api/me"
    ));
    await page.goto("/espace-etudiant");
    const dashboardResponse = await dashboardResponsePromise;
    expect(dashboardResponse.status()).toBe(200);
    const dashboardPayload = await dashboardResponse.json();
    expect(dashboardPayload.profile).toMatchObject({ id: directorId, role: "directeur" });
    expect(dashboardPayload.annualPass).toBeNull();
    expect(dashboardPayload.courses.some((item: { id: string }) => item.id === courseId)).toBe(true);

    const courseCard = page.locator("article.card").filter({ hasText: courseTitle });
    await expect(courseCard).toBeVisible();
    const overviewResponsePromise = page.waitForResponse(response => (
      response.request().method() === "GET"
      && new URL(response.url()).pathname === `/api/learning/courses/${courseSlug}`
    ));
    await courseCard.getByRole("link", { name: "Accéder au cours" }).click();
    const overviewResponse = await overviewResponsePromise;
    expect(overviewResponse.status()).toBe(200);
    expect(await overviewResponse.json()).toMatchObject({ accessMode: "preview", ok: true });

    await expect(page).toHaveURL(new RegExp(`/cours/${courseSlug}$`));
    await expect(page.getByText("Prévisualisation équipe", { exact: true })).toBeVisible();
    const laterModule = page.locator(".course-syllabus-item").filter({ hasText: "Second module réel" });
    await expect(laterModule.getByText("Accessible", { exact: true })).toBeVisible();

    const moduleResponsePromise = page.waitForResponse(response => (
      response.request().method() === "GET"
      && new URL(response.url()).pathname === `/api/learning/courses/${courseSlug}/modules/${secondModuleId}`
    ));
    await laterModule.getByRole("link", { name: "Prévisualiser" }).click();
    const moduleResponse = await moduleResponsePromise;
    expect(moduleResponse.status()).toBe(200);
    expect(await moduleResponse.json()).toMatchObject({
      accessMode: "preview",
      module: { id: secondModuleId },
      ok: true,
    });

    await expect(page.getByRole("heading", { level: 1, name: "Second module réel" })).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "Mode aperçu équipe" })).toBeVisible();
    await page.waitForTimeout(900);
    expect(progressWrites, "A real staff preview must never post learner progress.").toEqual([]);

    const persistedProgress = await pool.query<{ count: string }>(
      "select count(*)::text as count from public.module_progress where etudiant_id=$1 and course_id=$2",
      [directorId, courseId],
    );
    expect(persistedProgress.rows[0]?.count).toBe("0");
  });

  test("authenticated director gets a direct reader entrypoint on the public Formations page", async ({ page }) => {
    await page.goto("/formations");

    const courseCard = page.locator(".course-included-card").filter({ hasText: courseTitle });
    await expect(courseCard).toBeVisible();
    await expect(
      courseCard.locator(`a[href="/cours/${courseSlug}"]`),
      "A director must be able to open a published course from the catalogue instead of being sent to annual-pass checkout.",
    ).toBeVisible();
    await expect(courseCard.locator('a[href*="checkout=annual-pass"]')).toHaveCount(0);

    const overviewResponsePromise = page.waitForResponse(response => (
      response.request().method() === "GET"
      && new URL(response.url()).pathname === `/api/learning/courses/${courseSlug}`
    ));
    await courseCard.locator(`a[href="/cours/${courseSlug}"]`).click();
    const overviewResponse = await overviewResponsePromise;
    expect(overviewResponse.status()).toBe(200);
    expect(await overviewResponse.json()).toMatchObject({ accessMode: "preview", ok: true });
    await expect(page.getByText("Prévisualisation équipe", { exact: true })).toBeVisible();
  });
});
