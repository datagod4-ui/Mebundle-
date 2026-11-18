const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, paystack-signature, x-paystack-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: cors });
const toHex = (bytes: Uint8Array) =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

async function verifyLegacy(raw: string, signature: string, secret: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret.trim()),
    { name: "HMAC", hash: "SHA-512" }, false, ["sign"]);
  const expected = toHex(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw))));
  if (signature.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.toLowerCase().charCodeAt(i);
  return diff === 0;
}

async function verifyModern(raw: string, header: string, secret: string) {
  let timestamp = "";
  const signatures: string[] = [];
  for (const part of header.split(",")) {
    const index = part.indexOf("=");
    if (index < 0) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key === "t") timestamp = value;
    if (key === "v1") {
      const colon = value.indexOf(":");
      if (colon > 0) signatures.push(value.slice(colon + 1));
    }
  }
  if (!/^\d+$/.test(timestamp) || Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp)) > 300) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret.trim()),
    { name: "HMAC", hash: "SHA-512" }, false, ["sign"]);
  const expected = toHex(new Uint8Array(await crypto.subtle.sign("HMAC", key,
    new TextEncoder().encode(timestamp + "." + raw))));
  return signatures.some((signature) => {
    if (!/^[0-9a-f]{128}$/i.test(signature)) return false;
    let diff = 0;
    for (let i = 0; i < 128; i++) diff |= expected.charCodeAt(i) ^ signature.toLowerCase().charCodeAt(i);
    return diff === 0;
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply({ error: "Method not allowed" }, 405);

  const paystackSecret = (Deno.env.get("PAYSTACK_SECRET_KEY") || "").trim();
  const webhookSecret = (Deno.env.get("PAYSTACK_WEBHOOK_SECRET") || "").trim();
  const supabaseUrl = (Deno.env.get("SUPABASE_URL") || "").trim();
  const serviceRole = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "").trim();
  if (!paystackSecret || !supabaseUrl || !serviceRole) {
    console.error("Paystack webhook is missing required server configuration");
    return reply({ error: "Webhook is not configured" }, 503);
  }

  try {
    const raw = await req.text();
    let event: any;
    try { event = JSON.parse(raw); } catch { return reply({ error: "Invalid JSON" }, 400); }
    if (event?.event === "ping") return reply({ received: true, ping: true });

    const modern = req.headers.get("paystack-signature") || "";
    const legacy = (req.headers.get("x-paystack-signature") || "").trim();
    let valid = false;
    if (modern && webhookSecret) valid = await verifyModern(raw, modern, webhookSecret);
    if (!valid && legacy) valid = await verifyLegacy(raw, legacy, paystackSecret);
    if (!valid) return reply({ error: "Invalid Paystack signature" }, 401);

    if (event?.event !== "charge.success") {
      return reply({ received: true, ignored: event?.event || "unknown" });
    }
    const reference = String(event?.data?.reference || "").trim();
    if (!reference || reference.length > 120) return reply({ error: "Missing or invalid payment reference" }, 400);

    // The shared payment function verifies with Paystack and dispatches through
    // the idempotent DataMart claim path. This avoids the old Hubnet dispatch.
    const response = await fetch(supabaseUrl.replace(/\/$/, "") + "/functions/v1/mebundle-payment?action=verify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + serviceRole,
        "apikey": serviceRole,
      },
      body: JSON.stringify({ reference }),
      signal: AbortSignal.timeout(50000),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error("Shared payment verification failed", response.status, body?.error || "unknown");
      return reply({ error: "Payment processing failed" }, 500);
    }
    return reply({ received: true, ...body });
  } catch (error) {
    console.error("Paystack webhook error:", error instanceof Error ? error.message : error);
    return reply({ error: "Webhook processing failed" }, 500);
  }
});
