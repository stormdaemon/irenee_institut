import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/api-auth";
import { getAdminAccessAudit } from "@/lib/admin-access";

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, ["directeur"]);
  if (!auth.ok) return auth.response;

  try {
    return NextResponse.json(await getAdminAccessAudit());
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Audit des acces indisponible." },
      { status: 400 }
    );
  }
}
