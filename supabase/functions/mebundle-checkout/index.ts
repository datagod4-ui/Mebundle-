import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json"};
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:cors});
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return reply({error:"Method not allowed"},405);
 try{
  const supabaseUrl=Deno.env.get("SUPABASE_URL")!,serviceRole=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,paystackSecret=Deno.env.get("PAYSTACK_SECRET_KEY");
  if(!supabaseUrl||!serviceRole||!paystackSecret)return reply({error:"Checkout is not configured"},503);
  const body=await req.json(),bundleId=String(body.bundle_id||""),storeSlug=String(body.store_slug||"").toLowerCase().replace(/[^a-z0-9-]/g,""),customerName=String(body.customer_name||"").trim().slice(0,120),customerPhone=String(body.customer_phone||"").replace(/\s+/g,""),recipientPhone=String(body.recipient_phone||"").replace(/\s+/g,"");
  if(!bundleId||!/^0\d{9}$/.test(customerPhone)||!/^0\d{9}$/.test(recipientPhone))return reply({error:"Enter valid Ghanaian 10-digit phone numbers and select a bundle."},400);
  const db=createClient(supabaseUrl,serviceRole,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:bundle,error:bundleError}=await db.from("bundles").select("id,name,data_amount_mb,validity_label,selling_price,network_id,is_available,networks(code,display_name,is_active)").eq("id",bundleId).eq("is_available",true).maybeSingle();
  if(bundleError||!bundle||!bundle.networks?.is_active)return reply({error:"This bundle is no longer available. Please refresh and choose another."},409);
  const networkCode=String(bundle.networks.code);
  let customerPrice=Number(bundle.selling_price),resellerProfile:any=null,resellerWholesale:number|null=null;
  if(storeSlug){
    const {data:store,error:storeError}=await db.from("reseller_profiles").select("id,store_slug,status").eq("store_slug",storeSlug).eq("status","approved").maybeSingle();
    if(storeError||!store)return reply({error:"This reseller store is not available."},404);
    resellerProfile=store;
    const {data:price,error:priceError}=await db.from("reseller_bundle_prices").select("wholesale_price,selling_price").eq("reseller_id",store.id).eq("bundle_id",bundle.id).maybeSingle();
    if(priceError||!price)return reply({error:"This bundle is not available in this reseller store."},409);
    customerPrice=Number(price.selling_price);resellerWholesale=Number(price.wholesale_price);
    if(!Number.isFinite(customerPrice)||customerPrice<resellerWholesale)return reply({error:"This reseller price is not valid."},409);
  }
  const reference="MB"+crypto.randomUUID().replaceAll("-","").toUpperCase();
  const orderRow:any={customer_name:customerName||null,customer_phone:customerPhone,recipient_phone:recipientPhone,network_code:networkCode,bundle_id:bundle.id,bundle_name:bundle.name,data_amount_mb:bundle.data_amount_mb,validity_label:bundle.validity_label,selling_price:customerPrice,payment_status:"pending",order_status:"awaiting_payment"};
  if(resellerProfile){orderRow.reseller_id=resellerProfile.id;orderRow.reseller_store_slug=resellerProfile.store_slug;orderRow.reseller_customer_price=customerPrice;orderRow.reseller_wholesale_price=resellerWholesale;orderRow.reseller_earning=Number((customerPrice-resellerWholesale!).toFixed(2));}
  const {data:order,error:orderError}=await db.from("orders").insert(orderRow).select("id,tracking_code").single();
  if(orderError||!order)throw new Error("Could not create your order. Please try again.");
  const {error:paymentError}=await db.from("payments").insert({order_id:order.id,provider:"paystack",provider_reference:reference,amount:customerPrice,currency:"GHS",status:"pending"});
  if(paymentError){await db.from("orders").delete().eq("id",order.id);throw new Error("Could not prepare payment. Please try again.");}
  const siteUrl="https://mebundle.vercel.app";
  const callbackUrl=siteUrl+"/payment/callback?reference="+encodeURIComponent(reference)+"&tracking_code="+encodeURIComponent(order.tracking_code);
  const init=await fetch("https://api.paystack.co/transaction/initialize",{method:"POST",headers:{Authorization:"Bearer "+paystackSecret,"Content-Type":"application/json"},body:JSON.stringify({email:customerPhone+"@checkout.mebundle.gh",amount:Math.round(customerPrice*100),currency:"GHS",reference,callback_url:callbackUrl,metadata:{order_id:order.id,tracking_code:order.tracking_code,recipient_phone:recipientPhone,network:networkCode,bundle:bundle.name}})});
  const payload=await init.json();
  if(!init.ok||!payload.status||!payload.data?.authorization_url){await db.from("payments").update({status:"failed",provider_response:payload}).eq("provider_reference",reference);await db.from("orders").update({payment_status:"failed",order_status:"failed",failure_reason:"Payment initialization failed"}).eq("id",order.id);return reply({error:payload.message||"Unable to start payment. Please try again."},502);}
  await db.from("payments").update({checkout_url:payload.data.authorization_url,provider_response:{initialization:{status:true}}}).eq("provider_reference",reference);
  return reply({authorization_url:payload.data.authorization_url,reference,tracking_code:order.tracking_code,amount:customerPrice});
 }catch(e){console.error("Checkout error",e);return reply({error:e instanceof Error?e.message:"Checkout could not be completed."},500);}
});