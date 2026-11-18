import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
const headers={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json"};
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS") return new Response("ok",{headers});
 if(req.method!=="POST" && req.method!=="GET") return reply({error:"Method not allowed"},405);
 try {
  const url=Deno.env.get("SUPABASE_URL"), key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(!url||!key) return reply({error:"Service unavailable"},503);
  const body=req.method==="GET"?Object.fromEntries(new URL(req.url).searchParams):await req.json(), reference=String(body.reference||body.trxref||"").trim(), trackingCode=String(body.tracking_code||"").trim();
  if((!reference&&!trackingCode)||reference.length>120||trackingCode.length>80) return reply({error:"A valid payment reference or tracking code is required"},400);
  const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  let lookup=db.from("payments").select("status,provider_reference,provider_response,orders!inner(tracking_code,order_status,payment_status)");
  lookup=reference?lookup.eq("provider_reference",reference):lookup.eq("orders.tracking_code",trackingCode);
  let {data,error}=await lookup.maybeSingle();
  if(error) throw error;
  if(!data) return reply({error:"Payment reference not found"},404);
  // The browser callback also polls this endpoint. If the webhook was missed,
  // verify the payment directly with Paystack and dispatch through the same
  // idempotent supplier-claim path used by the webhook.
  if(data.status!=="success") {
    const verifiedReference=String(data.provider_reference||reference);
    const previous=Date.parse(String(data.provider_response?.recovery_check_at||""));
    if(!Number.isFinite(previous)||Date.now()-previous>15000) {
      const nextResponse={...(data.provider_response||{}),recovery_check_at:new Date().toISOString()};
      await db.from("payments").update({provider_response:nextResponse}).eq("provider_reference",verifiedReference).eq("status","pending");
      try {
        const recovery=await fetch(url.replace(/\/$/,"")+"/functions/v1/mebundle-payment?action=verify",{
          method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+key,"apikey":key},
          body:JSON.stringify({reference:verifiedReference}),signal:AbortSignal.timeout(45000)
        });
        if(!recovery.ok) console.error("Payment recovery verification returned",recovery.status);
      } catch(e) { console.error("Payment recovery request failed",e); }
      const refreshed=await db.from("payments").select("status,provider_reference,provider_response,orders(tracking_code,order_status,payment_status)").eq("provider_reference",verifiedReference).maybeSingle();
      if(refreshed.error) throw refreshed.error;
      data=refreshed.data||data;
    }
  }
  const order=Array.isArray(data.orders)?data.orders[0]:data.orders;
  return reply({payment_status:data.status,status:data.status,order_status:order?.order_status||"awaiting_payment",tracking_code:order?.tracking_code||null,reference:data.provider_reference,verified:data.status==="success"});
 } catch(e) { console.error("Payment status error",e); return reply({error:"Unable to check payment status"},500); }
});