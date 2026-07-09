import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { runRegistrationAutomation } from "@/lib/google-apps-script";
import { parseRegistrationInput, ProfileInputError } from "@/lib/profile-input";
import { readJsonBodyWithLimit, RequestBodyError } from "@/lib/request-body";

export async function POST(request: Request) {
  const auth = await authenticateRequest(request);
  if (!auth.ok) return auth.response;

  let body: Record<string, unknown>;
  try {
    body = await readJsonBodyWithLimit<Record<string, unknown>>(request, 16 * 1024);
  } catch (error) {
    if (error instanceof RequestBodyError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
  let payload: Record<string, unknown>;
  try {
    payload = parseRegistrationInput(body);
  } catch (error) {
    if (error instanceof ProfileInputError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Inscription invalide." }, { status: 400 });
  }
  const { data, error } = await auth.supabase.from("profiles").upsert({
    ...payload,
    id: auth.user.id,
    email: auth.user.email || "",
    updated_at: new Date().toISOString()
  }).select().single();
  if (error) return NextResponse.json({ error: "L'inscription n'a pas pu être enregistrée." }, { status: 400 });
  const automationWarnings = await runRegistrationAutomation(data).catch(error => [
    error instanceof Error ? error.message : String(error)
  ]);
  return NextResponse.json({ ok: true, verified: true, data, automationWarnings: automationWarnings.length ? ["Les notifications seront réessayées."] : [] });
}
