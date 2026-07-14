import PaymentConfirmation from "@/app/paiement/merci/PaymentConfirmation";

export default async function PaymentSuccessPage({
  searchParams
}: {
  searchParams: Promise<{ stripe_session_id?: string | string[] }>;
}) {
  const { stripe_session_id: rawSessionId } = await searchParams;
  const sessionId = Array.isArray(rawSessionId) ? rawSessionId[0] || "" : rawSessionId || "";

  return <PaymentConfirmation sessionId={sessionId} />;
}
