import { createServerClient } from "@/lib/supabase";

function html(title: string, message: string, token?: string) {
  const form = token
    ? `<form method="post" action="/desabonnement">
        <input type="hidden" name="token" value="${token}">
        <button type="submit">Confirmer le désabonnement</button>
      </form>`
    : "";

  return new Response(`<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${title}</title>
    <style>
      body { background:#f6f1e7; color:#17304f; font-family:Arial,sans-serif; margin:0; padding:40px 18px; }
      main { background:white; border-radius:16px; box-shadow:0 12px 30px #0001; margin:auto; max-width:620px; padding:32px; }
      button { background:#17304f; border:0; border-radius:999px; color:white; cursor:pointer; font-weight:700; padding:13px 20px; }
      a { color:#17304f; }
    </style>
  </head>
  <body>
    <main>
      <h1>${title}</h1>
      <p>${message}</p>
      ${form}
      <p><a href="/">Retour à l'accueil</a></p>
    </main>
  </body>
</html>`, {
    headers: { "Content-Type": "text/html; charset=utf-8" }
  });
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") || "";
  if (!isUuid(token)) return html("Lien invalide", "Ce lien de désabonnement n'est pas valide.");
  return html("Se désabonner", "Confirmez que vous ne souhaitez plus recevoir les propositions de formations de l'Institut Irénée.", token);
}

export async function POST(request: Request) {
  const form = await request.formData();
  const token = String(form.get("token") || "");
  if (!isUuid(token)) return html("Lien invalide", "Ce lien de désabonnement n'est pas valide.");

  const supabase = createServerClient();
  if (!supabase) return html("Service indisponible", "Le désabonnement n'a pas pu être enregistré. Réessayez dans quelques instants.");

  const { data, error } = await supabase
    .from("profiles")
    .update({
      marketing_opt_in: false,
      marketing_opt_out_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq("marketing_unsubscribe_token", token)
    .select("id")
    .maybeSingle();

  if (error) return html("Service indisponible", "Le désabonnement n'a pas pu être enregistré. Réessayez dans quelques instants.");
  if (!data) return html("Lien invalide", "Ce lien de désabonnement n'est plus valide.");
  return html("Désabonnement confirmé", "Vous ne recevrez plus les propositions hebdomadaires de l'Institut Irénée.");
}
