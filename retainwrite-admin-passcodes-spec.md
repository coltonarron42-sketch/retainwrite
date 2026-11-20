# RetainWrite — Admin Access Passcodes (companion to `retainwrite-cursor-build-prompt.md` and `retainwrite-stage-specs.md`)

Paste this into Cursor **after** the build prompt and the stage specs. Where this doc conflicts with the build prompt, **this doc wins** for passcodes and entitlements. Table names, prices, and existing env var names are unchanged except for the one new server var `PASSCODE_PEPPER` and the additive migration `supabase/migrations/0004_access_codes.sql` (0003 is already used by the AI checker: `0003_ai_checker.sql`).

LOCKED RULES (hold everywhere): coaching only; `lib/ai/guard.ts` still applies; mismatch warnings never use detector-evasion framing; the age gate still applies (under-13: no account; ages 13–17 need guardian consent before the first paper or upload — a passcode does not skip this). A passcode only skips **Stripe**. It never skips coaching gates, the output guard, or the age/guardian gate.

Primary use: the owner creates a code so his wife can test with real papers. Build it as a general admin tool, not a one-off exception.

---

## 0. Decisions in this doc

1. **Admin gate uses the existing `profiles.is_admin` boolean** (migration 0002), not a new `profiles.role` column. One admin system, already used by `/admin/feedback` and `/admin/sop`. Seed the owner's account with `is_admin = true` after first signup (section 12).
2. **One new env var only:** `PASSCODE_PEPPER` (server only, required). Add it to Vercel (Production and Preview), `.env.example`, and `lib/env.ts`. Do not invent any other names. Do not add Anthropic or ElevenLabs keys.
3. **Codes are hashed at the app server, then redeemed by hash.** The security-definer RPC is `redeem_access_code(p_code_hash text, p_ip_hash text)`. It does **not** take the plaintext code, so the pepper stays in the app env and plaintext codes never appear in Postgres logs. The Route Handler normalizes, hashes with `PASSCODE_PEPPER`, rate-limits, then calls the RPC. Atomicity and row locking still live in the RPC.
4. **Two independent axes.** Redemption limit: `single_use` | `multi_use` (max N) | `unlimited_redemptions`. Grant: `unlimited` (unlimited papers, audio included) | `credits` (N paper credits, audio included by default) | `audio` (unlocks audio only). A single user may redeem a given code only once (`unique (code_id, user_id)`).
5. **`expires_at` is a redemption deadline**, not a grant expiry. Once redeemed, credits never expire (same as paid credits). `profiles.unlimited_until` exists and is honored if set, but v1 grants leave it `null` (open-ended). Revoking a code stops new redemptions; a separate admin action can turn off `unlimited_access` for users whose `access_code_id` points at that code. Unused `passcode_credits` are not clawed back.
6. **Credit ledgers are split.** Purchased and feedback credits stay in `profiles.paper_credits`. Code-granted credits go to `profiles.passcode_credits`. Refunds and revenue metrics look only at `paper_credits` / paid `purchases` rows. Feedback-credit grants always increment `paper_credits`, never `passcode_credits`.
7. **New-paper funding order** (in `lib/entitlements.ts`, used by every paywall and "Start new paper"): (1) guardian/age block if applicable, (2) active unlimited access, (3) unused free first paper, (4) `paper_credits`, (5) `passcode_credits`, (6) paywall. Unlimited does not set `free_paper_used`, so a later revoke still leaves the free paper intact.
8. **Unlimited users never see the audio upsell or Stripe checkout.** Papers they start are `funded_by = 'access_code'`, `audio_unlocked = true`, `is_free_paper = false`. Credit-grant papers are the same when a passcode credit is consumed. Analytics mark `source=passcode`. Revenue queries exclude `purchases.kind = 'access_code'`.
9. **The code field is not on Stage 1.** It appears as a "Have an access code?" collapsible on `/signup` and on the paywall/checkout screen only.

---

