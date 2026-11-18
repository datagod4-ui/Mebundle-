import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json"};
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:cors});
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS") return new Response("ok",{headers:cors});
 if(req.method!=="POST") return reply({error:"Method not allowed"},405);
 try{
  const {tracking_code,phone}=await req.json();
  const code=String(tracking_code||"").trim().toUpperCase();
  const number=String(phone||"").replace(/\s+/g,"");
  if(!code||!/^0\d{9}$/.test(number)) return reply({error:"Enter your order ID and the recipient phone number."},400);
  const db=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{persistSession:false}});
  const {data,error}=await db.from("orders").select("tracking_code,network_code,bundle_name,data_amount_mb,validity_label,recipient_phone,payment_status,order_status,supplier_status,failure_reason,created_at,paid_at,fulfilled_at").eq("tracking_code",code).eq("recipient_phone",number).maybeSingle();
  if(error) throw error;
  if(!data) return reply({error:"We couldn't find an order matching those details."},404);
  return reply({order:data});
 }catch(e){console.error("Tracking lookup error",e);return reply({error:"We couldn't retrieve this order right now."},500);}
});