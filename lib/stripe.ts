import Stripe from "stripe";
import { assertServerEnv } from "./env";

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  const env = assertServerEnv();
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }
  if (!stripeClient) {
    stripeClient = new Stripe(env.STRIPE_SECRET_KEY);
  }
  return stripeClient;
}
