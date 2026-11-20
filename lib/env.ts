import { z } from "zod";
import { TTS_VOICE_DEFAULT } from "./config";

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional().or(z.literal("")),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional().or(z.literal("")),
});

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional().or(z.literal("")),
  RESEND_API_KEY: z.string().optional().or(z.literal("")),
  STRIPE_SECRET_KEY: z.string().optional().or(z.literal("")),
  STRIPE_PUBLISHABLE_KEY: z.string().optional().or(z.literal("")),
  STRIPE_WEBHOOK_SECRET: z.string().optional().or(z.literal("")),
  GROK_API_KEY: z.string().optional().or(z.literal("")),
  GOOGLE_CLOUD_TTS_API_KEY: z.string().optional().or(z.literal("")),
  GOOGLE_CLOUD_TTS_VOICE_ID: z.string().optional().or(z.literal("")),
  ADMIN_NOTIFY_EMAIL: z.string().email().optional().or(z.literal("")),
  UNPAYWALL_EMAIL: z.string().email().optional().or(z.literal("")),
  CRON_SECRET: z.string().optional().or(z.literal("")),
  MISTRAL_OCR_API_KEY: z.string().optional().or(z.literal("")),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export type PublicEnv = z.infer<typeof publicSchema>;
export type ServerEnv = z.infer<typeof serverSchema>;

function readPublic(): PublicEnv {
  return publicSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  });
}

function readServer(): ServerEnv {
  return serverSchema.parse({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    RESEND_API_KEY: process.env.RESEND_API_KEY ?? "",
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY ?? "",
    STRIPE_PUBLISHABLE_KEY: process.env.STRIPE_PUBLISHABLE_KEY ?? "",
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET ?? "",
    GROK_API_KEY: process.env.GROK_API_KEY ?? "",
    GOOGLE_CLOUD_TTS_API_KEY: process.env.GOOGLE_CLOUD_TTS_API_KEY ?? "",
    GOOGLE_CLOUD_TTS_VOICE_ID: process.env.GOOGLE_CLOUD_TTS_VOICE_ID ?? "",
    ADMIN_NOTIFY_EMAIL: process.env.ADMIN_NOTIFY_EMAIL ?? "",
    UNPAYWALL_EMAIL: process.env.UNPAYWALL_EMAIL ?? "",
    CRON_SECRET: process.env.CRON_SECRET ?? "",
    MISTRAL_OCR_API_KEY: process.env.MISTRAL_OCR_API_KEY ?? "",
    NODE_ENV: process.env.NODE_ENV ?? "development",
  });
}

export function getPublicEnv() {
  return readPublic();
}

export function hasSupabaseConfig() {
  const env = readPublic();
  return Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function hasStripeConfig() {
  const env = readServer();
  return Boolean(env.STRIPE_SECRET_KEY);
}

/** Validates required production server vars. Soft in development. */
export function assertServerEnv() {
  const env = readServer();
  const isProd = env.NODE_ENV === "production";
  const requiredInProd = [
    "SUPABASE_SERVICE_ROLE_KEY",
    "RESEND_API_KEY",
    "STRIPE_SECRET_KEY",
    "STRIPE_PUBLISHABLE_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "GROK_API_KEY",
    "GOOGLE_CLOUD_TTS_API_KEY",
    "ADMIN_NOTIFY_EMAIL",
    "UNPAYWALL_EMAIL",
    "CRON_SECRET",
  ] as const;

  if (isProd) {
    const missing = requiredInProd.filter((key) => !env[key]);
    if (missing.length) {
      throw new Error(
        `Missing required environment variables: ${missing.join(", ")}`,
      );
    }
  }

  return {
    ...env,
    GOOGLE_CLOUD_TTS_VOICE_ID:
      env.GOOGLE_CLOUD_TTS_VOICE_ID || TTS_VOICE_DEFAULT,
    aiEnabled: Boolean(env.GROK_API_KEY),
    ttsEnabled: Boolean(env.GOOGLE_CLOUD_TTS_API_KEY),
    ocrEnabled: Boolean(env.MISTRAL_OCR_API_KEY),
  };
}

export function getStripePublishableKey() {
  return readServer().STRIPE_PUBLISHABLE_KEY;
}