## 1. Code format and hashing

**Generated format:** `RW-XXXX-XXXX` (prefix `RW-`, two groups of 4).

Alphabet is Crockford base32, no ambiguous characters: `0123456789ABCDEFGHJKMNPQRSTVWXYZ` (no `I`, `L`, `O`, `U`). Generate 8 symbols with `crypto.randomBytes` (CSPRNG) in `lib/access-codes/generate.ts`. 8 × 5 bits = 40 bits of entropy; rate limits (section 8) make brute force impractical.

**Normalization** (apply before hashing and before uniqueness checks), `lib/access-codes/normalize.ts`:

1. Trim whitespace, uppercase.
2. Map `I` and `L` → `1`, `O` → `0`. Drop `U` or treat the code as invalid if `U` remains after other maps — reject vanity codes that contain `U` after normalization.
3. Strip hyphens, spaces, and other separators.
4. The canonical hash input is the resulting string with no separators (for a generated code, `RW` + 8 symbols, e.g. `RWA1B2C3D4`).

Input is **case-insensitive**. `rw-a1b2-c3d4`, `RW-A1B2-C3D4`, and `rwa1b2c3d4` all hash the same.

**Hash:** SHA-256 hex of `PASSCODE_PEPPER + ":" + canonical`. Store only `code_hash` and `last4` (the last 4 characters of the canonical form after any `RW` prefix, displayed as `RW-••••-C3D4`). Never store plaintext. The full code is returned **once** in the admin create response and shown in a one-time modal with a copy button. It cannot be retrieved later.

**Vanity codes (optional):** on create, the admin may supply a custom code. Rules: 8–24 characters after normalization, Crockford alphabet only, not all zeros, not a trivial repeat (`RW00000000`). Hyphens are allowed in the typed value and stripped. Reject with a clear admin-only error if the hash already exists. Set `is_vanity = true`. Display last 4 the same way.

On hash collision of a generated code (vanishingly rare), retry generation up to 3 times, then fail the request.

---

## 2. Admin generation

### 2.1 Access control

- Dashboard: `/admin/passcodes` (list + create + revoke + redemptions).
- API: `POST /api/admin/passcodes` (create), `GET /api/admin/passcodes` (list; never returns plaintext or `code_hash`), `GET /api/admin/passcodes/[id]` (detail + redemption list), `PATCH /api/admin/passcodes/[id]` (revoke, update label, toggle `notify_on_redeem`). No delete endpoint; use revoke.
- Every `/admin/**` route and admin API: require a logged-in session **and** `profiles.is_admin = true`, checked server-side. Non-admins get a 404 (do not advertise the admin surface). Middleware protects `/admin/**` the same way `/app/**` is protected, plus the admin role check.
- After the admin check passes, server routes may use the service-role client. **`SUPABASE_SERVICE_ROLE_KEY` is never imported in client components or sent to the browser.** `PASSCODE_PEPPER` is likewise server only.

### 2.2 Create form and `POST` body (Zod)

```ts
{
  label: string,                     // required, 1–80 chars, e.g. "Angie test"
  redemption_limit: "single_use" | "multi_use" | "unlimited_redemptions",
  max_redemptions?: number,          // required if multi_use, integer 2–10_000
  grant_type: "unlimited" | "credits" | "audio",
  credits?: number,                  // required if grant_type=credits, integer 1–1_000
  audio_included?: boolean,          // default true for unlimited and credits; always true for audio
  expires_at?: string | null,        // ISO date; optional redemption deadline (end of that UTC day if date-only)
  restricted_email?: string | null,  // optional; stored lowercased; must be a valid email
  vanity_code?: string | null,       // optional custom code
  notify_on_redeem?: boolean,        // default true
}
```

Server generates or validates the code, hashes it, inserts the row (`created_by = auth.uid()`, `redemption_count = 0`, `revoked_at = null`, `max_redemptions = 1` for single_use, `null` for unlimited_redemptions), and returns:

