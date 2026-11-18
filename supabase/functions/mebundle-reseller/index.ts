import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "GET,POST,PATCH,OPTIONS",
  "Content-Type": "application/json",
};
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: cors });

const slugify = (value: string) =>
  value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (!["GET", "POST", "PATCH"].includes(req.method)) return reply({ error: "Method not allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL") || "";
  const anon = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!url || !anon || !service) return reply({ error: "Reseller service is not configured" }, 503);

  const db = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });

  const requestUrl = new URL(req.url);
  const action = requestUrl.searchParams.get("action") || "";

  // Public host resolver used by the Next.js proxy for connected custom storefront domains.
  if (req.method === "GET" && action === "resolve-domain") {
    const host = (requestUrl.searchParams.get("host") || "").toLowerCase().replace(/:\\d+$/, "");
    if (!host || host.length > 253) return reply({ error: "Storefront not found" }, 404);
    const { data: domainRow, error: domainError } = await db.from("reseller_custom_domains")
      .select("domain,reseller_id,reseller_profiles!inner(store_slug,status)")
      .eq("domain", host).eq("status", "active").eq("reseller_profiles.status", "approved").maybeSingle();
    if (domainError) throw domainError;
    if (!domainRow) return reply({ error: "Storefront not found" }, 404);
    return reply({ slug: (domainRow as any).reseller_profiles.store_slug });
  }


  try {
    if (req.method === "GET" && action === "catalog") {
      const { data, error } = await db.from("bundles")
        .select("id,name,data_amount_mb,validity_label,selling_price,is_available,is_featured,display_order,networks(code,display_name,is_active)")
        .eq("is_available", true).order("display_order").order("selling_price");
      if (error) throw error;
      const bundles = (data || []).filter((b: any) => b.networks?.is_active).map((b: any) => ({
        id: b.id, name: b.name, data_amount_mb: b.data_amount_mb, validity_label: b.validity_label,
        selling_price: b.selling_price, is_featured: b.is_featured, network_code: b.networks.code,
        network_name: b.networks.display_name,
      }));
      return reply({ bundles });
    }

    if (req.method === "GET" && action === "store") {
      const slug = slugify(new URL(req.url).searchParams.get("slug") || "");
      if (!slug) return reply({ error: "Store not found" }, 404);
      const { data: profile } = await db.from("reseller_profiles")
        .select("id,store_name,store_slug,status").eq("store_slug", slug).eq("status", "approved").maybeSingle();
      if (!profile) return reply({ error: "This reseller store is not available" }, 404);
      const { data: prices, error } = await db.from("reseller_bundle_prices")
        .select("bundle_id,selling_price,bundles(id,name,data_amount_mb,validity_label,is_available,networks(code,display_name,is_active))")
        .eq("reseller_id", profile.id);
      if (error) throw error;
      const bundles = (prices || []).filter((p: any) => p.bundles?.is_available && p.bundles?.networks?.is_active)
        .map((p: any) => ({
          id: p.bundle_id, name: p.bundles.name, data_amount_mb: p.bundles.data_amount_mb,
          validity_label: p.bundles.validity_label, network_code: p.bundles.networks.code,
          network_name: p.bundles.networks.display_name, selling_price: p.selling_price,
        }));
      return reply({ store: { name: profile.store_name, slug: profile.store_slug }, bundles });
    }

    if (req.method === "POST" && action === "register") {
      const body = await req.json();
      const email = String(body.email || "").trim().toLowerCase();
      const password = String(body.password || "");
      const fullName = String(body.full_name || "").trim().slice(0, 120);
      const phone = String(body.phone || "").replace(/\s/g, "");
      const storeName = String(body.store_name || "").trim().slice(0, 80);
      const slug = slugify(String(body.store_slug || storeName));
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 10 ||
          !fullName || !/^0\d{9}$/.test(phone) || !storeName || slug.length < 3) {
        return reply({ error: "Enter a valid name, email, password (at least 10 characters), Ghana phone number and store name." }, 400);
      }
      const [{ data: emailMatch }, { data: slugMatch }] = await Promise.all([
        db.from("reseller_profiles").select("id").ilike("email", email).limit(1),
        db.from("reseller_profiles").select("id").eq("store_slug", slug).limit(1),
      ]);
      if (emailMatch?.length || slugMatch?.length) return reply({ error: "That email or store link is already registered." }, 409);
      const { data: created, error: createError } = await db.auth.admin.createUser({
        email, password, email_confirm: true, user_metadata: { full_name: fullName },
      });
      if (createError || !created.user) return reply({ error: createError?.message || "Could not create account." }, 400);
      const { error: profileError } = await db.from("reseller_profiles").insert({
        id: created.user.id, full_name: fullName, email, phone, store_name: storeName, store_slug: slug, status: "pending",
      });
      if (profileError) {
        await db.auth.admin.deleteUser(created.user.id);
        if (profileError.code === "23505") return reply({ error: "That email or store link is already registered." }, 409);
        throw profileError;
      }
      return reply({ registered: true, status: "pending", message: "Your reseller application has been received. You can sign in after creating your account; selling starts after admin approval." }, 201);
    }

    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) return reply({ error: "Sign in to continue." }, 401);
    const authClient = createClient(url, anon, { global: { headers: { Authorization: "Bearer " + token } } });
    const { data: { user }, error: authError } = await authClient.auth.getUser(token);
    if (authError || !user) return reply({ error: "Session expired. Sign in again." }, 401);
    const { data: profile, error: profileError } = await db.from("reseller_profiles")
      .select("*").eq("id", user.id).maybeSingle();
    if (profileError) throw profileError;
    if (!profile) return reply({ error: "Reseller account not found." }, 404);

    if (req.method === "GET" && action === "dashboard") {
      const [prices, orders, ledger, withdrawals, domains] = await Promise.all([
        db.from("reseller_bundle_prices").select("bundle_id,wholesale_price,selling_price,updated_at,bundles(id,name,data_amount_mb,validity_label,is_available,networks(code,display_name))").eq("reseller_id", user.id),
        db.from("orders").select("id,tracking_code,recipient_phone,bundle_name,selling_price,order_status,payment_status,created_at,fulfilled_at").eq("reseller_id", user.id).order("created_at", { ascending: false }).limit(100),
        db.from("reseller_wallet_transactions").select("id,transaction_type,amount,description,created_at,order_id,withdrawal_id").eq("reseller_id", user.id).order("created_at", { ascending: false }).limit(200),
        db.from("reseller_withdrawals").select("id,amount,momo_network,momo_number,status,payout_reference,admin_note,requested_at,processed_at").eq("reseller_id", user.id).order("requested_at", { ascending: false }).limit(100),
        db.from("reseller_custom_domains").select("id,domain,status,verification_token,verified_at,connected_at,dns_instructions,created_at").eq("reseller_id", user.id).order("created_at", { ascending: false }),
      ]);
      for (const q of [prices, orders, ledger, withdrawals, domains]) if (q.error) throw q.error;
      const balance = (ledger.data || []).reduce((sum: number, row: any) => sum + Number(row.amount), 0);
      return reply({ profile: { full_name: profile.full_name, email: profile.email, phone: profile.phone, store_name: profile.store_name, store_slug: profile.store_slug, status: profile.status },
        store_url: "https://mebundle.vercel.app/store/" + profile.store_slug,
        balance: Number(balance.toFixed(2)), prices: prices.data || [], orders: orders.data || [],
        transactions: ledger.data || [], withdrawals: withdrawals.data || [], domains: domains.data || [] });
    }

    if (profile.status !== "approved") return reply({ error: profile.status === "pending" ? "Your reseller account is awaiting admin approval." : "Your reseller account is not active." }, 403);


    if (req.method === "POST" && action === "domain-request") {
      const body = await req.json();
      const domain = String(body.domain || "").trim().toLowerCase().replace(/^https?:\\/\\//, "").replace(/\\/$/, "");
      if (!/^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\\.)+[a-z]{2,63}$/.test(domain) ||
          domain === "mebundle.vercel.app" || domain.endsWith(".vercel.app")) {
        return reply({ error: "Enter a valid domain name, such as shop.example.com. Do not include https:// or a path." }, 400);
      }
      const { data: existing, error: existingError } = await db.from("reseller_custom_domains")
        .select("id,reseller_id").eq("domain", domain).maybeSingle();
      if (existingError) throw existingError;
      if (existing && existing.reseller_id !== user.id) return reply({ error: "That domain is already connected to another store." }, 409);
      const tokenValue = "mebundle-" + crypto.randomUUID().replaceAll("-", "");
      const { data: saved, error: saveError } = await db.from("reseller_custom_domains").upsert({
        reseller_id: user.id, domain, status: "pending_verification", verification_token: tokenValue,
        verified_at: null, connected_at: null, dns_instructions: [], updated_at: new Date().toISOString(),
      }, { onConflict: "domain" }).select("id,domain,status,verification_token,dns_instructions,created_at").single();
      if (saveError) throw saveError;
      return reply({ domain: saved, verification: { type: "TXT", name: "_mebundle-verification." + domain, value: tokenValue } }, 201);
    }

    if (req.method === "POST" && action === "domain-verify") {
      const body = await req.json();
      const domainId = String(body.domain_id || "");
      const { data: record, error: recordError } = await db.from("reseller_custom_domains")
        .select("id,domain,status,verification_token").eq("id", domainId).eq("reseller_id", user.id).maybeSingle();
      if (recordError) throw recordError;
      if (!record) return reply({ error: "Custom domain request not found." }, 404);
      const dnsResponse = await fetch("https://dns.google/resolve?name=" +
        encodeURIComponent("_mebundle-verification." + record.domain) + "&type=TXT", { headers: { accept: "application/dns-json" } });
      if (!dnsResponse.ok) return reply({ error: "Could not check DNS right now. Please try again." }, 502);
      const dns = await dnsResponse.json();
      const txtValues = (dns.Answer || []).filter((a: any) => a.type === 16)
        .map((a: any) => String(a.data || "").replace(/^"|"$/g, "").replace(/" "/g, ""));
      if (!txtValues.some((v: string) => v.includes(record.verification_token))) {
        return reply({ error: "The TXT record has not propagated yet. Check the host and value, then try again." }, 400);
      }

      let status = "verified";
      let dnsInstructions: any[] = [];
      const vercelToken = Deno.env.get("VERCEL_API_TOKEN");
      const projectId = Deno.env.get("VERCEL_PROJECT_ID") || "prj_nawzpN27awExIY2NcBLrszjftcqD";
      const teamId = Deno.env.get("VERCEL_TEAM_ID") || "team_mWzjU9XDsOT2SHCtKpYZXMab";
      if (vercelToken) {
        const attachUrl = "https://api.vercel.com/v10/projects/" + encodeURIComponent(projectId) +
          "/domains?teamId=" + encodeURIComponent(teamId);
        const attach = await fetch(attachUrl, {
          method: "POST",
          headers: { Authorization: "Bearer " + vercelToken, "Content-Type": "application/json" },
          body: JSON.stringify({ name: record.domain }),
        });
        const payload = await attach.json().catch(() => ({}));
        if (attach.ok || (attach.status === 409 && String(payload.error?.code || "").includes("domain_already_in_use"))) {
          status = "active";
          dnsInstructions = Array.isArray(payload.verification) ? payload.verification : [];
          if (payload.config) dnsInstructions.push(payload.config);
        } else {
          console.error("Vercel domain attach failed:", attach.status, payload.error?.code || "unknown");
          dnsInstructions = Array.isArray(payload.verification) ? payload.verification : [];
        }
      }
      const now = new Date().toISOString();
      const { data: updated, error: updateError } = await db.from("reseller_custom_domains").update({
        status, verified_at: now, connected_at: status === "active" ? now : null,
        dns_instructions: dnsInstructions, updated_at: now,
      }).eq("id", record.id).eq("reseller_id", user.id)
        .select("id,domain,status,verification_token,verified_at,connected_at,dns_instructions,created_at").single();
      if (updateError) throw updateError;
      return reply({
        domain: updated,
        message: status === "active"
          ? "Domain ownership verified and the domain has been added to Mebundle. DNS propagation and HTTPS may take a little time."
          : "Domain ownership verified. Platform connection is pending configuration; contact Mebundle support to complete activation.",
      });
    }

    if (req.method === "DELETE" && action === "domain-remove") {
      const id = requestUrl.searchParams.get("id") || "";
      const { data: record, error: findError } = await db.from("reseller_custom_domains")
        .select("id,domain,status").eq("id", id).eq("reseller_id", user.id).maybeSingle();
      if (findError) throw findError;
      if (!record) return reply({ error: "Custom domain request not found." }, 404);
      if (record.status === "active") {
        const token = Deno.env.get("VERCEL_API_TOKEN");
        const projectId = Deno.env.get("VERCEL_PROJECT_ID") || "prj_nawzpN27awExIY2NcBLrszjftcqD";
        const teamId = Deno.env.get("VERCEL_TEAM_ID") || "team_mWzjU9XDsOT2SHCtKpYZXMab";
        if (token) {
          const removeUrl = "https://api.vercel.com/v9/projects/" + encodeURIComponent(projectId) +
            "/domains/" + encodeURIComponent(record.domain) + "?teamId=" + encodeURIComponent(teamId);
          const removed = await fetch(removeUrl, { method: "DELETE", headers: { Authorization: "Bearer " + token } });
          if (!removed.ok && removed.status !== 404) return reply({ error: "Could not disconnect the domain from the hosting project. Please contact support." }, 502);
        } else {
          return reply({ error: "This domain is active. Ask Mebundle support to disconnect it safely." }, 409);
        }
      }
      const { error: deleteError } = await db.from("reseller_custom_domains").delete().eq("id", record.id).eq("reseller_id", user.id);
      if (deleteError) throw deleteError;
      return reply({ removed: true });
    }

    if (req.method === "PATCH" && action === "price") {
      const body = await req.json();
      const bundleId = String(body.bundle_id || "");
      const sellingPrice = Number(body.selling_price);
      if (!bundleId || !Number.isFinite(sellingPrice) || sellingPrice <= 0) return reply({ error: "Enter a valid selling price." }, 400);
      const { data: current, error: currentError } = await db.from("reseller_bundle_prices")
        .select("wholesale_price").eq("reseller_id", user.id).eq("bundle_id", bundleId).maybeSingle();
      if (currentError) throw currentError;
      if (!current) return reply({ error: "This bundle has not been enabled for your store by the admin." }, 404);
      if (sellingPrice < Number(current.wholesale_price)) return reply({ error: "Your selling price cannot be below the admin wholesale price." }, 400);
      const { data, error } = await db.from("reseller_bundle_prices").update({ selling_price: sellingPrice, updated_at: new Date().toISOString() })
        .eq("reseller_id", user.id).eq("bundle_id", bundleId).select("bundle_id,selling_price,wholesale_price").single();
      if (error) throw error;
      return reply({ price: data });
    }

    if (req.method === "POST" && action === "withdrawal") {
      const body = await req.json();
      const amount = Number(body.amount);
      const network = String(body.momo_network || "");
      const number = String(body.momo_number || "").replace(/\s/g, "");
      const { data: setting, error: settingError } = await db.from("site_settings").select("value")
        .eq("key", "internal_api_secret").eq("is_public", false).maybeSingle();
      if (settingError || !setting?.value?.secret) throw new Error("Withdrawal service is not configured.");
      const { data, error } = await db.rpc("reseller_request_withdrawal", {
        p_reseller_id: user.id, p_amount: amount, p_momo_network: network, p_momo_number: number,
        p_internal_secret: String(setting.value.secret),
      });
      if (error) return reply({ error: error.message }, 400);
      return reply({ withdrawal: data, message: "Withdrawal request submitted for admin review." }, 201);
    }

    return reply({ error: "Unknown action." }, 404);
  } catch (error) {
    console.error("Mebundle reseller error:", error instanceof Error ? error.message : error);
    return reply({ error: error instanceof Error ? error.message : "Reseller request failed." }, 500);
  }
});