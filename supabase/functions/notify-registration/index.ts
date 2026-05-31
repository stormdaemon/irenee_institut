import {
  buildGoogleAppsScriptPayload,
  getGoogleAppsScriptError,
  type RegistrationRecord
} from "./google-apps-script.ts";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" }
  });
}

async function updateDelivery(record: RegistrationRecord, values: Record<string, unknown>) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey || !record.user_id) return;

  await fetch(
    `${supabaseUrl}/rest/v1/registration_notification_outbox?user_id=eq.${encodeURIComponent(record.user_id)}`,
    {
      method: "PATCH",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal"
      },
      body: JSON.stringify({
        ...values,
        updated_at: new Date().toISOString()
      })
    }
  );
}

Deno.serve(async request => {
  if (request.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  const expectedSecret = Deno.env.get("REGISTRATION_NOTIFICATION_WEBHOOK_SECRET");
  if (!expectedSecret || request.headers.get("x-webhook-secret") !== expectedSecret) {
    return json({ ok: false, error: "Unauthorized" }, 401);
  }

  const googleAppsScriptUrl = Deno.env.get("GOOGLE_APPS_SCRIPT_URL");
  const googleAppsScriptWebhookSecret = Deno.env.get("GOOGLE_APPS_SCRIPT_WEBHOOK_SECRET");
  const payload = await request.json().catch(() => ({}));

  if (payload.healthcheck === true) {
    return json({
      ok: true,
      configured: {
        googleAppsScriptUrl: Boolean(googleAppsScriptUrl),
        googleAppsScriptWebhookSecret: Boolean(googleAppsScriptWebhookSecret)
      }
    });
  }

  const record = (payload.record || {}) as RegistrationRecord;
  if (!record.user_id || !record.email) {
    return json({ ok: false, error: "Invalid registration payload" }, 400);
  }

  if (!googleAppsScriptUrl || !googleAppsScriptWebhookSecret) {
    const error = "Google Apps Script configuration is incomplete";
    await updateDelivery(record, {
      delivery_status: "failed",
      attempt_count: 1,
      last_error: error
    });
    return json({ ok: false, error }, 503);
  }

  const googleAppsScriptResponse = await fetch(googleAppsScriptUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(buildGoogleAppsScriptPayload(record, googleAppsScriptWebhookSecret))
  });

  const googleAppsScriptResult = await googleAppsScriptResponse.json().catch(() => ({}));
  const googleAppsScriptError = getGoogleAppsScriptError(googleAppsScriptResponse.ok, googleAppsScriptResult);
  if (googleAppsScriptError) {
    await updateDelivery(record, {
      delivery_status: "failed",
      attempt_count: 1,
      last_error: googleAppsScriptError
    });
    return json({ ok: false, error: googleAppsScriptError }, 502);
  }

  await updateDelivery(record, {
    delivery_status: "sent",
    attempt_count: 1,
    sent_at: new Date().toISOString(),
    last_error: null
  });

  return json({ ok: true });
});
