import {test,expect,mock,beforeEach} from "bun:test";
const id="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
let denied=false,role="directeur",limited=false,status="publie",failure:unknown;
let listedAuthor:unknown, savedActor:unknown, event:unknown;
class CourseInputError extends Error {constructor(message:string,public status=400){super(message)}}
class CoursePersistenceError extends Error {constructor(message:string,public status=409){super(message)}}
class RequestBodyError extends Error {constructor(message:string,public status=413){super(message)}}
mock.module("@/lib/api-auth",()=>({authorizeRequest:async()=>denied?{ok:false,response:Response.json({error:"denied"},{status:403})}:{ok:true,user:{id},profile:{id,email:"test@example.test",role,nom:"Test",prenom:"Ada"}}}));
mock.module("@/lib/rate-limit",()=>({checkRateLimit:async()=>({allowed:!limited,retryAfterSeconds:30})}));
mock.module("@/lib/request-body",()=>({RequestBodyError,readFormDataBodyWithLimit:async()=>new FormData()}));
mock.module("@/lib/course-input",()=>({CourseInputError,parseCourseForm:()=>{if(failure!==undefined)throw failure;return {course:{statut:status}}}}));
mock.module("@/lib/course-admin",()=>({CoursePersistenceError,createCourse:async(_:unknown,actor:unknown)=>{savedActor=actor;return{id}},updateCourse:async(_:unknown,__:unknown,actor:unknown)=>{savedActor=actor;return{id}}}));
mock.module("@/lib/server-data",()=>({getCourses:async(_:unknown,options:{authorId?:string})=>{listedAuthor=options.authorId;return[{id}]}}));
mock.module("@/lib/security-audit",()=>({hashAuditSubject:(s:string)=>s,recordSecurityEvent:async(e:unknown)=>{event=e}}));
const list=await import("@/app/api/courses/route");
const item=await import("@/app/api/courses/[id]/route");
beforeEach(()=>{denied=false;role="directeur";limited=false;status="publie";failure=undefined;listedAuthor=undefined;savedActor=undefined;event=undefined});
const request=()=>new Request("https://test.local/api/courses",{method:"POST"});
const patch=()=>item.PATCH(request(),{params:Promise.resolve({id})});
test("course list scopes trainers and permits the director's complete catalog",async()=>{
 expect((await list.GET(request())).status).toBe(200);expect(listedAuthor).toBeUndefined();
 role="formateur";expect((await list.GET(request())).status).toBe(200);expect(listedAuthor).toBe(id);
 denied=true;expect((await list.GET(request())).status).toBe(403);
});
for(const [name,run,success] of [["create",()=>list.POST(request()),201],["update",patch,200]] as const){
 test(`${name}: refuses unauthorized and throttled writes before persistence`,async()=>{
  denied=true;expect((await run()).status).toBe(403);expect(savedActor).toBeUndefined();
  denied=false;limited=true;const response=await run();expect(response.status).toBe(429);expect(response.headers.get("retry-after")).toBe("30");expect(savedActor).toBeUndefined();
 });
 test(`${name}: published and draft writes persist the authenticated actor and audit event`,async()=>{
  for(const mode of ["publie","brouillon"]){status=mode;const response=await run();expect(response.status).toBe(success);expect(await response.json()).toEqual({ok:true,verified:true,data:{id}});expect(savedActor).toMatchObject({id,role:"directeur"});expect(event).toMatchObject({actorUserId:id,eventType:mode==="publie"?"course.published":name==="create"?"course.created":"course.updated"});}
 });
 for(const [label,error,expected] of [["invalid input",new CourseInputError("invalid"),400],["conflict",new CoursePersistenceError("stale"),409],["oversized",new RequestBodyError("large"),413],["database outage",new Error("private database detail"),500],["unexpected rejection","opaque",500]] as const){
  test(`${name}: ${label} produces a bounded failure response`,async()=>{failure=error;const response=await run();expect(response.status).toBe(expected);const body=await response.json();expect(body.ok).toBe(false);expect(body.verified).toBe(false);expect(savedActor).toBeUndefined();if(expected===500)expect(body.error).not.toContain("private database");});
 }
}
test("update refuses invalid identifiers before parsing a course",async()=>{const response=await item.PATCH(request(),{params:Promise.resolve({id:"bad-id"})});expect(response.status).toBe(400);expect(savedActor).toBeUndefined()});
