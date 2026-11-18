import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const cors = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json"};
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:cors});
const hex=(bytes:Uint8Array)=>Array.from(bytes,b=>b.toString(16).padStart(2,"0")).join("");
async function validSignature(raw:string,signature:string,secret:string){
  const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret.trim()),{name:"HMAC",hash:"SHA-512"},false,["sign"]);
  const expected=hex(new Uint8Array(await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(raw))));
  if(signature.length!==expected.length)return false;
  let diff=0;for(let i=0;i<expected.length;i++)diff|=expected.charCodeAt(i)^signature.toLowerCase().charCodeAt(i);
  return diff===0;
}

async function validModernSignature(raw:string,header:string,secret:string){
  const parts=header.split(",");let timestamp="";const signatures:string[]=[];
  for(const part of parts){const i=part.indexOf("=");if(i<0)continue;const k=part.slice(0,i).trim(),v=part.slice(i+1).trim();if(k==="t")timestamp=v;else if(k==="v1"){const j=v.indexOf(":");if(j>0)signatures.push(v.slice(j+1));}}
  if(!/^\d+$/.test(timestamp)||Math.abs(Math.floor(Date.now()/1000)-Number(timestamp))>300)return false;
  const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret.trim()),{name:"HMAC",hash:"SHA-512"},false,["sign"]);
  const expected=hex(new Uint8Array(await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(timestamp+"."+raw))));
  return signatures.some(sig=>{if(!/^[0-9a-f]{128}$/i.test(sig))return false;let diff=0;for(let i=0;i<128;i++)diff|=expected.charCodeAt(i)^sig.toLowerCase().charCodeAt(i);return diff===0;});
}

