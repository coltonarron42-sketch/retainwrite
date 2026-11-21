# RetainWrite

Student paper-writing **coach** (not a writer). Six gated stages. You write every sentence.

## Stack

- Next.js App Router + TypeScript + Tailwind
- Supabase (Auth, Postgres, Storage)
- Stripe Checkout (one-time payments only)
- Resend + React Email
- xAI Grok + Google Cloud TTS Chirp 3 HD

## Setup

```bash
cp .env.example .env.local
npm install
npm run dev
```

**Demo mode:** Log in / Sign up pages include “Continue in demo mode,” which sets a session cookie and unlocks `/app` even when Supabase env vars are present. Paper data still uses localStorage. Without Supabase keys, `/app` is open with no cookie required.

**Stage 1** follows `retainwrite-stage1-intake-spec.md` (assignment-first): upload/paste → confirm parsed Assignment card → coaching questions → voice gate → Start stance interview. Rule-based parse is used when Grok is offline.

### Supabase

```bash
supabase db push
```

Migrations live in `supabase/migrations/`.

**Auth email confirmations (Safari / Gmail):** set Site URL + Redirect URLs and the Confirm sign-up template per `docs/supabase-auth-url-checklist.md`. Or run `SUPABASE_ACCESS_TOKEN=… ./scripts/update-supabase-auth-urls.sh` with a [personal access token](https://supabase.com/dashboard/account/tokens). Confirmation links must hit `/auth/confirm` on `retainwrite.com` (token_hash), not a localhost redirect.

### Stripe webhook (local)

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

## Scripts

- `npm run dev` — local server
- `npm run build` — production build
- `npm run typecheck` — `tsc --noEmit`
- `npm test` — Vitest unit tests

## Product docs

- `retainwrite-cursor-build-prompt.md`
- `retainwrite-stage-specs.md` (overrides win on conflict)

## Beta credit bypass

Off unless both are set on the server (Vercel env, not the browser):

- `BETA_BYPASS_CREDITS=true`
- `BETA_BYPASS_EMAILS=person@example.com,other@example.com`

Allowlisted accounts can start another paper without a credit or payment. Everyone else still hits the normal check. The flag is not accepted from a query string, cookie, or `NEXT_PUBLIC_` variable. A use is logged as `beta_credit_bypass` with no email address. Leave both values empty unless you are testing.

## Deploy

Vercel project linked to this repo. Domain: retainwrite.com. Set env vars exactly as listed in `.env.example`.
