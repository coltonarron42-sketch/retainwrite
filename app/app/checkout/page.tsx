import { CheckoutOptions } from "@/components/billing/checkout-options";
import { hasStripeConfig } from "@/lib/env";

export const metadata = { title: "Checkout" };

export default function CheckoutPage() {
  return (
    <div className="px-5 py-12 md:px-8">
      <CheckoutOptions
        demoMode={!hasStripeConfig()}
        stripeConfigured={hasStripeConfig()}
        cancelPath="/app/checkout"
      />
    </div>
  );
}
