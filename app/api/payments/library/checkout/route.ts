import { authenticateRequest } from "@/lib/api-auth";
import { readJsonBodyWithLimit, RequestBodyError } from "@/lib/request-body";
import {
  checkoutAuthenticationFailure,
  checkoutFailureResponse,
  checkoutSuccessResponse,
  invalidCheckoutRequest
} from "@/lib/stripe-checkout-response";
import { createCheckoutForUser } from "@/lib/stripe-checkout-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  const auth = await authenticateRequest(request);
  if (!auth.ok) return checkoutAuthenticationFailure(auth.response);

  let body: Record<string, unknown>;
  try {
    body = await readJsonBodyWithLimit<Record<string, unknown>>(request, 1_024);
    if (!body || Array.isArray(body) || typeof body !== "object") {
      throw invalidCheckoutRequest();
    }
  } catch (error) {
    const failure = error instanceof RequestBodyError
      ? invalidCheckoutRequest(error.message, error.status)
      : error;
    return checkoutFailureResponse(failure, "library_membership", requestId);
  }

  try {
    const result = await createCheckoutForUser({
      body,
      productType: "library_membership",
      requestId,
      supabase: auth.supabase,
      user: auth.user
    });
    return checkoutSuccessResponse(result);
  } catch (error) {
    return checkoutFailureResponse(error, "library_membership", requestId);
  }
}
