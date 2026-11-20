import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { PACK3_CREDITS } from "@/lib/config";
import { assertServerEnv, hasStripeConfig, hasSupabaseConfig } from "@/lib/env";
import { getStripe } from "@/lib/stripe";
import { createServiceRoleClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

async function markPaidIdempotent(
  purchaseId: string,
  session: Stripe.Checkout.Session,
) {
  const service = createServiceRoleClient();
  const { data: purchase } = await service
    .from("purchases")
    .select("*")
    .eq("id", purchaseId)
    .maybeSingle();

  if (!purchase) return;
  if (purchase.status === "paid") return; // idempotent

  await service
    .from("purchases")
    .update({
      status: "paid",
      stripe_session_id: session.id,
      stripe_payment_intent:
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : session.payment_intent?.id ?? null,
    })
    .eq("id", purchaseId)
    .eq("status", "pending");

  const kind = purchase.kind as "single" | "pack3" | "audio";
  const userId = purchase.user_id as string;

  if (kind === "single") {
    const { data: paper } = await service
      .from("papers")
      .insert({
        user_id: userId,
        is_free_paper: false,
        funded_by: "single",
        audio_unlocked: false,
        current_stage: 1,
      })
      .select("id")
      .single();

    if (paper) {
      await service.from("stage_progress").insert(
        Array.from({ length: 6 }, (_, i) => ({
          paper_id: paper.id,
          user_id: userId,
          stage: i + 1,
          status: i === 0 ? "in_progress" : "locked",
          data: {},
        })),
      );
      await service
        .from("purchases")
        .update({ paper_id: paper.id })
        .eq("id", purchaseId);
    }
  }

  if (kind === "pack3") {
    const { data: profile } = await service
      .from("profiles")
      .select("paper_credits")
      .eq("user_id", userId)
      .single();
    const credits = (profile?.paper_credits ?? 0) + PACK3_CREDITS;
    await service
      .from("profiles")
      .update({ paper_credits: credits })
      .eq("user_id", userId);
  }

  if (kind === "audio" && purchase.paper_id) {
    await service
      .from("papers")
      .update({ audio_unlocked: true })
      .eq("id", purchase.paper_id);
  }
}

export async function POST(request: Request) {
  if (!hasStripeConfig() || !hasSupabaseConfig()) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  const env = assertServerEnv();
  if (!env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json(
      { error: "STRIPE_WEBHOOK_SECRET missing" },
      { status: 503 },
    );
  }

  const stripe = getStripe();
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const rawBody = await request.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const purchaseId =
      session.client_reference_id || session.metadata?.purchase_id;
    if (purchaseId) {
      await markPaidIdempotent(purchaseId, session);
    }
  }

  if (event.type === "checkout.session.expired") {
    const session = event.data.object as Stripe.Checkout.Session;
    const purchaseId =
      session.client_reference_id || session.metadata?.purchase_id;
    if (purchaseId) {
      const service = createServiceRoleClient();
      await service
        .from("purchases")
        .update({ status: "failed" })
        .eq("id", purchaseId)
        .eq("status", "pending");
    }
  }

  return NextResponse.json({ received: true });
}
