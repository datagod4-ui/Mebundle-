import {createClient,type SupabaseClient} from "@supabase/supabase-js";
const url=process.env.NEXT_PUBLIC_SUPABASE_URL; const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; let client:SupabaseClient|null=null;
export function getSupabase(){if(!url||!key)throw new Error("Mebundle is not connected yet. Please try again shortly."); if(!client)client=createClient(url,key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}); return client;}
export function getSupabaseConfig(){if(!url||!key)throw new Error("Supabase configuration is missing.");return {url,key};}
