import { NextResponse } from "next/server";
import {
  checkoutErrorMessage,
  CheckoutServiceError,
  type CheckoutProductType,
  logCheckoutFailure,
  normalizeCheckoutError
} from "@/lib/stripe-checkout-service";

const noStoreHeaders = { "Cache-Control": "private, no-store" };

export function checkoutSuccessResponse(payload: unknown) {
  return NextResponse.json(payload, { headers: noStoreHeaders });
}

export function checkoutAuthenticationFailure(response: Response) {
  const code = response.status === 401
    ? "AUTH_REQUIRED"
    : response.status === 403
      ? "REQUEST_FORBIDDEN"
      : "SERVICE_UNAVAILABLE";
  const status = response.status === 401 || response.status === 403 ? response.status : 503;
  return NextResponse.json({ code, error: checkoutErrorMessage(code), ok: false }, {
    headers: noStoreHeaders,
    status
  });
}

export function checkoutFailureResponse(
  error: unknown,
  productType: CheckoutProductType,
  requestId: string
) {
  const checkoutError = normalizeCheckoutError(error);
  logCheckoutFailure(checkoutError, productType, requestId);
  const headers: Record<string, string> = { ...noStoreHeaders };
  if (checkoutError.retryAfterSeconds !== undefined) {
    headers["Retry-After"] = String(checkoutError.retryAfterSeconds);
  }
  return NextResponse.json({
    code: checkoutError.code,
    error: checkoutError.message,
    ok: false
  }, {
    headers,
    status: checkoutError.status
  });
}

export function invalidCheckoutRequest(message?: string, status = 400) {
  return new CheckoutServiceError("INVALID_REQUEST", status, "validation", { message });
}
