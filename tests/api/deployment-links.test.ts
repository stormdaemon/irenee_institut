import {test,expect} from "bun:test";
process.env.NEXT_PUBLIC_SITE_URL="https://apostolos.example.test";
process.env.GOOGLE_APPS_SCRIPT_URL="https://mailer.example.test";
process.env.GOOGLE_APPS_SCRIPT_WEBHOOK_SECRET="local-test-secret";
const {sendEmailVerification,sendPasswordResetEmail}=await import("../../lib/google-apps-script");
test("verification and recovery emails always return to the configured deployment and protect tokens in fragments",async()=>{
 const original=globalThis.fetch;const sent:any[]=[];
 globalThis.fetch=(async(_input:any,init:any)=>{sent.push(JSON.parse(init.body));return new Response(JSON.stringify({ok:true}))}) as typeof fetch;
 try{for(const send of [sendEmailVerification,sendPasswordResetEmail])await send({email:"student@example.test",token:"one-time-test-token",nextPath:"https://untrusted.example"});
 for(const payload of sent){expect(payload.campaign.body).toContain("https://apostolos.example.test/auth/");expect(payload.campaign.body).toContain("#code=one-time-test-token");expect(payload.campaign.body).not.toContain("untrusted.example");expect(payload.campaign.body).not.toContain("irenee-institut.org");}
 }finally{globalThis.fetch=original}
});