```ts
{ id, code, last4, label, grant_type, credits, redemption_limit, max_redemptions, expires_at }
```

`code` (full plaintext) appears only in this create response.

### 2.3 Dashboard UX

- List: label, `RW-••••-LAST`, grant summary, redemptions `used / max` (or "Unlimited"), expiry, revoked badge, notify toggle, created at (America/Denver in the UI).
- Create: the fields above. On success, a modal: "Copy this code now. You will not be able to see it again." Copy button. Confirm before dismiss.
- Revoke: confirm "Stop new redemptions for '{label}'?" Sets `revoked_at = now()`. Optional second action: "Turn off unlimited access for accounts that used this code" (clears `unlimited_access` / `unlimited_until` / `audio_included` only where `access_code_id` matches **and** `grant_type` was `unlimited` or `audio`; does not decrement `passcode_credits`).
- Detail: redemption table (`redeemed_at`, user email, user id). No IP plaintext (only that a hash was stored).

---

## 3. Redemption UX

**Where:** a collapsed link **"Have an access code?"** on `/signup` and on the paywall / checkout screen (`/app/papers/new` when the entitlements helper returns `paywall`, and `/app/billing` if checkout is offered). **Not** on Stage 1 intake questions.

**Signup flow:** the collapsed field is optional. After the session exists (password signup, or magic-link `/auth/callback`), redeem automatically if a code was entered (keep it in `sessionStorage` key `rw_access_code` until success or a hard failure, then clear it). If redemption fails after the account is created, the account stays; show the generic error and leave a retry on the paywall.

**Paywall flow:** expand, paste/type the code, submit. Validate inline. On success, hide Stripe, show the grant, and enable **Start new paper**.

**Success copy (examples):**

- Unlimited: "You have unlimited papers, including audio. Stripe checkout is hidden on this account."
- Credits: "We added {n} paper credit(s) to your account, audio included. Credits never expire."
- Audio: "Audio is unlocked on your papers."

**Error copy (generic, to avoid enumeration):**

| Internal reason | Status | User-facing message |
|---|---|---|
| invalid, expired, used up, revoked, email mismatch, unknown hash | 400 | "That code isn't valid." |
| already redeemed by this user | 409 | "This code is already on your account." |
| rate limited | 429 | "Too many tries. Wait a few minutes and try again." |
| not signed in | 401 | "Sign in to use an access code." |

Do not tell the user whether the code exists, expired, was revoked, was used up, or was issued to a different email.

**Student API:** `POST /api/access-codes/redeem` body `{ code: string }`. Auth required. The handler: rate-limit → normalize → hash → RPC → map errors → on success, apply is already done in the RPC, then log `session_events` (`access_code_redeemed`, detail `{ grant_type, redemption_limit, source: "passcode", last4 }` — never the plaintext or hash) and optionally email the admin (section 8). Failures of the notify email are logged as `email_failed` and never block redemption.

---

## 4. Entitlements and billing

Implement **one** helper, `lib/entitlements.ts`, and use it in "Start new paper", `/api/checkout`, the Stage 4 audio upsell, `/app`, `/app/billing`, and `/pricing` CTAs for signed-in users.

```ts
export type FundingSource = "unlimited" | "free_paper" | "purchased_credit" | "passcode_credit" | "paywall";

export function isUnlimitedActive(profile: Profile, now = new Date()): boolean {
  return profile.unlimited_access === true &&
    (profile.unlimited_until == null || new Date(profile.unlimited_until) > now);
}

export function getEntitlement(profile: Profile, now = new Date()): {
  funding: FundingSource;
  canStartPaper: boolean;
  showCheckout: boolean;
  showAudioUpsell: boolean;
  audioIncluded: boolean;
  dashboardLabel: string;
}
```

Rules:

