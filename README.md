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

Without Supabase/Stripe keys the app runs in **demo mode** (localStorage) so you can walk homepage → intake → checkout locally.

### Supabase

```bash
supabase db push
```

Migrations live in `supabase/migrations/`.

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

## Deploy

Vercel project linked to this repo. Domain: retainwrite.com. Set env vars exactly as listed in `.env.example`.
