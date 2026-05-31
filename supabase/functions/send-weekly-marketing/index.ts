import { buildMarketingEmail, type MarketingProfile } from "./weekly-marketing.ts";

const SITE_URL = "https://irenee-institut.org";
const BATCH_SIZE = 80;

type Delivery = {
  profile_id: string;
  campaign_key: string;
  delivery_status: string;
  attempt_count: number;
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" }
  });
}

async function supabaseRequest(path: string, init?: RequestInit) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) throw new Error("Supabase service configuration is incomplete");

  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      ...(init?.headers || {})
    }
  });

  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(String(result?.message || result?.error || "Supabase request failed"));
  return result;
}

async function saveDelivery(delivery: Delivery & { last_error?: string | null; sent_at?: string | null }) {
  await supabaseRequest("marketing_campaign_deliveries?on_conflict=profile_id,campaign_key", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(delivery)
  });
}

Deno.serve(async request => {
  if (request.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  const expectedSecret = Deno.env.get("REGISTRATION_NOTIFICATION_WEBHOOK_SECRET");
  if (!expectedSecret || request.headers.get("x-webhook-secret") !== expectedSecret) {
    return json({ ok: false, error: "Unauthorized" }, 401);
  }

  const googleAppsScriptUrl = Deno.env.get("GOOGLE_APPS_SCRIPT_URL");
  const googleAppsScriptWebhookSecret = Deno.env.get("GOOGLE_APPS_SCRIPT_WEBHOOK_SECRET");
  const enabled = Deno.env.get("WEEKLY_MARKETING_ENABLED") === "true";
  const payload = await request.json().catch(() => ({}));

  if (payload.healthcheck === true || !enabled) {
    return json({
      ok: true,
      enabled,
      configured: {
        googleAppsScriptUrl: Boolean(googleAppsScriptUrl),
        googleAppsScriptWebhookSecret: Boolean(googleAppsScriptWebhookSecret)
      }
    });
  }

  if (!googleAppsScriptUrl || !googleAppsScriptWebhookSecret) {
    return json({ ok: false, error: "Google Apps Script configuration is incomplete" }, 503);
  }

  try {
    const now = new Date();
    const profiles = await supabaseRequest(
      "profiles?select=id,email,prenom,nom,marketing_unsubscribe_token,course_enrollments(id)&role=eq.etudiant&marketing_opt_in=eq.true&order=created_at.asc"
    ) as MarketingProfile[];
    const emails = profiles.map(profile => ({ profile, email: buildMarketingEmail(profile, now, SITE_URL) }));
    const campaignKey = emails[0]?.email.campaignKey;

    if (!campaignKey) return json({ ok: true, sent: 0, skipped: 0, failed: 0 });

    const deliveries = await supabaseRequest(
      `marketing_campaign_deliveries?select=profile_id,campaign_key,delivery_status,attempt_count&campaign_key=eq.${encodeURIComponent(campaignKey)}`
    ) as Delivery[];
    const deliveryByProfile = new Map(deliveries.map(delivery => [delivery.profile_id, delivery]));
    const pending = emails.filter(({ profile }) => deliveryByProfile.get(profile.id)?.delivery_status !== "sent").slice(0, BATCH_SIZE);
    let sent = 0;
    let failed = 0;

    for (const { profile, email } of pending) {
      const existing = deliveryByProfile.get(profile.id);
      const attemptCount = Number(existing?.attempt_count || 0) + 1;

      try {
        const response = await fetch(googleAppsScriptUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            secret: googleAppsScriptWebhookSecret,
            campaign: {
              to: profile.email,
              subject: email.subject,
              body: email.body,
              htmlBody: email.htmlBody
            }
          })
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || result.ok !== true) throw new Error(String(result.error || "Google Apps Script rejected the campaign email"));

        await saveDelivery({
          profile_id: profile.id,
          campaign_key: email.campaignKey,
          delivery_status: "sent",
          attempt_count: attemptCount,
          sent_at: new Date().toISOString(),
          last_error: null
        });
        sent += 1;
      } catch (error) {
        await saveDelivery({
          profile_id: profile.id,
          campaign_key: email.campaignKey,
          delivery_status: "failed",
          attempt_count: attemptCount,
          last_error: error instanceof Error ? error.message : "Campaign email failed"
        });
        failed += 1;
      }
    }

    return json({
      ok: failed === 0,
      campaignKey,
      eligible: profiles.length,
      sent,
      skipped: profiles.length - pending.length,
      failed
    }, failed ? 502 : 200);
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : "Weekly marketing failed" }, 500);
  }
});
