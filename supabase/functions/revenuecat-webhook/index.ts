// FORGE — RevenueCat webhook receiver.
//
// Deno Deploy / Supabase Edge Function. RevenueCat posts here every time
// a subscription state changes; we UPSERT user_subscriptions with the
// new entitlement. The app reads that table on session resume + auto-
// updates UI from SDK push events between renewals.
//
// Setup:
//   1. supabase functions deploy revenuecat-webhook --project-ref <your-ref>
//   2. supabase secrets set FORGE_RC_WEBHOOK_SECRET=<random-hex>
//   3. In RevenueCat → Project settings → Integrations → Webhooks, set
//      URL  = https://<your-ref>.functions.supabase.co/revenuecat-webhook
//      Auth = Authorization: Bearer <same FORGE_RC_WEBHOOK_SECRET>
//   4. In RevenueCat → Customers → identify by Supabase user UUID (we set
//      this via Purchases.logIn(session.userId) on the client).
//
// Security notes:
//   - The Authorization header check is the only auth; RC doesn't sign
//     bodies. Treat the secret as private.
//   - We use the service-role key (env SUPABASE_SERVICE_ROLE_KEY) to
//     bypass RLS for the upsert. Never expose this key in the client.
//   - SUPABASE_URL is auto-provided by Edge Functions.
//
// Event reference:
//   https://www.revenuecat.com/docs/integrations/webhooks/event-types-and-fields

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface RCEvent {
  type: string;                     // INITIAL_PURCHASE | RENEWAL | CANCELLATION | EXPIRATION | BILLING_ISSUE | PRODUCT_CHANGE | UNCANCELLATION | TRANSFER | SUBSCRIBER_ALIAS | NON_RENEWING_PURCHASE | …
  app_user_id: string;              // we set this to the Supabase user UUID
  product_id?: string;
  expiration_at_ms?: number;        // ms since epoch
  period_type?: "TRIAL" | "INTRO" | "NORMAL" | "PROMOTIONAL";
  entitlement_ids?: string[];
  entitlement_id?: string;
  is_trial_period?: boolean;
  event_timestamp_ms?: number;
}

interface RCWebhookBody {
  event: RCEvent;
  api_version?: string;
}

const ENTITLEMENT_NAME = "pro";   // must match config.js REVENUECAT_ENTITLEMENT

// Map an RC event to the row we want stored. Returns null for events we
// don't act on (e.g. TEST events from the RC dashboard test button —
// app_user_id may be a fake identifier we shouldn't write).
function eventToRow(event: RCEvent) {
  // Validate app_user_id looks like a Supabase UUID. RC test events use
  // identifiers like "test_user" or "RC_TEST_USER_ID" which we ignore.
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidPattern.test(event.app_user_id)) return null;

  // Type-specific status mapping. The two definitive "you're free now"
  // events are CANCELLATION (user-initiated; access continues until
  // expires_at) and EXPIRATION (period actually ended). For CANCELLATION
  // we keep status as "pro"/"trial" until expiration arrives.
  let status: "free" | "trial" | "pro" = "free";
  switch (event.type) {
    case "INITIAL_PURCHASE":
    case "RENEWAL":
    case "UNCANCELLATION":
    case "PRODUCT_CHANGE":
      status = event.period_type === "TRIAL" || event.period_type === "INTRO" ? "trial" : "pro";
      break;
    case "CANCELLATION":
      // User cancelled but still has access until expires_at — leave as
      // current entitlement type.
      status = event.period_type === "TRIAL" || event.period_type === "INTRO" ? "trial" : "pro";
      break;
    case "EXPIRATION":
    case "BILLING_ISSUE":
      status = "free";
      break;
    case "NON_RENEWING_PURCHASE":
      status = "pro";
      break;
    default:
      // SUBSCRIBER_ALIAS / TRANSFER / TEST etc — skip, no status change.
      return null;
  }

  return {
    user_id: event.app_user_id,
    status,
    product_id: event.product_id || null,
    expires_at: event.expiration_at_ms ? new Date(event.expiration_at_ms).toISOString() : null,
    rc_app_user_id: event.app_user_id,
    last_event_type: event.type,
    last_event_at: new Date().toISOString(),
  };
}

Deno.serve(async (req) => {
  // Auth check — RC sends the header we configured in their dashboard.
  const expected = Deno.env.get("FORGE_RC_WEBHOOK_SECRET");
  const got = req.headers.get("Authorization");
  if (!expected || got !== `Bearer ${expected}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  let body: RCWebhookBody;
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  if (!body?.event?.app_user_id || !body?.event?.type) {
    return new Response("Missing event fields", { status: 400 });
  }

  // Only act on events that mention our entitlement (or are entitlement-
  // agnostic like CANCELLATION which we still want to log).
  const ents = body.event.entitlement_ids || (body.event.entitlement_id ? [body.event.entitlement_id] : []);
  const entitlementAgnostic = ["CANCELLATION", "BILLING_ISSUE", "EXPIRATION"].includes(body.event.type);
  if (!entitlementAgnostic && ents.length > 0 && !ents.includes(ENTITLEMENT_NAME)) {
    return new Response("Skipped — different entitlement", { status: 200 });
  }

  const row = eventToRow(body.event);
  if (!row) {
    return new Response("Skipped — non-UUID app_user_id or non-actionable event", { status: 200 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );
  const { error } = await supabase
    .from("user_subscriptions")
    .upsert(row, { onConflict: "user_id" });

  if (error) {
    console.error("[webhook] upsert failed:", error);
    return new Response(`DB error: ${error.message}`, { status: 500 });
  }
  return new Response("OK", { status: 200 });
});