- If guardian status is `pending` or `expired`, `canStartPaper` is false (existing guardian helper still wins). The student may still redeem a code; they just cannot start a paper until consent is granted.
- `isUnlimitedActive` → `funding: "unlimited"`, `canStartPaper: true`, `showCheckout: false`, `showAudioUpsell: false`, `audioIncluded: true`, label `"Unlimited access"`. Starting a paper does not consume credits and does not set `free_paper_used`.
- Else if `!free_paper_used` → existing free-paper path (`is_free_paper=true`, audio locked unless `profile.audio_included`).
- Else if `paper_credits > 0` → consume 1 `paper_credits`, `funded_by='pack3'` when the credit originated as a pack, otherwise keep existing behavior for `feedback_credit` consumption (today both live in `paper_credits` and start a paper with audio unlocked, as pack and feedback credits already include audio).
- Else if `passcode_credits > 0` → consume 1 `passcode_credits`, `funded_by='access_code'`, `audio_unlocked` from the grant (default true), analytics `source=passcode`.
- Else → paywall (`showCheckout: true`).
- `showAudioUpsell` is true only when the current paper has `!audio_unlocked` and the profile is not unlimited and not `audio_included`. Unlimited and `audio_included` profiles never see the $1.99 upsell and never see Stripe checkout for audio.
- `POST /api/checkout` must refuse with 400 if `showCheckout` is false.

**Refunds:** "Unused paper credits and unused packs can be refunded within 14 days of purchase" applies only to paid `purchases` (`single`, `pack3`) and only to `profiles.paper_credits`. `passcode_credits` are not refundable and are not decremented in a Stripe refund. Audio add-ons remain non-refundable.

**Feedback credits:** `grant_feedback_credit` is unchanged: it increments `paper_credits` and inserts `kind='feedback_credit'`. It does not read or write `passcode_credits`. Unlimited users may still upload professor feedback (coded data is useful); the credit increment still goes to `paper_credits`.

**Revenue / SOP:** any revenue total, conversion rate, or ARPU query excludes `purchases.kind = 'access_code'` and `amount_cents = 0`. Admin SOP and analytics count passcode papers and redemptions separately as `source=passcode`. Do not treat passcode activity as paid conversion.

**Audit purchase row:** on a successful credits grant, insert `purchases` with `kind='access_code'`, `amount_cents=0`, `status='paid'`, `stripe_session_id=null`. Unlimited and audio grants log `session_events` and `access_code_redemptions` only (no fake revenue row required; a zero-amount `access_code` row is also acceptable if it is easier to keep a single ledger — if inserted, it is excluded from revenue the same way).

---

## 5. Storage, RLS, and migration

File: `supabase/migrations/0004_access_codes.sql` (additive; run after 0001 and 0002).

