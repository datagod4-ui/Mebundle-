"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, LogOut, Pencil, Plus, RefreshCw, Save, ShieldCheck, X, Zap } from "lucide-react";
import { callEdge, formatGhs } from "@/lib/api";
import { getSupabase } from "@/lib/supabase";

type Order = { id: string; tracking_code: string; bundle_name: string; selling_price: number; payment_status: string; order_status: string };
type Network = { id: string; code: string; display_name: string; is_active: boolean };
type Bundle = {
  id: string; network_id: string; name: string; data_amount_mb: number; validity_label: string | null;
  supplier_product_id: string | null; supplier_cost: number | null; selling_price: number;
  is_available: boolean; is_featured: boolean; display_order: number; networks: { code: string; display_name: string };
};
type BundleForm = {
  network_id: string; name: string; data_amount_mb: string; validity_label: string;
  supplier_product_id: string; supplier_cost: string; selling_price: string;
  is_available: boolean; is_featured: boolean; display_order: string;
};
const emptyForm: BundleForm = {
  network_id: "", name: "", data_amount_mb: "", validity_label: "", supplier_product_id: "",
  supplier_cost: "", selling_price: "", is_available: true, is_featured: false, display_order: "0",
};

export default function AdminPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [networks, setNetworks] = useState<Network[]>([]);
  const [form, setForm] = useState<BundleForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  async function load() {
    setBusy(true); setError("");
    try {
      const { data: { session } } = await getSupabase().auth.getSession();
      if (!session) { router.replace("/admin/login"); return; }
      const data = await callEdge<{ orders: Order[]; bundles: Bundle[]; networks: Network[] }>(
        "mebundle-admin", { query: "?action=overview", token: session.access_token }
      );
      setOrders(data.orders || []);
      setBundles(data.bundles || []);
      setNetworks((data.networks || []).filter((n) => n.is_active));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load admin dashboard.");
    } finally { setBusy(false); }
  }

  useEffect(() => { void load(); }, []);

  async function signOut() {
    await getSupabase().auth.signOut();
    router.replace("/admin/login");
  }

  function startAdd() {
    setEditingId(null);
    setForm({ ...emptyForm, network_id: networks[0]?.id || "" });
    setNotice(""); setError(""); setFormOpen(true);
  }

  function startEdit(bundle: Bundle) {
    setEditingId(bundle.id);
    setForm({
      network_id: bundle.network_id,
      name: bundle.name,
      data_amount_mb: String(bundle.data_amount_mb ?? ""),
      validity_label: bundle.validity_label || "",
      supplier_product_id: bundle.supplier_product_id || "",
      supplier_cost: bundle.supplier_cost == null ? "" : String(bundle.supplier_cost),
      selling_price: String(bundle.selling_price),
      is_available: bundle.is_available,
      is_featured: bundle.is_featured,
      display_order: String(bundle.display_order ?? 0),
    });
    setNotice(""); setError(""); setFormOpen(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function update<K extends keyof BundleForm>(key: K, value: BundleForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function requireAdminToken() {
    const { data: { session } } = await getSupabase().auth.getSession();
    if (!session) throw new Error("Your admin session has expired. Please sign in again.");
    return session.access_token;
  }

  async function saveBundle(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setSaving(true); setError(""); setNotice("");
    try {
      const token = await requireAdminToken();
      const payload = {
        ...form,
        data_amount_mb: Number(form.data_amount_mb),
        selling_price: Number(form.selling_price),
        supplier_cost: form.supplier_cost.trim() === "" ? null : Number(form.supplier_cost),
        display_order: Number(form.display_order || 0),
      };
      if (editingId) {
        await callEdge("mebundle-admin", { method: "PATCH", query: "?action=bundle", body: { id: editingId, ...payload }, token });
        setNotice("Bundle changes saved.");
      } else {
        await callEdge("mebundle-admin", { method: "POST", query: "?action=bundle", body: payload, token });
        setNotice("New bundle added to the catalogue.");
      }
      setFormOpen(false); setEditingId(null); setForm(emptyForm);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save bundle.");
    } finally { setSaving(false); }
  }

  async function toggleAvailability(bundle: Bundle) {
    setError(""); setNotice("");
    try {
      await callEdge("mebundle-admin", {
        method: "PATCH", query: "?action=bundle",
        body: { id: bundle.id, is_available: !bundle.is_available },
        token: await requireAdminToken(),
      });
      setBundles((current) => current.map((item) => item.id === bundle.id ? { ...item, is_available: !item.is_available } : item));
      setNotice(bundle.is_available ? "Bundle is now hidden from customers." : "Bundle is now available to customers.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to update bundle availability.");
    }
  }

  const paid = orders.filter((o) => o.payment_status === "paid").length;

  return (
    <main className="site-shell min-h-screen">
      <header className="container pt-5">
        <nav className="nav-glass flex items-center justify-between rounded-[22px] px-4 py-3">
          <Link href="/" className="flex items-center gap-3">
            <span className="brand-mark"><Zap size={18} /></span>
            <span className="text-xl font-black">me<span className="text-[#21845b]">bundle</span></span>
            <span className="rounded-full bg-[#e9f5ec] px-2 py-1 text-[10px] font-extrabold uppercase text-[#28744f]">Admin</span>
          </Link>
          <button onClick={signOut} className="btn-soft !py-2 text-xs"><LogOut size={14} /> Sign out</button>
        </nav>
      </header>

      <section className="container py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div><p className="eyebrow">Management</p><h1 className="mt-2 text-4xl font-black tracking-[-.06em]">Admin dashboard</h1>
            <p className="mt-2 text-sm text-[#78877e]">Manage bundles, prices and customer orders.</p></div>
          <button onClick={() => void load()} className="btn-soft" disabled={busy}><RefreshCw size={15} /> Refresh</button>
        </div>

        {error && <p className="mt-6 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
        {notice && <p className="mt-4 rounded-xl bg-[#e9f5ec] p-4 text-sm font-semibold text-[#246b49]">{notice}</p>}

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <div className="glass rounded-2xl p-5"><p className="text-xs font-bold text-[#78877e]">Orders loaded</p><p className="mt-2 text-3xl font-black">{orders.length}</p></div>
          <div className="glass rounded-2xl p-5"><p className="text-xs font-bold text-[#78877e]">Paid orders</p><p className="mt-2 text-3xl font-black">{paid}</p></div>
          <div className="glass rounded-2xl p-5"><p className="text-xs font-bold text-[#78877e]">Bundles</p><p className="mt-2 text-3xl font-black">{bundles.length}</p></div>
        </div>

        <section className="glass mt-8 overflow-hidden rounded-[24px]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#dce8df] p-5">
            <div><h2 className="font-extrabold">Bundle catalogue</h2><p className="mt-1 text-xs text-[#849188]">Add bundles, edit prices and control customer availability.</p></div>
            <button onClick={startAdd} className="btn-primary" disabled={!networks.length}><Plus size={16} /> Add bundle</button>
          </div>

          {formOpen && <form onSubmit={saveBundle} className="border-b border-[#dce8df] bg-white/60 p-5 sm:p-6">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div><p className="eyebrow">{editingId ? "Update catalogue" : "New catalogue item"}</p><h3 className="mt-1 text-xl font-black">{editingId ? "Edit bundle" : "Add a bundle"}</h3></div>
              <button type="button" onClick={() => setFormOpen(false)} className="btn-soft !p-2" aria-label="Close form"><X size={17} /></button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <label className="grid gap-1.5 text-xs font-bold text-[#50645a]">Network
                <select className="input-field" value={form.network_id} onChange={(e) => update("network_id", e.target.value)} required>
                  <option value="">Select network</option>{networks.map((n) => <option key={n.id} value={n.id}>{n.display_name}</option>)}
                </select>
              </label>
              <label className="grid gap-1.5 text-xs font-bold text-[#50645a]">Bundle name
                <input className="input-field" value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="e.g. 5GB Data" required />
              </label>
              <label className="grid gap-1.5 text-xs font-bold text-[#50645a]">Data amount (MB)
                <input className="input-field" type="number" min="1" step="1" value={form.data_amount_mb} onChange={(e) => update("data_amount_mb", e.target.value)} placeholder="5000" required />
              </label>
              <label className="grid gap-1.5 text-xs font-bold text-[#50645a]">Validity
                <input className="input-field" value={form.validity_label} onChange={(e) => update("validity_label", e.target.value)} placeholder="e.g. 30 days" />
              </label>
              <label className="grid gap-1.5 text-xs font-bold text-[#50645a]">Selling price (GHS)
                <input className="input-field" type="number" min="0.01" step="0.01" value={form.selling_price} onChange={(e) => update("selling_price", e.target.value)} placeholder="25.00" required />
              </label>
              <label className="grid gap-1.5 text-xs font-bold text-[#50645a]">Supplier cost (GHS)
                <input className="input-field" type="number" min="0" step="0.01" value={form.supplier_cost} onChange={(e) => update("supplier_cost", e.target.value)} placeholder="Optional" />
              </label>
              <label className="grid gap-1.5 text-xs font-bold text-[#50645a]">Supplier product ID
                <input className="input-field" value={form.supplier_product_id} onChange={(e) => update("supplier_product_id", e.target.value)} placeholder="Supplier's exact product code" />
              </label>
              <label className="grid gap-1.5 text-xs font-bold text-[#50645a]">Display order
                <input className="input-field" type="number" step="1" value={form.display_order} onChange={(e) => update("display_order", e.target.value)} />
              </label>
            </div>
            <div className="mt-5 flex flex-wrap gap-5">
              <label className="flex items-center gap-2 text-sm font-semibold text-[#50645a]"><input type="checkbox" checked={form.is_available} onChange={(e) => update("is_available", e.target.checked)} /> Available to customers</label>
              <label className="flex items-center gap-2 text-sm font-semibold text-[#50645a]"><input type="checkbox" checked={form.is_featured} onChange={(e) => update("is_featured", e.target.checked)} /> Feature this bundle</label>
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <button type="submit" className="btn-primary" disabled={saving || !networks.length}><Save size={16} /> {saving ? "Saving..." : editingId ? "Save changes" : "Add bundle"}</button>
              <button type="button" className="btn-soft" onClick={() => setFormOpen(false)}>Cancel</button>
            </div>
          </form>}

          {busy ? <p className="p-6 text-sm text-[#78877e]">Loading catalogue...</p> : bundles.length === 0 ?
            <p className="p-6 text-sm text-[#78877e]">No bundles found. Add your first bundle above.</p> :
            <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">
              {bundles.map((b) => <article key={b.id} className="rounded-2xl border border-[#e0ebe3] bg-white/70 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div><span className="text-xs font-bold text-[#267653]">{b.networks?.display_name || "Network"}</span><h3 className="mt-1 font-extrabold">{b.name}</h3></div>
                  <span className={"rounded-full px-2 py-1 text-[10px] font-bold " + (b.is_available ? "bg-[#e9f5ec] text-[#267653]" : "bg-[#f4eee4] text-[#9a6c35]")}>{b.is_available ? "Available" : "Hidden"}</span>
                </div>
                <div className="mt-3 flex items-end justify-between"><div><p className="text-xs text-[#849188]">{(Number(b.data_amount_mb) / 1000).toLocaleString("en-GH")} GB{b.validity_label ? " · " + b.validity_label : ""}</p><p className="mt-1 text-lg font-black">{formatGhs(b.selling_price)}</p></div>
                  <button onClick={() => startEdit(b)} className="btn-soft !py-2 text-xs"><Pencil size={14} /> Edit</button>
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-[#e6eee8] pt-3">
                  <span className="text-xs text-[#849188]">{b.is_featured ? "Featured" : "Standard"}</span>
                  <button onClick={() => void toggleAvailability(b)} className="text-xs font-bold text-[#267653]">{b.is_available ? "Hide from store" : "Make available"}</button>
                </div>
              </article>)}
            </div>}
        </section>

        <section className="glass mt-6 overflow-hidden rounded-[24px]">
          <div className="flex items-center justify-between border-b border-[#dce8df] p-5"><h2 className="font-extrabold">Recent orders</h2><ShieldCheck size={18} className="text-[#267653]" /></div>
          {busy ? <p className="p-6 text-sm text-[#78877e]">Loading orders...</p> : <div className="overflow-x-auto">
            <table className="w-full min-w-[650px] text-left text-sm"><thead className="bg-white/50 text-[11px] uppercase text-[#849188]"><tr><th className="p-4">Tracking ID</th><th className="p-4">Bundle</th><th className="p-4">Amount</th><th className="p-4">Payment</th><th className="p-4">Delivery</th></tr></thead>
              <tbody>{orders.map((o) => <tr key={o.id} className="border-t border-[#e6eee8]"><td className="p-4 font-bold">{o.tracking_code}</td><td className="p-4">{o.bundle_name}</td><td className="p-4 font-bold">{formatGhs(o.selling_price)}</td><td className="p-4 capitalize">{o.payment_status}</td><td className="p-4 capitalize">{o.order_status.replaceAll("_", " ")}</td></tr>)}
                {!orders.length && <tr><td className="p-5 text-[#849188]" colSpan={5}>No orders yet.</td></tr>}</tbody></table>
          </div>}
        </section>
      </section>
    </main>
  );
}
