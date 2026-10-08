import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {importCourseContent} from "../lib/content-import";
import {getPool,query} from "../lib/db";
const directory=resolve(process.argv[2]||".recovery/content");
const courses=JSON.parse(readFileSync(resolve(directory,"legacy-courses.json"),"utf8")).rows;
const modules=JSON.parse(readFileSync(resolve(directory,"legacy-course_modules.json"),"utf8")).rows;
try{
 const inserted=await importCourseContent(courses,modules);
 const stored=await query("select id,contenu,contenu_html from course_modules where id=any($1::uuid[])",[modules.map((m:{id:string})=>m.id)]);
 const actual=new Map(stored.rows.map(m=>[m.id,m]));
 for(const expected of modules){
  const row=actual.get(expected.id);
  if(!row||row.contenu!==expected.contenu||row.contenu_html!==expected.contenu_html)throw new Error("Content verification mismatch: review existing edits before proceeding.");
 }
 console.log(JSON.stringify({inserted,verifiedModules:stored.rowCount}));
}finally{await getPool().end();}
