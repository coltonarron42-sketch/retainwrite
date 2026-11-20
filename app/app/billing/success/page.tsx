import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Payment success" };

type Props = {
  searchParams: Promise<{ session_id?: string }>;
};

export default async function BillingSuccessPage({ searchParams }: Props) {
  const { session_id } = await searchParams;

  return (
    <div className="mx-auto max-w-lg px-5 py-16 md:px-8">
      <p className="text-xs font-semibold uppercase tracking-wider text-rw-teal">
        Checkout
      </p>
      <h1 className="mt-2 font-display text-4xl text-rw-ink">You&apos;re set</h1>
      <p className="mt-3 text-rw-ink/65">
        {session_id
          ? "Stripe confirmed your payment. Credits or your new paper will appear once the webhook finishes."
          : "Payment recorded. Head to your dashboard to start writing."}
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Button asChild variant="secondary">
          <Link href="/app">Go to dashboard</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/app/papers/new">Start a paper</Link>
        </Button>
      </div>
    </div>
  );
}
