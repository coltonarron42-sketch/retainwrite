import { NewPaperFlow } from "@/components/app/new-paper-flow";
import { hasStripeConfig } from "@/lib/env";

export const metadata = { title: "New paper" };

export default function NewPaperPage() {
  return <NewPaperFlow stripeConfigured={hasStripeConfig()} />;
}
