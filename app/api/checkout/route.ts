import { NextResponse } from "next/server";
import { z } from "zod";
import { CHECKOUT_PRODUCTS, SITE_URL } from "@/lib/config";
import { hasStripeConfig, hasSupabaseConfig } from "@/lib/env";
import { getStripe } from "@/lib/stripe";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const bodySchema = z.object({
  kind: z.enum(["single", "pack3", "audio"]),
  paperId: z.string().uuid().optional(),
  cancelPath: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const body = bodySchema.parse(json);

    if (!hasStripeConfig()) {
      return NextResponse.json(
        {
          error:
            "Stripe is not configured. Use demo checkout on /app/papers/new.",
        },
        { status: 503 },
      );
    }

    if (!hasSupabaseConfig()) {
      return NextResponse.json(
        { error: "Supabase is not configured." },
        { status: 503 },
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const product = CHECKOUT_PRODUCTS[body.kind];
    const service = createServiceRoleClient();
    const { data: purchase, error: purchaseError } = await service
      .from("purchases")
      .insert({
        user_id: user.id,
        paper_id: body.paperId ?? null,
        kind: body.kind,
        amount_cents: product.amount,
        status: "pending",
      })
      .select("id")
      .single();

    if (purchaseError || !purchase) {
      return NextResponse.json(
        { error: purchaseError?.message ?? "Could not create purchase" },
        { status: 500 },
      );
    }

    const origin = request.headers.get("origin") || SITE_URL;
    const cancelPath = body.cancelPath || "/pricing";
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      client_reference_id: purchase.id,
      success_url: `${origin}/app/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}${cancelPath}`,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: product.amount,
            product_data: { name: product.name },
          },
        },
      ],
      metadata: {
        user_id: user.id,
        kind: body.kind,
        paper_id: body.paperId ?? "",
        purchase_id: purchase.id,
      },
    });

    await service
      .from("purchases")
      .update({ stripe_session_id: session.id })
      .eq("id", purchase.id);

    return NextResponse.json({ url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Checkout failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
