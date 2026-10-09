import {test,expect,mock,beforeEach} from "bun:test";
const id="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",other="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
let denied=false,readResult:any,writeResult:any,body:any,parseError:unknown,deleteError=false,auditError:unknown;
let calls:any[]=[];
class RequestBodyError extends Error{constructor(message:string,public status=413){super(message)}}
const auth=async()=>denied?{ok:false,response:Response.json({error:"denied"},{status:403})}:{ok:true,user:{id},profile:{id,role:"directeur"},context:{users:{delete:async(target:string)=>{calls.push(["delete",target]);return{error:deleteError?{message:"private"}:null}}}}};
mock.module("@/lib/api-auth",()=>({authenticateRequest:auth,authorizeRequest:auth}));
mock.module("@/lib/postgres",()=>({pgRead:async(...args:any[])=>{calls.push(["read",...args]);return readResult},pgInsert:async(...args:any[])=>{calls.push(["insert",...args]);return writeResult},pgUpdate:async(...args:any[])=>{calls.push(["update",...args]);return writeResult}}));
mock.module("@/lib/request-body",()=>({RequestBodyError,readJsonBodyWithLimit:async()=>{if(parseError!==undefined)throw parseError;return body}}));
mock.module("@/lib/security-audit",()=>({hashAuditSubject:(s:string)=>s,recordSecurityEvent:async(e:unknown)=>calls.push(["audit",e])}));
mock.module("@/lib/admin-access",()=>({getAdminAccessAudit:async()=>{if(auditError!==undefined)throw auditError;return{profiles:[]}}}));
const profile=await import("@/app/api/auth/profile/route");
const onboarding=await import("@/app/api/onboarding/status/route");
const complete=await import("@/app/api/onboarding/complete/route");
const books=await import("@/app/api/library/book-requests/route");
const review=await import("@/app/api/book-requests/[id]/route");
const users=await import("@/app/api/users/[id]/route");
const access=await import("@/app/api/admin/access/route");
const req=()=>new Request("https://test.local/api/test",{method:"POST"});
const params=(value=other)=>({params:Promise.resolve({id:value})});
beforeEach(()=>{denied=false;readResult={data:{id,role:"etudiant"},error:null};writeResult={data:{id},error:null};body={requestedTitle:"Les Confessions",status:"approuve"};parseError=undefined;deleteError=false;auditError=undefined;calls=[]});
for(const [name,run] of [["profile",()=>profile.GET(req())],["onboarding",()=>onboarding.GET(req())],["onboarding completion",()=>complete.POST(req())],["book request",()=>books.POST(req())],["book review",()=>review.PATCH(req(),params())],["user deletion",()=>users.DELETE(req(),params())],["access audit",()=>access.GET(req())]] as const){
 test(`${name} rejects unauthorized callers without reading or modifying records`,async()=>{denied=true;expect((await run()).status).toBe(403);expect(calls).toHaveLength(0)});
}
test("profile returns only the authenticated user's profile with no caching",async()=>{const response=await profile.GET(req());expect(await response.json()).toEqual({profile:readResult.data});expect(response.headers.get("cache-control")).toBe("private, no-store");expect(calls[0][2]).toEqual([id]);readResult={data:null,error:{message:"private"}};expect((await profile.GET(req())).status).toBe(500)});
test("onboarding distinguishes new, completed, staff and missing profiles and database errors",async()=>{
 for(const [data,needed] of [[{role:"etudiant"},true],[{role:"etudiant",onboarding_completed_at:"2026-01-01"},false],[{role:"directeur"},false],[null,false]] as const){readResult={data,error:null};const result=await onboarding.GET(req());expect((await result.json()).needsOnboarding).toBe(needed)}
 readResult.error={message:"private"};expect((await onboarding.GET(req())).status).toBe(400);
 const response=await complete.POST(req());expect((await response.json()).ok).toBe(true);expect(calls.at(-1)[3]).toContain("id");expect(calls.at(-1)[4]).toEqual([id]);writeResult.error={message:"private"};expect((await complete.POST(req())).status).toBe(400);
});
test("book requests require a verified active membership and persist the correct owner",async()=>{
 readResult.error={message:"unavailable"};expect((await books.POST(req())).status).toBe(400);
 readResult={data:null,error:null};expect((await books.POST(req())).status).toBe(403);
 readResult.data={id:other};const response=await books.POST(req());expect(response.status).toBe(200);expect(calls.at(-1)[2]).toMatchObject({user_id:id,library_membership_id:other,requested_title:"Les Confessions"});
 writeResult.error={message:"failed"};expect((await books.POST(req())).status).toBe(400);
});
for(const [error,status] of [[new RequestBodyError("large"),413],[new Error("invalid"),400],["opaque",400]] as const){test(`library handles parser failure ${String(error)}`,async()=>{parseError=error;expect((await books.POST(req())).status).toBe(status);expect((await review.PATCH(req(),params())).status).toBe(status)})}
test("book review rejects missing or invalid statuses",async()=>{for(const candidate of [{},{status:"bad"}]){body=candidate;expect((await review.PATCH(req(),params())).status).toBe(400);expect(calls).toHaveLength(0)}});
test("book reviews record the reviewer, clear pending reviews, and synchronize a linked order",async()=>{
 for(const status of ["approuve","refuse","en_attente_direction"]){body={status};writeResult={data:{id,paypal_order_id:other},error:null};calls=[];expect((await review.PATCH(req(),params())).status).toBe(200);expect(calls[0][2].reviewed_by).toBe(status==="en_attente_direction"?null:id);expect(calls[1][1]).toBe("paypal_orders")}
 writeResult={data:{id},error:null};calls=[];expect((await review.PATCH(req(),params())).status).toBe(200);expect(calls).toHaveLength(1);
 writeResult.error={message:"failed"};expect((await review.PATCH(req(),params())).status).toBe(400);
});
test("deletion validates identifiers, rejects self deletion, reports persistence errors and audits success",async()=>{
 expect((await users.DELETE(req(),params("bad"))).status).toBe(404);expect((await users.DELETE(req(),params(id))).status).toBe(400);expect(calls).toHaveLength(0);
 deleteError=true;expect((await users.DELETE(req(),params())).status).toBe(500);deleteError=false;expect((await users.DELETE(req(),params())).status).toBe(200);expect(calls.at(-1)[1]).toMatchObject({actorUserId:id,eventType:"admin.user.deleted"});
});
test("access audit reports real success and both ordinary and unexpected failures",async()=>{expect(await(await access.GET(req())).json()).toEqual({profiles:[]});for(const error of [new Error("unavailable"),"opaque"]){auditError=error;expect((await access.GET(req())).status).toBe(400)}});
