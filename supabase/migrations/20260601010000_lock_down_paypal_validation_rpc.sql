-- SECURITY DEFINER functions are executable by PUBLIC unless explicitly revoked.
-- Only trusted server-side payment flows may validate a PayPal capture.

revoke execute on function public.validate_paypal_payment(text, text, uuid, uuid, integer, text, text, jsonb, boolean, text, text)
  from public, anon, authenticated;

grant execute on function public.validate_paypal_payment(text, text, uuid, uuid, integer, text, text, jsonb, boolean, text, text)
  to service_role;
