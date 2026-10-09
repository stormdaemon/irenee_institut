import {withTransaction} from "./db";
import schema from "@/database/schema-columns.json";
type ContentRow=Record<string,unknown>;

/** Import educational content only; no identities, enrollments or payments. */
export async function importCourseContent(courses:ContentRow[], modules:ContentRow[]) {
 const courseIds=new Set(courses.map(c=>c.id));
 if(courseIds.size!==courses.length||new Set(modules.map(m=>m.id)).size!==modules.length)throw new Error("Duplicate content identifiers.");
 for(const [table,rows] of [["courses",courses],["course_modules",modules]] as const){
  const columns=schema[table];
  for(const row of rows){
   if(!row.id||!row.titre||Object.keys(row).some(k=>!Object.hasOwn(columns,k)))throw new Error("Invalid content row.");
   if(table==="course_modules"&&(!courseIds.has(row.course_id)||!String(row.contenu_html||row.contenu||row.url_video||"").trim()))throw new Error("Orphan or empty module.");
  }
 }
 return withTransaction(async client=>{
  const result={courses:0,modules:0};
  for(const [table,rows] of [["courses",courses],["course_modules",modules]] as const){
   for(const source of rows){
    const row={...source};
    if(table==="courses"){
     // Historical authors are not recreated as user accounts.
     row.auteur_id=null;
     row.nb_etudiants=0;
     row.nb_modules=modules.filter(m=>m.course_id===row.id).length;
     for(const field of ["objectifs","competences","prerequis"])row[field]??=[];
    }
    const columns=Object.keys(row);
    const types=schema[table] as Record<string,string>;
    const values=columns.map(k=>["json","jsonb"].includes(types[k])&&row[k]!=null?JSON.stringify(row[k]):row[k]);
    const inserted=await client.query(`insert into public.${table} (${columns.map(k=>'"'+k+'"').join(',')})
      values (${values.map((_,i)=>'$'+(i+1)).join(',')}) on conflict (id) do nothing returning id`,values);
    result[table==="courses"?"courses":"modules"]+=inserted.rowCount||0;
   }
  }
  return result;
 });
}
