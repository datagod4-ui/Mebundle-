"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Store, Zap } from "lucide-react";
import { callEdge } from "@/lib/api";

export default function ResellerRegisterPage() {
  const [form,setForm]=useState({full_name:"",email:"",password:"",phone:"",store_name:"",store_slug:""});
  const [error,setError]=useState(""); const [busy,setBusy]=useState(false); const router=useRouter();
  const update=(key:keyof typeof form,value:string)=>setForm(v=>({...v,[key]:value}));
  async function submit(e:React.FormEvent){e.preventDefault();setBusy(true);setError("");try{await callEdge("mebundle-reseller",{method:"POST",query:"?action=register",body:form});router.push("/reseller/login?registered=1");}catch(e){setError(e instanceof Error?e.message:"Could not submit application.");}finally{setBusy(false);}}
  return <main className="site-shell min-h-screen"><header className="container pt-5"><Link href="/" className="inline-flex items-center gap-3"><span className="brand-mark"><Zap size={18}/></span><span className="text-xl font-black">me<span className="text-[#21845b]">bundle</span></span></Link></header><section className="container flex justify-center py-12"><div className="glass w-full max-w-[560px] rounded-[28px] p-7 sm:p-9"><span className="brand-mark"><Store size={18}/></span><p className="eyebrow mt-5">Grow with Mebundle</p><h1 className="mt-2 text-3xl font-black">Create your reseller store.</h1><p className="mt-2 text-sm text-[#78877e]">Submit your details. Your store goes live after admin approval.</p><form onSubmit={submit} className="mt-7 grid gap-4 sm:grid-cols-2">
<label className="grid gap-1.5 text-xs font-bold text-[#50645a]">Full name<input className="input-field" value={form.full_name} onChange={e=>update("full_name",e.target.value)} required/></label>
<label className="grid gap-1.5 text-xs font-bold text-[#50645a]">Email<input className="input-field" type="email" value={form.email} onChange={e=>update("email",e.target.value)} required/></label>
<label className="grid gap-1.5 text-xs font-bold text-[#50645a]">Password (10+ characters)<input className="input-field" type="password" minLength={10} value={form.password} onChange={e=>update("password",e.target.value)} required/></label>
<label className="grid gap-1.5 text-xs font-bold text-[#50645a]">Ghana phone number<input className="input-field" inputMode="numeric" maxLength={10} placeholder="0240000000" value={form.phone} onChange={e=>update("phone",e.target.value)} required/></label>
<label className="grid gap-1.5 text-xs font-bold text-[#50645a] sm:col-span-2">Store name<input className="input-field" value={form.store_name} onChange={e=>update("store_name",e.target.value)} required/></label>
<label className="grid gap-1.5 text-xs font-bold text-[#50645a] sm:col-span-2">Store link name<input className="input-field" value={form.store_slug} onChange={e=>update("store_slug",e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,"-"))} placeholder="my-store" required/><span className="font-normal text-[#8a9890]">mebundle.vercel.app/store/{form.store_slug||"your-store"}</span></label>
{error&&<p className="rounded-xl bg-red-50 p-3 text-sm text-red-700 sm:col-span-2">{error}</p>}
<button className="btn-primary w-full sm:col-span-2" disabled={busy}>{busy?"Submitting application...":"Create reseller account"}</button></form><p className="mt-5 text-center text-sm text-[#78877e]">Already registered? <Link href="/reseller/login" className="font-bold text-[#18714e]">Sign in</Link></p></div></section></main>;
}