async function verifyPaystack(reference:string,secret:string){
  const r=await fetch("https://api.paystack.co/transaction/verify/"+encodeURIComponent(reference),{headers:{Authorization:"Bearer "+secret.trim(),"Cache-Control":"no-cache"},signal:AbortSignal.timeout(20000)});
  const data=await r.json();if(!r.ok||!data.status||data.data?.status!=="success")throw new Error("Paystack has not confirmed this transaction");
  return data.data;
}
async function deliver(db:any,verified:any,reference:string){
  const amount=Number(verified.amount),currency=String(verified.currency||"").toUpperCase();
  if(!Number.isSafeInteger(amount)||amount<=0)throw new Error("Invalid verified payment amount");
  const {data:setting,error:settingError}=await db.from("site_settings").select("value").eq("key","internal_api_secret").eq("is_public",false).maybeSingle();
  if(settingError||!setting?.value?.secret)throw new Error("Payment confirmation is not configured");
  const secret=String(setting.value.secret);
  const {data:order,error}=await db.rpc("confirm_paystack_payment",{p_reference:reference,p_amount_minor:amount,p_currency:currency,p_internal_secret:secret,p_provider_response:verified});
  if(error||!order)throw new Error(error?.message||"Could not record payment confirmation");
  const {data:claim,error:claimError}=await db.rpc("claim_supplier_dispatch",{p_tracking_code:order.tracking_code,p_internal_secret:secret});
  if(claimError)throw new Error("Payment confirmed but supplier dispatch could not be claimed: "+claimError.message);
  if(!claim?.claimed){
    const {data:existing}=await db.from("orders").select("supplier_status,supplier_order_id,order_status").eq("tracking_code",order.tracking_code).maybeSingle();
    return {payment:"confirmed",supplier:"already_processing_or_submitted",tracking_code:order.tracking_code,...existing};
  }
  const apiKey=(Deno.env.get("DATAMART_API_KEY")||Deno.env.get("DATAMARTGH_API_KEY")||"").trim();
  if(!apiKey){
    const message="Datamart API key is not configured (expected DATAMART_API_KEY)";
    await db.rpc("record_supplier_submission",{p_tracking_code:order.tracking_code,p_internal_secret:secret,p_supplier_order_id:null,p_supplier_status:"failed",p_supplier_response:{message}});
    await db.from("supplier_sync_logs").insert({supplier:"datamart",sync_type:"order_delivery",status:"failed",message,details:{tracking_code:order.tracking_code}});
    return {payment:"confirmed",supplier:"configuration_missing",tracking_code:order.tracking_code};
  }
  const networkMap:Record<string,string>={mtn:"YELLO",telecel:"TELECEL",at:"AT_PREMIUM",airteltigo:"AT_PREMIUM"};
  const network=networkMap[String(order.network_code||"").toLowerCase()];
  const number=String(order.recipient_phone||"").replace(/\s+/g,"");
  const capacity=Math.round(Number(order.data_amount_mb)/1024);
  let validationError="";
  if(!network)validationError="Unsupported Datamart network: "+String(order.network_code);
  else if(!/^0\d{9}$/.test(number))validationError="Recipient phone is not a valid Ghanaian 10-digit number";
  else if(!Number.isInteger(capacity)||capacity<1||capacity>100)validationError="Bundle capacity is outside Datamart's supported range";
  if(validationError){
    await db.rpc("record_supplier_submission",{p_tracking_code:order.tracking_code,p_internal_secret:secret,p_supplier_order_id:null,p_supplier_status:"failed",p_supplier_response:{message:validationError}});
    await db.from("supplier_sync_logs").insert({supplier:"datamart",sync_type:"order_delivery",status:"failed",message:validationError,details:{tracking_code:order.tracking_code}});
    return {payment:"confirmed",supplier:"validation_failed",tracking_code:order.tracking_code,message:validationError};
  }
  const idempotencyKey="mebundle-"+String(order.tracking_code);
  const response=await fetch("https://api.datamartgh.shop/api/developer/purchase",{method:"POST",headers:{"X-API-Key":apiKey,"X-Idempotency-Key":idempotencyKey,"Content-Type":"application/json","Accept":"application/json"},body:JSON.stringify({phoneNumber:number,network,capacity:String(capacity),gateway:"wallet"}),signal:AbortSignal.timeout(35000)});
  const raw=await response.text();let payload:any;try{payload=JSON.parse(raw)}catch{payload={message:raw.slice(0,500)}}
  const accepted=response.ok&&String(payload?.status||"").toLowerCase()==="success";
  const data=payload?.data||{};
  const purchaseId=data.orderId||data.purchaseId||data.reference||data.orderReference||data.transactionId||data.transactionReference||null;
  const apiOrderStatus=String(data.orderStatus||"").toLowerCase();
  const supplierStatus=accepted?(apiOrderStatus==="completed"?"completed":apiOrderStatus==="failed"?"failed":"processing"):"failed";
  const save=await db.rpc("record_supplier_submission",{p_tracking_code:order.tracking_code,p_internal_secret:secret,p_supplier_order_id:purchaseId?String(purchaseId):null,p_supplier_status:supplierStatus,p_supplier_response:{http_status:response.status,...payload}});
  await db.from("supplier_sync_logs").insert({supplier:"datamart",sync_type:"order_delivery",status:accepted?"success":"failed",message:accepted?"Datamart accepted purchase request":String(payload?.message||"Datamart rejected purchase request").slice(0,500),details:{tracking_code:order.tracking_code,http_status:response.status,purchase_id:purchaseId,network,capacity}});
  if(save.error)throw new Error("Datamart responded but Mebundle could not save the supplier result");
  if(accepted&&supplierStatus==="completed")await db.from("orders").update({order_status:"completed",fulfilled_at:new Date().toISOString(),failure_reason:null}).eq("tracking_code",order.tracking_code);
  if(!accepted)return {payment:"confirmed",supplier:"rejected",tracking_code:order.tracking_code,http_status:response.status,message:payload?.message||"Datamart rejected order"};
  return {payment:"confirmed",supplier:supplierStatus,tracking_code:order.tracking_code,supplier_order_id:purchaseId};

}
Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  if(req.method!=="POST")return reply({error:"Method not allowed"},405);
  const paystackSecret=Deno.env.get("PAYSTACK_SECRET_KEY");
  const supabaseUrl=Deno.env.get("SUPABASE_URL"),serviceRole=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(!paystackSecret||!supabaseUrl||!serviceRole)return reply({error:"Payment service is not configured"},503);
  const url=new URL(req.url),action=url.searchParams.get("action")||"webhook";
  try{
    let reference="",verified:any;
    if(action==="verify"){
      const body=await req.json();reference=String(body.reference||"").trim();
      if(!reference||reference.length>120)return reply({error:"A valid payment reference is required"},400);
      verified=await verifyPaystack(reference,paystackSecret);
    }else{
      const raw=await req.text();
      // Paystack endpoint ping is a non-transactional health check; acknowledge it without dispatching.
      let pingBody:any=null;try{pingBody=JSON.parse(raw)}catch{}
      if(pingBody?.event==="ping")return reply({received:true,ping:true});
      const modernHeader=req.headers.get("paystack-signature")||"";
      const legacyHeader=(req.headers.get("x-paystack-signature")||"").trim();
      let signatureValid=false;
      // During Paystack's signing-secret transition, both signature headers may be present.
      // Validate the new Paystack-Signature with the webhook signing secret first,
      // then fall back to the still-active legacy x-paystack-signature with the API secret.
      const webhookSecret=(Deno.env.get("PAYSTACK_WEBHOOK_SECRET")||"").trim();
      if(modernHeader && webhookSecret){
        signatureValid=await validModernSignature(raw,modernHeader,webhookSecret);
      }
      if(!signatureValid && legacyHeader){
        signatureValid=await validSignature(raw,legacyHeader,paystackSecret);
      }
      if(!signatureValid)return reply({error:"Invalid Paystack signature. Configure PAYSTACK_WEBHOOK_SECRET for the new Paystack signature format."},401);
      let event:any;try{event=JSON.parse(raw)}catch{return reply({error:"Invalid JSON"},400)}
      if(event.event==="ping")return reply({received:true,ping:true});
      if(event.event!=="charge.success")return reply({received:true,ignored:event.event||"unknown"});
      reference=String(event.data?.reference||"").trim();if(!reference)return reply({error:"Missing transaction reference"},400);
      verified=await verifyPaystack(reference,paystackSecret);
    }
    const db=createClient(supabaseUrl,serviceRole,{auth:{persistSession:false,autoRefreshToken:false}});
    const result=await deliver(db,verified,reference);
    return reply({received:true,...result});
  }catch(e){
    const message=e instanceof Error?e.message:"Payment processing failed";
    console.error("Mebundle payment processing error:",message);
    return reply({error:message},500);
  }
});