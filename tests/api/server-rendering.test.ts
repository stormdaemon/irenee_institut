import {test,expect,mock,beforeEach} from "bun:test";
let configured=true,failed=false,rows:any[]=[];
mock.module("@/lib/postgres",()=>({createServerContext:()=>configured?{}:null,pgRead:async()=>({data:failed?null:rows,error:failed?{message:"private database detail"}:null})}));
mock.module("@/lib/db",()=>({query:async()=>({rows:[]})}));
const server=await import("@/lib/server-data");
beforeEach(()=>{configured=true;failed=false;rows=[]});
test("rendered directories never substitute sample people, courses or homework for an unavailable database",async()=>{for(const available of [true,false]){configured=available;failed=true;for(const load of [server.getProfiles,server.getTrainers,server.getCourses,server.getHomework])await expect(load()).rejects.toThrow()}});
test("a fresh database renders empty directories instead of old demonstration records",async()=>{for(const load of [server.getProfiles,server.getTrainers,server.getCourses,server.getHomework])expect(await load()).toEqual([])});
test("trainer identities and missing photos are never replaced by a different person",async()=>{const trainer={id:"trainer",role:"formateur" as const,prenom:"Original",nom:"Balzaac",email:"original@example.test"};rows=[trainer];expect(await server.getTrainers()).toEqual([trainer]);expect(server.formatDbAvatar(trainer as never)).toBeUndefined()});


test("staff accounts never appear as student registration requests",async()=>{rows=[{id:"admin",role:"directeur",statut_inscription:"en_attente"},{id:"student",role:"etudiant",statut_inscription:"en_attente"}];expect((await server.getPaymentRequests()).map(p=>p.id)).toEqual(["student"])});
