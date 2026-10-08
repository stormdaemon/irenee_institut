import {test,expect,mock,beforeEach} from "bun:test";
let denied=false,body:unknown={},parseError:unknown,checkoutError:unknown,configured=true,called:any;
class RequestBodyError extends Error{constructor(message:string,public status=413){super(message)}}
mock.module("@/lib/api-auth",()=>({authenticateRequest:async()=>denied?{ok:false,response:Response.json({error:"auth"},{status:401})}:{ok:true,user:{id:"user"},context:{}}}));
mock.module("@/lib/request-body",()=>({RequestBodyError,readJsonBodyWithLimit:async()=>{if(parseError!==undefined)throw parseError;return body}}));
mock.module("@/lib/stripe-checkout-response",()=>({
 checkoutAuthenticationFailure:(response:Response)=>response,
 invalidCheckoutRequest:(message="Invalid",status=400)=>({message,status}),
 checkoutFailureResponse:(error:any)=>Response.json({ok:false},{status:error?.status||500}),
 checkoutSuccessResponse:(result:any)=>Response.json(result)
}));
mock.module("@/lib/stripe-checkout-service",()=>({createCheckoutForUser:async(input:any)=>{called=input;if(checkoutError!==undefined)throw checkoutError;return{ok:true,clientSecret:"test_only"}}}));
mock.module("@/lib/postgres",()=>({createServerContext:()=>configured?{}:null}));
mock.module("@/lib/stripe-webhook",()=>({handleStripeWebhookRequest:async(input:any)=>{called=input;return Response.json({ok:true})}}));
const annual=await import("@/app/api/payments/checkout/route");
const library=await import("@/app/api/payments/library/checkout/route");
const webhook=await import("@/app/stripe_webhook/route");
const lite=await import("@/app/stripe_webhook_lite/route");
const req=()=>new Request("https://test.local/api/test",{method:"POST"});
beforeEach(()=>{denied=false;body={amount:"99"};parseError=undefined;checkoutError=undefined;configured=true;called=undefined});
for(const [name,route] of [["annual_pass",annual],["library_membership",library]] as const){
 test(`${name}: authorized checkout forwards the product and current user`,async()=>{const response=await route.POST(req());expect(response.status).toBe(200);expect(await response.json()).toEqual({ok:true,clientSecret:"test_only"});expect(called).toMatchObject({productType:name,user:{id:"user"},body});expect(called.requestId).toMatch(/^[\da-f-]{36}$/)});
 test(`${name}: missing authentication cannot create a payment`,async()=>{denied=true;expect((await route.POST(req())).status).toBe(401);expect(called).toBeUndefined()});
 for(const malformed of [null,[],"text",5])test(`${name}: invalid payload ${JSON.stringify(malformed)}`,async()=>{body=malformed;expect((await route.POST(req())).status).toBe(400);expect(called).toBeUndefined()});
 test(`${name}: bounded parsing preserves its HTTP error status`,async()=>{parseError=new RequestBodyError("large",413);expect((await route.POST(req())).status).toBe(413);expect(called).toBeUndefined()});
 test(`${name}: unexpected parser and provider failures remain failures`,async()=>{parseError=new Error("parse failed");expect((await route.POST(req())).status).toBe(500);parseError=undefined;checkoutError=new Error("provider failed");expect((await route.POST(req())).status).toBe(500)});
}
for(const [name,route,isLite] of [["stripe_webhook",webhook,false],["stripe_webhook_lite",lite,true]] as const){
 test(`${name} exposes health, rejects missing configuration and delegates signed event processing`,async()=>{
  expect(await(await route.GET()).json()).toEqual({ok:true,endpoint:name});configured=false;expect((await route.POST(req())).status).toBe(501);expect(called).toBeUndefined();configured=true;expect((await route.POST(req())).status).toBe(200);expect(called.lite).toBe(isLite);expect(called.request).toBeInstanceOf(Request);
 });
}
