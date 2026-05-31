const defaultRecipients = [
  "sam3ams@gmail.com",
  "tlafont49@gmail.com",
  "oeuvrecatholiquefrance@gmail.com"
];

type RegistrationRecord = {
  user_id?: string;
  email?: string;
  prenom?: string;
  nom?: string;
  created_at?: string;
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" }
  });
}

function getRecipients() {
  const configured = Deno.env.get("REGISTRATION_NOTIFICATION_TO");
  return (configured ? configured.split(",") : defaultRecipients)
    .map(email => email.trim())
    .filter(Boolean);
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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

  const recipients = getRecipients();
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("REGISTRATION_NOTIFICATION_FROM");
  const payload = await request.json().catch(() => ({}));

  if (payload.healthcheck === true) {
    return json({
      ok: true,
      configured: {
        recipients: recipients.length,
        resendApiKey: Boolean(resendApiKey),
        from: Boolean(from)
      }
    });
  }

  const record = (payload.record || {}) as RegistrationRecord;
  if (!record.user_id || !record.email) {
    return json({ ok: false, error: "Invalid registration payload" }, 400);
  }

  if (!resendApiKey || !from || recipients.length === 0) {
    const error = "Email provider configuration is incomplete";
    await updateDelivery(record, {
      delivery_status: "failed",
      attempt_count: 1,
      last_error: error
    });
    return json({ ok: false, error }, 503);
  }

  const fullName = [record.prenom, record.nom].filter(Boolean).join(" ") || "Non renseign\u00e9";
  const registeredAt = record.created_at || new Date().toISOString();

  const resendResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from,
      to: recipients,
      subject: "Nouvelle inscription sur Institut Ir\u00e9n\u00e9e",
      text: [
        "Une nouvelle inscription vient d'\u00eatre effectu\u00e9e.",
        "",
        `Nom : ${fullName}`,
        `Email : ${record.email}`,
        `Date : ${registeredAt}`
      ].join("\n"),
      html: `
        <h1>Nouvelle inscription</h1>
        <p>Une nouvelle inscription vient d'\u00eatre effectu\u00e9e sur Institut Ir\u00e9n\u00e9e.</p>
        <ul>
          <li><strong>Nom :</strong> ${escapeHtml(fullName)}</li>
          <li><strong>Email :</strong> ${escapeHtml(record.email)}</li>
          <li><strong>Date :</strong> ${escapeHtml(registeredAt)}</li>
        </ul>
      `
    })
  });

  const resendResult = await resendResponse.json().catch(() => ({}));
  if (!resendResponse.ok) {
    const error = String(resendResult.message || resendResult.error || "Resend rejected the email");
    await updateDelivery(record, {
      delivery_status: "failed",
      attempt_count: 1,
      last_error: error
    });
    return json({ ok: false, error }, 502);
  }

  await updateDelivery(record, {
    delivery_status: "sent",
    attempt_count: 1,
    sent_at: new Date().toISOString(),
    last_error: null
  });

  return json({ ok: true, emailId: resendResult.id });
});
