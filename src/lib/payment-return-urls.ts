const STRIPE_SESSION_PLACEHOLDER = "{CHECKOUT_SESSION_ID}";

export function buildStripeReturnUrls(origin: string, orderId: string) {
  const successUrl = new URL("/payment/complete", origin);
  successUrl.searchParams.set("order", orderId);

  const cancelUrl = new URL("/payment/complete", origin);
  cancelUrl.searchParams.set("order", orderId);
  cancelUrl.searchParams.set("cancelled", "1");

  // Stripe substitutes this placeholder only when the braces reach its API
  // literally. URL.searchParams would encode them as %7B/%7D before the form
  // body is encoded, leaving Stripe with an encoded, non-substitutable value.
  return {
    successUrl: `${successUrl.toString()}&session_id=${STRIPE_SESSION_PLACEHOLDER}`,
    cancelUrl: cancelUrl.toString(),
  };
}