```sql
-- enum values in their own statements before use
alter type purchase_kind add value if not exists 'access_code';

create type access_code_redemption_limit as enum (
  'single_use',
  'multi_use',
  'unlimited_redemptions'
);

create type access_code_grant_type as enum (
  'unlimited',
  'credits',
  'audio'
);

create table access_codes (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique,
  last4 text not null,
  label text not null,
  grant_type access_code_grant_type not null,
  credits int check (credits is null or credits >= 1),
  unlimited boolean not null default false,
  audio_included boolean not null default true,
  redemption_limit access_code_redemption_limit not null,
  max_redemptions int check (max_redemptions is null or max_redemptions >= 1),
  redemption_count int not null default 0 check (redemption_count >= 0),
  expires_at timestamptz,
  restricted_email text,
  notify_on_redeem boolean not null default true,
  is_vanity boolean not null default false,
  created_by uuid references auth.users,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint access_codes_grant_consistency check (
    (grant_type = 'unlimited' and unlimited = true and credits is null)
    or (grant_type = 'credits' and unlimited = false and credits is not null)
    or (grant_type = 'audio' and unlimited = false and credits is null and audio_included = true)
  ),
  constraint access_codes_limit_consistency check (
    (redemption_limit = 'single_use' and max_redemptions = 1)
    or (redemption_limit = 'multi_use' and max_redemptions >= 2)
    or (redemption_limit = 'unlimited_redemptions' and max_redemptions is null)
  )
);

create table access_code_redemptions (
  id uuid primary key default gen_random_uuid(),
  code_id uuid not null references access_codes on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  redeemed_at timestamptz not null default now(),
  ip_hash text,
  unique (code_id, user_id)
);

create table access_code_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete set null,
  ip_hash text not null,
  success boolean not null,
  created_at timestamptz not null default now()
);
create index on access_code_attempts (ip_hash, created_at);
create index on access_code_attempts (user_id, created_at);

alter table profiles
  add column unlimited_access boolean not null default false,
  add column unlimited_until timestamptz,
  add column audio_included boolean not null default false,
  add column passcode_credits int not null default 0,
  add column access_code_id uuid references access_codes;

create index on access_code_redemptions (code_id, redeemed_at desc);
create index on access_codes (created_at desc);

alter table access_codes enable row level security;
alter table access_code_redemptions enable row level security;
alter table access_code_attempts enable row level security;

-- No policies for authenticated or anon: no client read or write.
-- Access is only via the security-definer RPC (redeem) or the service-role
-- client on the server after an is_admin check (create, list, revoke).

create or replace function redeem_access_code(p_code_hash text, p_ip_hash text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_email text;
  v_code access_codes%rowtype;
begin
  if v_user is null then
    return jsonb_build_object('ok', false, 'error', 'unauthenticated');
  end if;

  if p_code_hash is null or length(p_code_hash) < 32 then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;

  select * into v_code
  from access_codes
  where code_hash = p_code_hash
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;

  if v_code.revoked_at is not null then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;

  if v_code.expires_at is not null and v_code.expires_at < now() then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;

  if exists (
    select 1 from access_code_redemptions
    where code_id = v_code.id and user_id = v_user
  ) then
    return jsonb_build_object('ok', false, 'error', 'already_redeemed');
  end if;

  if v_code.max_redemptions is not null
     and v_code.redemption_count >= v_code.max_redemptions then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;

  select lower(email) into v_email from profiles where user_id = v_user;
  if v_code.restricted_email is not null
     and v_email is distinct from lower(v_code.restricted_email) then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;

  -- increment first; the unique (code_id, user_id) constraint and row lock
  -- make concurrent single-use redemptions serialize to exactly one success
  update access_codes
     set redemption_count = redemption_count + 1
   where id = v_code.id
     and (max_redemptions is null or redemption_count < max_redemptions);

  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;

  insert into access_code_redemptions (code_id, user_id, ip_hash)
  values (v_code.id, v_user, p_ip_hash);

  if v_code.grant_type = 'unlimited' then
    update profiles set
      unlimited_access = true,
      audio_included = true,
      access_code_id = v_code.id
    where user_id = v_user;
  elsif v_code.grant_type = 'credits' then
    update profiles set
      passcode_credits = passcode_credits + v_code.credits,
      audio_included = audio_included or v_code.audio_included,
      access_code_id = coalesce(access_code_id, v_code.id)
    where user_id = v_user;
  elsif v_code.grant_type = 'audio' then
    update profiles set
      audio_included = true,
      access_code_id = coalesce(access_code_id, v_code.id)
    where user_id = v_user;
    update papers set audio_unlocked = true
    where user_id = v_user and audio_unlocked = false;
  end if;

  if v_code.grant_type = 'unlimited' or
     (v_code.grant_type = 'credits' and v_code.audio_included) then
    update papers set audio_unlocked = true
    where user_id = v_user and audio_unlocked = false;
  end if;

  return jsonb_build_object(
    'ok', true,
    'grant_type', v_code.grant_type,
    'credits', v_code.credits,
    'audio_included', v_code.audio_included,
    'unlimited', v_code.unlimited,
    'label', v_code.label,
    'last4', v_code.last4,
    'notify_on_redeem', v_code.notify_on_redeem,
    'code_id', v_code.id
  );
end;
$$;

revoke all on function redeem_access_code(text, text) from public;
grant execute on function redeem_access_code(text, text) to authenticated;

-- callers must already be the signed-in user (auth.uid()); the function
-- uses that id and never accepts a user_id argument.
```

