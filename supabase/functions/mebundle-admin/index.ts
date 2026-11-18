import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const cors = { "Access-Control-Allow-Origin":"*", "Access-Control-Allow-Headers":"authorization, apikey, content-type", "Access-Control-Allow-Methods":"GET,POST,PATCH,DELETE,OPTIONS", "Content-Type":"application/json" };
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:cors});
Deno.serve(async (req)=>{
 if(req.method==="OPTIONS") return new Response("ok",{headers:cors});
 try {
  const url=Deno.env.get("SUPABASE_URL")!;
  const anon=Deno.env.get("SUPABASE_ANON_KEY")!;
  const service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const token=(req.headers.get("Authorization")||"").replace(/^Bearer /i,"");
  if(!token) return reply({error:"Authentication required"},401);
  const authClient=createClient(url,anon,{global:{headers:{Authorization:"Bearer "+token}}});
  const {data:{user},error:authErr}=await authClient.auth.getUser(token);
  if(authErr||!user) return reply({error:"Session expired. Sign in again."},401);
  const db=createClient(url,service,{auth:{persistSession:false}});
  const {data:admin,error:adminErr}=await db.from("admin_users").select("role,is_active").eq("user_id",user.id).maybeSingle();
  if(adminErr||!admin?.is_active||!["admin","super_admin"].includes(admin.role)) return reply({error:"Admin access denied"},403);
  const u=new URL(req.url), action=u.searchParams.get("action");
  if(req.method==="GET" && action==="overview"){
    const [orders,bundles,networks]=await Promise.all([
      db.from("orders").select("*").order("created_at",{ascending:false}).limit(100),
      db.from("bundles").select("*,networks(code,display_name)").order("display_order"),
      db.from("networks").select("*").order("sort_order")
    ]);
    if(orders.error||bundles.error||networks.error) throw orders.error||bundles.error||networks.error;
    return reply({orders:orders.data,bundles:bundles.data,networks:networks.data});
  }
  if(req.method==="POST" && action==="bundle"){
    const b=await req.json();
    const row={network_id:b.network_id,name:String(b.name||"").trim(),data_amount_mb:Number(b.data_amount_mb),validity_label:b.validity_label||null,supplier_product_id:b.supplier_product_id==null||String(b.supplier_product_id).trim()===""?null:String(b.supplier_product_id).trim(),supplier_cost:b.supplier_cost===""||b.supplier_cost==null?null:Number(b.supplier_cost),selling_price:Number(b.selling_price),is_available:b.is_available!==false,is_featured:!!b.is_featured,display_order:Number(b.display_order||0),supplier_metadata:{}};
    if(!row.network_id||!row.name||!Number.isFinite(row.data_amount_mb)||row.data_amount_mb<=0||!Number.isFinite(row.selling_price)||row.selling_price<=0||(row.supplier_cost!==null&&!Number.isFinite(row.supplier_cost))) return reply({error:"Enter a network, bundle name, data size and valid selling price."},400);
    const {data,error}=await db.from("bundles").insert(row).select().single(); if(error) throw error; return reply({bundle:data});
  }
  if(req.method==="PATCH" && action==="bundle"){
    const b=await req.json(); const {id,...patch}=b;
    if(!id) return reply({error:"Bundle id required"},400);
    const allowed=["network_id","name","data_amount_mb","validity_label","supplier_product_id","supplier_cost","selling_price","is_available","is_featured","display_order"];
    const clean=Object.fromEntries(Object.entries(patch).filter(([k])=>allowed.includes(k)));
    if("supplier_product_id" in clean) clean.supplier_product_id=clean.supplier_product_id==null||String(clean.supplier_product_id).trim()===""?null:String(clean.supplier_product_id).trim();
    if("supplier_cost" in clean) clean.supplier_cost=clean.supplier_cost===""||clean.supplier_cost==null?null:Number(clean.supplier_cost);
    for(const k of ["data_amount_mb","selling_price","display_order"]) if(k in clean) clean[k]=clean[k]===""||clean[k]==null?null:Number(clean[k]);
    if("name" in clean) clean.name=String(clean.name??"").trim();
    if("supplier_cost" in clean && clean.supplier_cost!==null && !Number.isFinite(clean.supplier_cost)) return reply({error:"Supplier cost must be a valid number or left blank."},400);
    if("selling_price" in clean && (!Number.isFinite(clean.selling_price)||clean.selling_price<=0)) return reply({error:"Selling price must be greater than zero."},400);
    if("data_amount_mb" in clean && (!Number.isFinite(clean.data_amount_mb)||clean.data_amount_mb<=0)) return reply({error:"Data size must be greater than zero."},400);
    const {data,error}=await db.from("bundles").update(clean).eq("id",id).select().single(); if(error) throw error; return reply({bundle:data});
  }
  if(req.method==="DELETE" && action==="bundle"){
    const id=u.searchParams.get("id"); if(!id) return reply({error:"Bundle id required"},400);
    const {error}=await db.from("bundles").delete().eq("id",id); if(error) throw error; return reply({ok:true});
  }
  if(req.method==="PATCH" && action==="order"){
    const b=await req.json(); const allowed=["order_status","failure_reason"];
    const patch=Object.fromEntries(Object.entries(b).filter(([k])=>allowed.includes(k)));
    const {data,error}=await db.from("orders").update(patch).eq("id",b.id).select().single(); if(error) throw error; return reply({order:data});
  }
  if(req.method==="GET" && action==="resellers"){
    const [profiles,wholesale,withdrawals,prices]=await Promise.all([
      db.from("reseller_profiles").select("*").order("created_at",{ascending:false}),
      db.from("reseller_wholesale_prices").select("*,bundles(id,name,data_amount_mb,networks(code,display_name))"),
      db.from("reseller_withdrawals").select("*").order("requested_at",{ascending:false}).limit(200),
      db.from("reseller_bundle_prices").select("*,bundles(id,name,data_amount_mb,networks(code,display_name))")
    ]);
    for(const q of [profiles,wholesale,withdrawals,prices]) if(q.error) throw q.error;
    return reply({resellers:profiles.data,wholesale_prices:wholesale.data,withdrawals:withdrawals.data,reseller_prices:prices.data});
  }
  if(req.method==="POST" && action==="reseller-status"){
    const b=await req.json(),id=String(b.reseller_id||""),status=String(b.status||"");
    if(!id||!["pending","approved","suspended","rejected"].includes(status)) return reply({error:"Choose a reseller and valid account status."},400);
    const patch:any={status};
    if(status==="approved"){patch.approved_at=new Date().toISOString();patch.approved_by=user.id;}
    const {data:profile,error}=await db.from("reseller_profiles").update(patch).eq("id",id).select().single();
    if(error) throw error;
    if(status==="approved"){
      const {data:wholesale,error:wholesaleError}=await db.from("reseller_wholesale_prices").select("bundle_id,wholesale_price");
      if(wholesaleError) throw wholesaleError;
      if(wholesale?.length){
        const {data:existing,error:existingError}=await db.from("reseller_bundle_prices").select("bundle_id,selling_price").eq("reseller_id",id);
        if(existingError) throw existingError;
        const old=new Map((existing||[]).map((x:any)=>[x.bundle_id,Number(x.selling_price)]));
        const rows=wholesale.map((x:any)=>({reseller_id:id,bundle_id:x.bundle_id,wholesale_price:x.wholesale_price,selling_price:Math.max(Number(x.wholesale_price),old.get(x.bundle_id)||Number(x.wholesale_price)),updated_by:user.id,updated_at:new Date().toISOString()}));
        const {error:upsertError}=await db.from("reseller_bundle_prices").upsert(rows,{onConflict:"reseller_id,bundle_id"});
        if(upsertError) throw upsertError;
      }
    }
    await db.from("admin_audit_logs").insert({admin_user_id:user.id,action:"reseller_status_"+status,entity_type:"reseller",entity_id:id,details:{status}});
    return reply({reseller:profile});
  }
  if(req.method==="POST" && action==="reseller-wholesale-price"){
    const b=await req.json(),bundleId=String(b.bundle_id||""),wholesalePrice=Number(b.wholesale_price);
    if(!bundleId||!Number.isFinite(wholesalePrice)||wholesalePrice<0) return reply({error:"Enter a valid bundle and wholesale price."},400);
    const {data:bundle,error:bundleError}=await db.from("bundles").select("id").eq("id",bundleId).maybeSingle();
    if(bundleError||!bundle) return reply({error:"Bundle not found."},404);
    const {error:globalError}=await db.from("reseller_wholesale_prices").upsert({bundle_id:bundleId,wholesale_price:wholesalePrice,updated_by:user.id,updated_at:new Date().toISOString()},{onConflict:"bundle_id"});
    if(globalError) throw globalError;
    const {data:profiles,error:profilesError}=await db.from("reseller_profiles").select("id").eq("status","approved");
    if(profilesError) throw profilesError;
    if(profiles?.length){
      const ids=profiles.map((x:any)=>x.id);
      const {data:old,error:oldError}=await db.from("reseller_bundle_prices").select("reseller_id,selling_price").eq("bundle_id",bundleId).in("reseller_id",ids);
      if(oldError) throw oldError;
      const oldMap=new Map((old||[]).map((x:any)=>[x.reseller_id,Number(x.selling_price)]));
      const rows=profiles.map((x:any)=>({reseller_id:x.id,bundle_id:bundleId,wholesale_price:wholesalePrice,selling_price:Math.max(wholesalePrice,oldMap.get(x.id)||wholesalePrice),updated_by:user.id,updated_at:new Date().toISOString()}));
      const {error:upsertError}=await db.from("reseller_bundle_prices").upsert(rows,{onConflict:"reseller_id,bundle_id"});
      if(upsertError) throw upsertError;
    }
    await db.from("admin_audit_logs").insert({admin_user_id:user.id,action:"reseller_wholesale_price_updated",entity_type:"bundle",entity_id:bundleId,details:{wholesale_price:wholesalePrice}});
    return reply({ok:true,bundle_id:bundleId,wholesale_price:wholesalePrice,updated_resellers:profiles?.length||0});
  }
  if(req.method==="POST" && action==="reseller-withdrawal"){
    const b=await req.json(),withdrawalId=String(b.withdrawal_id||""),status=String(b.status||"");
    if(!withdrawalId||!["approved","paid","rejected"].includes(status)) return reply({error:"Choose a withdrawal and valid action."},400);
    const {data:setting,error:settingError}=await db.from("site_settings").select("value").eq("key","internal_api_secret").eq("is_public",false).maybeSingle();
    if(settingError||!setting?.value?.secret) throw new Error("Withdrawal service is not configured.");
    const {data,error}=await db.rpc("admin_process_reseller_withdrawal",{p_withdrawal_id:withdrawalId,p_status:status,p_payout_reference:String(b.payout_reference||""),p_admin_note:String(b.admin_note||""),p_internal_secret:String(setting.value.secret)});
    if(error) return reply({error:error.message},400);
    await db.from("admin_audit_logs").insert({admin_user_id:user.id,action:"reseller_withdrawal_"+status,entity_type:"reseller_withdrawal",entity_id:withdrawalId,details:{status,payout_reference:b.payout_reference||null}});
    return reply({withdrawal:data});
  }
  return reply({error:"Unknown action"},404);
 } catch(e){ console.error(e); return reply({error:e instanceof Error?e.message:"Unexpected server error"},500); }
});