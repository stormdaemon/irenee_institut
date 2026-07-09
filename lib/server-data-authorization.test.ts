import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { query } from "@/lib/db";
import { beginEmailSignUp, verifyEmailToken } from "@/lib/local-auth";
import { getHomework } from "@/lib/server-data";

test("getHomework returns no rows for an empty scope and intersects course and author ownership", async () => {
  const database = await query<{ name: string }>("select current_database() as name");
  assert.match(database.rows[0]?.name || "", /security_test/, "server-data tests must use the isolated security database");

  const ownCourseId = randomUUID();
  const otherCourseId = randomUUID();
  const ownHomeworkId = randomUUID();
  const otherHomeworkId = randomUUID();
  const mismatchedHomeworkId = randomUUID();
  const suffix = randomUUID();
  const signup = await beginEmailSignUp({
    email: `server-data-${suffix}@example.test`,
    metadata: { nom: "Serveur", prenom: "Données" }
  });
  assert.ok(signup.user?.id && signup.verificationToken);
  await verifyEmailToken(signup.verificationToken!, "Correct-horse-42!");
  const authorId = signup.user!.id;
  const otherSignup = await beginEmailSignUp({
    email: `server-data-other-${suffix}@example.test`,
    metadata: { nom: "Autre", prenom: "Formateur" }
  });
  assert.ok(otherSignup.user?.id && otherSignup.verificationToken);
  await verifyEmailToken(otherSignup.verificationToken!, "Correct-horse-42!");
  const otherAuthorId = otherSignup.user!.id;

  try {
    await query(
      `insert into public.courses (id,titre,slug,description,statut,auteur_id)
       values ($1,'Cours attribué',$3,'','brouillon',$5),($2,'Cours étranger',$4,'','brouillon',$6)`,
      [ownCourseId, otherCourseId, `server-data-own-${suffix}`, `server-data-other-${suffix}`, authorId, otherAuthorId]
    );
    await query(
      `insert into public.homework (id,course_id,auteur_id,auteur_nom,titre,description)
       values
        ($1,$4,$6,'Formateur test','Devoir attribué',''),
        ($2,$5,$7,'Autre formateur','Devoir étranger',''),
        ($3,$4,$7,'Autre formateur','Devoir incohérent sur le cours attribué','')`,
      [ownHomeworkId, otherHomeworkId, mismatchedHomeworkId, ownCourseId, otherCourseId, authorId, otherAuthorId]
    );

    assert.deepEqual(await getHomework({ courseIds: [] }), []);

    const allHomework = await getHomework();
    assert.ok(allHomework.some(item => item.id === ownHomeworkId));
    assert.ok(allHomework.some(item => item.id === otherHomeworkId));
    assert.ok(allHomework.some(item => item.id === mismatchedHomeworkId));

    const courseScopedHomework = await getHomework({ courseIds: [ownCourseId] });
    assert.ok(courseScopedHomework.some(item => item.id === mismatchedHomeworkId));

    const authorScopedHomework = await getHomework({ authorId });
    assert.ok(authorScopedHomework.some(item => item.id === ownHomeworkId));
    assert.equal(authorScopedHomework.some(item => item.id === otherHomeworkId), false);
    assert.equal(authorScopedHomework.some(item => item.id === mismatchedHomeworkId), false);

    const scopedHomework = await getHomework({ authorId, courseIds: [ownCourseId] });
    assert.ok(scopedHomework.some(item => item.id === ownHomeworkId));
    assert.equal(scopedHomework.some(item => item.id === otherHomeworkId), false);
    assert.equal(scopedHomework.some(item => item.id === mismatchedHomeworkId), false);
  } finally {
    await query("delete from public.homework where id = any($1::uuid[])", [[ownHomeworkId, otherHomeworkId, mismatchedHomeworkId]]).catch(() => undefined);
    await query("delete from public.courses where id = any($1::uuid[])", [[ownCourseId, otherCourseId]]).catch(() => undefined);
    await query("delete from auth.users where id = any($1::uuid[])", [[authorId, otherAuthorId]]).catch(() => undefined);
  }
});