Notes:

- `ip_hash` is `sha256(PASSCODE_PEPPER + ":ip:" + client_ip)` computed in the Route Handler. If the IP is missing, hash the string `unknown`.
- `restricted_email` is stored lowercased.
- Granting unlimited does not overwrite an existing later `unlimited_until` unless you also set one (v1 does not set it).
- If a user already has `unlimited_access` and redeems a credits code, credits still add to `passcode_credits` (harmless; funding order prefers unlimited).
- Profiles remain readable by the owning user (existing RLS). Do not expose `access_codes` or hashes through a profile select join on the client; the dashboard only needs the entitlement columns already on `profiles`.

---

## 6. Env

Add to `.env.example` and `lib/env.ts` (required in production; throw a clear startup error if missing in production / preview):

```
PASSCODE_PEPPER                  # server only; 32+ byte hex; used to hash access codes and IP addresses
```

Generate with `openssl rand -hex 32`. Set in Vercel for Production and Preview (not required in Development if you also set it in `.env.local` for local redeem tests). Never log this value. Do not print `process.env.PASSCODE_PEPPER`.

---

## 7. Email

New Resend template `AccessCodeRedeemedAdmin`, sent only when `notify_on_redeem` is true, to `ADMIN_NOTIFY_EMAIL`, from the existing `EMAIL_FROM` (`RetainWrite Coach <coach@send.retainwrite.com>`).

**Subject:** Access code redeemed — {label}

> A passcode was redeemed.
>
> Label: {label}
> Code (last 4): RW-••••-{last4}
> Grant: {grant_summary}
> Account: {user_email}
> When: {redeemed_at}
>
> Redemptions: {redemption_count}{max_display}
>
> Review: {SITE_URL}/admin/passcodes/{code_id}

Wrap in try/catch; log `email_failed`; never block the student. The per-code notify toggle defaults to on; the owner can turn it off for a high-volume classroom code.

---

## 8. Abuse and audit

- **Rate limit:** 5 redemption attempts per 15 minutes per IP **and** per user (whichever hits first). Count rows in `access_code_attempts` in the last 15 minutes before calling the RPC. Record every attempt (`success` true/false). Do not store the code or its hash on the attempts row.
- **Audit:** `access_code_redemptions` is the source of truth for successful redemptions. Admin detail view lists them. `session_events` gets `access_code_redeemed` (and `access_code_redeem_failed` with only `{ reason: "invalid" | "already_redeemed" | "rate_limited" }`).
- Failed-admin-create attempts by non-admins never reveal whether a label or vanity code exists; the route 404s before any lookup.

---

## 9. Guardrails (unchanged)

- Coaching only. A passcode does not unlock any "write this for me" behavior. `// SOP: coaching only, never generate submission text` remains at every AI call site. `lib/ai/guard.ts` is unchanged.
- Age gate unchanged. Under-13: no account. Ages 13–17: guardian email + confirmation before the first paper or upload, even if a passcode has already been redeemed.
- Style metrics remain feedback-only.

---

## 10. Routes and files to add

- `supabase/migrations/0004_access_codes.sql`
- `lib/access-codes/generate.ts`, `normalize.ts`, `hash.ts` (pepper from `lib/env.ts`)
- `lib/entitlements.ts` (+ Vitest)
- `app/admin/passcodes/page.tsx`, `app/admin/passcodes/[id]/page.tsx`
- `app/api/admin/passcodes/route.ts`, `app/api/admin/passcodes/[id]/route.ts`
- `app/api/access-codes/redeem/route.ts`
- UI fragment `components/access-code-form.tsx` used on `/signup` and the paywall
- `emails/AccessCodeRedeemedAdmin.tsx`
- Update `lib/config.ts` only if needed for copy; prices stay `{ single: 900, pack3: 1500, audio: 199 }`
- Update README: env var, how to seed the first admin, how to mint the first code

