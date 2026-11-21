import { NewPaperFlow } from "@/components/app/new-paper-flow";
import { requireUser } from "@/lib/auth/require-user";
import { hasStripeConfig } from "@/lib/env";

export const metadata = { title: "New paper" };

export default async function NewPaperPage() {
  const access = await requireUser("/app/papers/new");
  return (
    <NewPaperFlow
      stripeConfigured={hasStripeConfig()}
      mode={access.kind === "user" ? "live" : "demo"}
    />
  );
}
