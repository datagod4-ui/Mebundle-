import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const toHex = (bytes: Uint8Array) =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

async function verifySignature(body: string, signature: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret.trim()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = new Uint8Array(await crypto.subtle.sign(
    "HMAC", key, new TextEncoder().encode(body),
  ));
  const expectedHex = toHex(digest);
  let binary = "";
  for (const byte of digest) binary += String.fromCharCode(byte);
  const expectedBase64 = btoa(binary);
  const supplied = signature.trim().replace(/^(sha256|v1)=/i, "").trim();
  const candidates = [expectedHex, expectedBase64, expectedBase64.replace(/=+$/, "")];
  return candidates.some((candidate) => {
    if (candidate.length !== supplied.length) return false;
    let diff = 0;
    for (let i = 0; i < candidate.length; i++) {
      diff |= candidate.toLowerCase().charCodeAt(i) ^ supplied.toLowerCase().charCodeAt(i);
    }
    return diff === 0;
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "GET") return json({ service: "Mebundle DataMart webhook", ready: true });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const secret = Deno.env.get("DATAMART_WEBHOOK_SECRET") || "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!secret || !supabaseUrl || !serviceRole) {
    console.error("Webhook configuration missing");
    return json({ error: "Webhook is not configured" }, 503);
  }

  try {
    const raw = await req.text();
    let event: any;
    try { event = JSON.parse(raw); } catch { return json({ error: "Invalid JSON" }, 400); }

    const signature = req.headers.get("x-datamart-signature") || "";
    // Check raw body and normalized JSON, supporting hex/base64 digests and common prefixes.
    const validSignature = !!signature && (
      await verifySignature(raw, signature, secret) ||
      await verifySignature(JSON.stringify(event), signature, secret)
    );
    if (!validSignature) {
      console.warn("DataMart signature rejected", {
        signature_header_present: !!signature,
        signature_length: signature.length,
        signature_prefix: signature.slice(0, 8).replace(/[^a-zA-Z0-9=_-]/g, ""),
        secret_configured: !!secret,
        secret_length: secret.length,
        raw_body_length: raw.length,
      });
      return json({
        error: "Invalid DataMart signature",
        diagnostic: {
          signature_header_present: !!signature,
          signature_length: signature.length,
          secret_configured: !!secret,
        },
      }, 401);
    }

    const eventName = String(event.event || "").toLowerCase();
    const data = event.data || {};
    const allowed = new Set([
      "order.created", "order.processing", "order.waiting",
      "order.completed", "order.failed", "order.refunded",
    ]);
    if (!allowed.has(eventName)) return json({ received: true, ignored: eventName || "unknown" });

    const identifiers = [
      data.purchaseId, data.orderId, data.reference, data.orderReference, data.transactionId,
      data.transactionReference,
    ].filter((v) => v !== null && v !== undefined && String(v).trim() !== "")
      .map((v) => String(v).trim());

    if (!identifiers.length) return json({ error: "Webhook has no order identifier" }, 400);

    const db = createClient(supabaseUrl, serviceRole, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    let order: any = null;
    for (const identifier of identifiers) {
      const { data: found, error } = await db.from("orders")
        .select("id,tracking_code,order_status,supplier_status,supplier_order_id,supplier_response")
        .eq("supplier_order_id", identifier)
        .maybeSingle();
      if (error) throw error;
      if (found) { order = found; break; }
    }

    if (!order) {
      await db.from("supplier_sync_logs").insert({
        supplier: "datamart",
        sync_type: "webhook_unmatched",
        status: "warning",
        message: "DataMart webhook received but no Mebundle order matched",
        details: { event: eventName, identifiers, payload: event },
      });
      // Acknowledge to prevent endless retries; unmatched event is visible in sync logs.
      return json({ received: true, matched: false });
    }

    const statusMap: Record<string, string> = {
      "order.created": "processing",
      "order.processing": "processing",
      "order.waiting": "processing",
      "order.completed": "completed",
      "order.failed": "failed",
      "order.refunded": "refunded",
    };
    const mapped = statusMap[eventName];
    const now = new Date().toISOString();
    const update: Record<string, unknown> = {
      supplier_status: mapped,
      supplier_response: {
        ...(order.supplier_response && typeof order.supplier_response === "object" ? order.supplier_response : {}),
        latest_webhook: event,
        webhook_received_at: now,
      },
      updated_at: now,
    };
    if (mapped === "completed") {
      update.order_status = "completed";
      update.fulfilled_at = data.updatedAt || now;
      update.failure_reason = null;
    } else if (mapped === "failed") {
      update.order_status = "failed";
      update.failure_reason = String(data.message || data.reason || "DataMart reported delivery failure").slice(0, 500);
    } else if (mapped === "refunded") {
      update.order_status = "refunded";
      update.payment_status = "refunded";
      update.failure_reason = String(data.message || "DataMart reported refund").slice(0, 500);
    } else if (order.order_status !== "completed" && order.order_status !== "refunded") {
      update.order_status = "processing";
    }

    const { error: updateError } = await db.from("orders").update(update).eq("id", order.id);
    if (updateError) throw updateError;

    await db.from("supplier_sync_logs").insert({
      supplier: "datamart",
      sync_type: "webhook_" + eventName.replace(".", "_"),
      status: mapped === "failed" ? "failed" : "success",
      message: "DataMart webhook applied to Mebundle order " + order.tracking_code,
      details: { tracking_code: order.tracking_code, identifiers, event: eventName, supplier_status: mapped },
    });

    return json({ received: true, matched: true, tracking_code: order.tracking_code, status: mapped });
  } catch (error) {
    console.error("DataMart webhook error:", error instanceof Error ? error.message : error);
    return json({ error: "Webhook processing failed" }, 500);
  }
});