---

## 11. Acceptance criteria and tests

### Product acceptance

- An admin can create single-use, multi-use, and unlimited-redemption codes, with unlimited / N-credit / audio grants, optional expiry, optional email restriction, optional vanity code, and a label.
- The full code is shown once at creation and never again. List views show only last 4.
- A non-admin cannot open `/admin/passcodes` or call the admin API (404).
- Redeeming a valid unlimited code on signup or on the paywall grants unlimited papers with audio, hides Stripe checkout, and hides the Stage 4 audio upsell.
- Redeeming a credits code increments `passcode_credits`, not `paper_credits`. Starting papers consumes `paper_credits` before `passcode_credits`. A Stripe refund of a pack does not touch `passcode_credits`.
- Invalid, expired, used-up, revoked, and wrong-email codes all show "That code isn't valid."
- The code field is on signup and the paywall, not on Stage 1.
- Guardian-pending users can redeem but cannot start a paper until consent is granted.
- Revenue totals exclude passcode grants. SOP/analytics can filter `source=passcode`.

### Vitest / integration

- `normalize`: case, hyphens, `i/l → 1`, `o → 0`, stable canonical form.
- `generate`: only Crockford symbols, `RW-XXXX-XXXX` shape, no ambiguous chars.
- `hash`: deterministic with a test pepper; different pepper → different hash.
- Vanity validation accepts/rejects as specified.
- `getEntitlement` matrix: unlimited, unlimited_until expired, free paper, purchased credits, passcode credits, paywall, `audio_included`, guardian pending.
- Checkout route refuses when `showCheckout` is false.
- Refund helper ignores `passcode_credits`.
- Rate limiter: 6th attempt in 15 minutes returns 429.
- Admin create/list unauthorized → 404.
- **Race test (required):** two simultaneous `redeem_access_code` calls for the same `single_use` code hash, two different users, inside one transaction/connection pool, yield **exactly one** `ok: true` and `redemption_count = 1`. Cover this with a SQL/integration test (two concurrent clients). A second redeem by the winning user returns `already_redeemed`.

---

## 12. Seed: first admin and the first unlimited code (after first deploy)

Do **not** bake a known code or admin email into the repo or the migration.

1. Sign up on retainwrite.com with the owner's account (the email you will administer from).
2. In the Supabase SQL editor, run (replace the email):

```sql
update profiles
   set is_admin = true
 where lower(email) = lower('OWNER_EMAIL_HERE');
```

3. Confirm `PASSCODE_PEPPER` is set in Vercel for Production and Preview (`openssl rand -hex 32` if it is not set yet), then redeploy if you just added it.
4. Open `https://retainwrite.com/admin/passcodes`, sign in as that account.
5. Create a code:
   - Label: `Angie test`
   - Redemption limit: `unlimited_redemptions` (so a second test account can use it if needed) — or `single_use` if it should be one person only
   - Grant: `unlimited` (unlimited papers, audio included)
   - Expiry: none
   - Restricted email: optional, set to her address if the code should not be reusable by anyone else
   - Notify on redeem: on
6. Copy the code from the one-time modal and send it to her on a private channel. She signs up (or opens the paywall if she already has an account), clicks **Have an access code?**, and pastes it. She should see "unlimited papers, including audio" and never be asked for a card.
7. Confirm a row appears on the code's redemptions list and that `ADMIN_NOTIFY_EMAIL` received the notify email.

To make a later promo or classroom code, use the same form with `multi_use` + `max_redemptions` and a credits grant.

---

## 13. Open questions

None that block the build. Decisions above stand: `is_admin` (not a new `role` column), RPC takes a hash not plaintext, grants do not expire after redemption, credit ledgers are split, and the free first paper is preserved under an unlimited grant.
