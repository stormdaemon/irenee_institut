import {test, expect} from "bun:test";
import {randomUUID} from "node:crypto";
import {query} from "./db";
import {importCourseContent} from "./content-import";

test("course recovery preserves module bodies and UUIDs and never overwrites an edited course", async()=>{
 const courseId=randomUUID(),moduleId=randomUUID();
 const courses=[{id:courseId,titre:"Cours retrouvé",slug:`recovered-${courseId}`,auteur_id:randomUUID(),statut:"publie",competences:null,prerequis:null}];
 const modules=[{id:moduleId,course_id:courseId,titre:"Premier module",ordre:1,contenu:"Texte intégral conservé",contenu_html:"<p>Texte intégral conservé</p>"}];
 try {
  expect(await importCourseContent(courses,modules)).toEqual({courses:1,modules:1});
  const actual=await query("select contenu,contenu_html from course_modules where id=$1",[moduleId]);
  expect(actual.rows[0]).toEqual({contenu:modules[0].contenu,contenu_html:modules[0].contenu_html});
  expect((await query("select auteur_id from courses where id=$1",[courseId])).rows[0].auteur_id).toBeNull();
  await query("update courses set titre='Titre édité' where id=$1",[courseId]);
  expect(await importCourseContent(courses,modules)).toEqual({courses:0,modules:0});
  expect((await query("select titre from courses where id=$1",[courseId])).rows[0].titre).toBe("Titre édité");
 }finally{await query("delete from courses where id=$1",[courseId]);}
});

test("recovery rejects orphan, duplicate, empty and unknown fields before writing any data",async()=>{
 const id=randomUUID();const course={id,titre:"Invalide",slug:`invalid-${id}`};
 await expect(importCourseContent([course],[{id:randomUUID(),course_id:randomUUID(),titre:"Orphelin",contenu:"Texte"}])).rejects.toThrow();
 await expect(importCourseContent([course,course],[])).rejects.toThrow();
 await expect(importCourseContent([{...course,role:"directeur"}],[])).rejects.toThrow();
 await expect(importCourseContent([course],[{id:randomUUID(),course_id:id,titre:"Vide",contenu:""}])).rejects.toThrow();
 expect((await query("select id from courses where id=$1",[id])).rowCount).toBe(0);
});

test("recovery rolls back the whole batch when PostgreSQL rejects a module",async()=>{
 const id=randomUUID();
 await expect(importCourseContent([{id,titre:"Rollback",slug:`rollback-${id}`}],[{id:"invalid-uuid",course_id:id,titre:"Module",contenu:"Texte"}])).rejects.toThrow();
 expect((await query("select id from courses where id=$1",[id])).rowCount).toBe(0);
});
