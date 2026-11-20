# RetainWrite — Cursor Build Prompt (paste everything below this line into Cursor)

You are building **RetainWrite** (retainwrite.com), a student paper-writing COACHING app. It coaches students through writing their own paper in six gated stages. It NEVER writes the submission for the student. Build a complete, production-ready Next.js app in this repo.

## 0. Stack and conventions
- Next.js 14+ App Router, TypeScript (strict), Tailwind CSS, shadcn/ui components.
- Supabase (Postgres + Auth + Storage) via `@supabase/ssr` and `@supabase/supabase-js`.
- Stripe Checkout (one-time payments, NO subscriptions) via `stripe` (server) and `@stripe/stripe-js` (client).
- Resend via `resend` + `@react-email/components` for transactional email.
- xAI Grok via the official `openai` npm SDK (`baseURL: "https://api.x.ai/v1"`, `apiKey: process.env.GROK_API_KEY`). Do not use `@anthropic-ai/sdk`.
- Google Cloud Text-to-Speech Chirp 3 HD for Stage 4 audio beats.
- Zod for all input validation. Server Actions or Route Handlers for all mutations; never trust the client.
- Deployed on Vercel. Domain: https://retainwrite.com. Sending domain: send.retainwrite.com.

### Environment variables (already defined or to be set in Vercel; use EXACTLY these names, do not invent others)
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY        # server only, never import in client code
RESEND_API_KEY                   # server only
STRIPE_SECRET_KEY                # server only
STRIPE_PUBLISHABLE_KEY           # expose to client by reading it in a server component and passing as prop (do NOT rename to NEXT_PUBLIC_)
STRIPE_WEBHOOK_SECRET            # server only
GROK_API_KEY                     # server only, xAI API key for all Grok calls
GOOGLE_CLOUD_TTS_API_KEY         # server only
GOOGLE_CLOUD_TTS_VOICE_ID        # server only; optional, default en-US-Chirp3-HD-Charon
ADMIN_NOTIFY_EMAIL               # server only, not a secret
UNPAYWALL_EMAIL                  # server only, not a secret; Unpaywall contact email
CRON_SECRET                      # server only
MISTRAL_OCR_API_KEY              # server only, OPTIONAL; scanned-PDF OCR is off if missing
```
Do not add `ANTHROPIC_API_KEY`, `ELEVENLABS_API_KEY`, or `ELEVENLABS_VOICE_ID`. Create `lib/env.ts` that validates the required vars with Zod at startup and throws a clear error if any required server var is missing. `GOOGLE_CLOUD_TTS_VOICE_ID` falls back to `TTS_VOICE_DEFAULT` if unset. `MISTRAL_OCR_API_KEY` is optional. In development, missing `GROK_API_KEY` or `GOOGLE_CLOUD_TTS_API_KEY` enables rule-based fallbacks only (TTS skipped). Create `.env.example` listing every name above with empty values.

Constants in `lib/config.ts`:
```ts
export const SITE_URL = "https://retainwrite.com";
export const EMAIL_FROM = "RetainWrite <hello@send.retainwrite.com>";
export const PRICES = { single: 900, pack3: 1500, audio: 199 }; // cents, USD
export const PACK3_CREDITS = 3;
export const MIN_VOICE_SAMPLE_WORDS = 150;          // AI checker voice check only
export const STAGE1_VOICE_MIN_WORDS = 250;          // Stage 1 embedded voice sample
export const STAGE1_VOICE_MIN_LONG_ANSWERS = 2;
export const STAGE1_VOICE_MIN_LONG_ANSWER_WORDS = 40;
export const WORDS_PER_PAGE_DOUBLE_SPACED = 275;
export const MODEL_FAST = "grok-4.3";   // live probing / classification / Stage 1 questions
export const MODEL_STRONG = "grok-4.7"; // assignment parsing, rubric, section feedback, extraction, coding
export const TTS_VOICE_DEFAULT = "en-US-Chirp3-HD-Charon";
```

### AI client (xAI Grok) and TTS
- Use the official `openai` npm SDK with `baseURL: "https://api.x.ai/v1"` and `apiKey: process.env.GROK_API_KEY`. Do **not** install or use `@anthropic-ai/sdk`. Plain `fetch` to `https://api.x.ai/v1/chat/completions` is also fine.
- Structured JSON via `response_format: { type: "json_schema", json_schema: { name, strict: true, schema } }` (supported by xAI). Always validate with Zod. If a schema is rejected, retry with `response_format: { type: "json_object" }` + Zod. The coaching-only code guard stays: reject any AI output that rewrites the student's work. Add `// SOP: coaching only, never generate submission text` at every AI call site.
- `MODEL_FAST` (`grok-4.3`) for live probing/classification, with `reasoning_effort: "none"`. `MODEL_STRONG` (`grok-4.7`) for assignment parsing/extraction, rubric evaluation, section feedback, source extraction, and feedback coding, with `reasoning_effort: "low"` unless a task clearly benefits from more. IDs verified against https://docs.x.ai/developers/models (19 Nov 2026).
- TTS: implement `lib/audio/tts.ts` with Google Cloud Text-to-Speech Chirp 3 HD (`GOOGLE_CLOUD_TTS_API_KEY`, voice `GOOGLE_CLOUD_TTS_VOICE_ID` or `TTS_VOICE_DEFAULT`, MP3). Send only beat-script text, never student writing. Optional `MISTRAL_OCR_API_KEY` for scanned PDFs (feature off if missing). `UNPAYWALL_EMAIL` is the contact email for the Unpaywall open-access fallback.

## 1. Product rules (hard requirements — enforce in code, not just UI)
1. **Coaching only.** No feature generates paper prose for submission. AI (if added later) may ask questions, give feedback, and summarize sources for study. Add a code comment `// SOP: coaching only, never generate submission text` at every AI/text-generation touchpoint.
2. **Stage gates.** A student cannot open stage N+1 until stage N is marked `complete`. Gate checks happen server-side in a single helper `assertStageUnlocked(paperId, stage)` used by every stage page and action.
3. **Real input required.** Each stage defines minimum input requirements (below). "Thin" answers trigger a follow-up probe instead of advancing.
4. **Pricing.** First paper free (all stages, NO audio, no card at signup). After that: $9 per paper, or $15 for a 3-paper pack (audio included on pack papers, credits never expire). Audio add-on $1.99 per paper, offered mid-flow (Stage 4) only. No subscriptions anywhere.
5. **Style metrics are for feedback only.** They power the mismatch warning and revision coaching. Never use them to generate text.
6. **Log every session** for SOP improvement (session_events table).

## 2. Data model (Supabase SQL migration: `supabase/migrations/0001_init.sql`)
Enable RLS on every table. Users may only read/write their own rows (`auth.uid() = user_id`). Service role bypasses RLS for webhooks.

```sql
create type stage_status as enum ('locked','in_progress','complete');
create type formality_level as enum ('casual','neutral','formal');
create type purchase_kind as enum ('single','pack3','audio');
create type purchase_status as enum ('pending','paid','failed','refunded');

create table profiles (
  user_id uuid primary key references auth.users on delete cascade,
  email text not null,
  display_name text,
  school_level text,                -- e.g. high school, undergrad, grad
  free_paper_used boolean not null default false,
  paper_credits int not null default 0,   -- from packs; never expire
  created_at timestamptz not null default now()
);

create table papers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  title text,
  course text,
  due_date date,
  assignment_prompt text,
  required_length text,
  citation_style text,
  is_free_paper boolean not null default false,
  funded_by purchase_kind,           -- null when free paper
  audio_unlocked boolean not null default false,
  current_stage int not null default 1 check (current_stage between 1 and 6),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table stage_progress (
  paper_id uuid references papers on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  stage int not null check (stage between 1 and 6),
  status stage_status not null default 'locked',
  data jsonb not null default '{}',  -- stage answers
  completed_at timestamptz,
  primary key (paper_id, stage)
);

create table style_profiles (            -- one per paper, from Stage 1 voice sample (see 0005 for additive columns)
  paper_id uuid primary key references papers on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  raw_sample text not null,
  word_count int not null,
  avg_sentence_length numeric not null,  -- words per sentence
  reading_grade numeric not null,        -- Flesch-Kincaid grade
  formality formality_level not null,
  formality_score numeric not null,      -- 0 (casual) .. 1 (formal)
  top_content_words jsonb not null,      -- [{word, count}] top 10
  vocabulary jsonb not null,             -- array of distinct lowercase content words in sample
  created_at timestamptz not null default now()
);

create table drafts (
  id uuid primary key default gen_random_uuid(),
  paper_id uuid not null references papers on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  version int not null,
  body text not null,
  metrics jsonb not null,               -- same shape as style metrics
  mismatch jsonb,                       -- result of mismatch check
  created_at timestamptz not null default now()
);

create table sources (
  id uuid primary key default gen_random_uuid(),
  paper_id uuid not null references papers on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  title text,
  storage_path text,                    -- Supabase Storage bucket 'sources' (private)
  rights_confirmed boolean not null default false,
  beats jsonb not null default '[]',    -- [{passage, why_it_matters, audio_path}]
  created_at timestamptz not null default now()
);

create table purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  paper_id uuid references papers,
  kind purchase_kind not null,
  amount_cents int not null,
  stripe_session_id text unique,
  stripe_payment_intent text,
  status purchase_status not null default 'pending',
  created_at timestamptz not null default now()
);

create table session_events (            -- SOP logging
  id bigserial primary key,
  user_id uuid references auth.users on delete set null,
  paper_id uuid references papers on delete cascade,
  stage int,
  event text not null,                  -- e.g. stage_started, probe_shown, stage_completed, upsell_shown, upsell_declined, mismatch_warned
  detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table professor_feedback (        -- feedback loop: earns 1 free credit
  id uuid primary key default gen_random_uuid(),
  paper_id uuid not null unique references papers on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  grade text,
  storage_path text not null,
  consent_given boolean not null,
  coded jsonb not null default '{}',    -- {praise:[{category,quote}], flags:[...]} categories: thesis,evidence,organization,citation,voice,mechanics
  credit_granted boolean not null default false,
  created_at timestamptz not null default now()
);
```
Also: trigger to insert a `profiles` row on `auth.users` insert; trigger to keep `papers.updated_at` fresh; when a paper is created, insert stage_progress rows 1–6 with stage 1 `in_progress` and 2–6 `locked`. Storage buckets: `sources`, `feedback`, `audio`, `assignments` (all private, RLS by user folder `${user_id}/...`). The `assignments` bucket is created in migration `0005_stage1_assignment_first.sql`.

Generate TypeScript types into `lib/database.types.ts`.

## 3. Auth
- Supabase Auth: email magic link + email/password. No card at signup.
- Pages: `/login`, `/signup`, `/auth/callback`. Middleware refreshes the session and protects `/app/**`.
- On first signup, send the Welcome email (section 8).

## 4. Six stages (routes under `/app/papers/[paperId]/stage/[n]`)
The six-stage structure is unchanged: intake, stance interview, outline, sources and audio beats, draft, revise and feedback. Only Stage 1's internals change (assignment first). Shared UI: left rail showing stages 1–6 with lock icons; conversational one-question-at-a-time panel; "Continue" disabled until requirements met. Every question answered logs a `session_events` row.

**Thin-answer detection** (`lib/coaching/thin.ts`): an answer is thin if under its min word count, is a stock phrase ("idk", "not sure", "whatever", "n/a"), or repeats the question. Thin → show a scripted follow-up probe (stored per question), log `probe_shown`, do not advance. Max 2 probes, then allow "I'm stuck — flag for help" which saves and lets them continue.

### Stage 1 — Intake (assignment first)
Full spec: `retainwrite-stage1-intake-spec.md` (that doc wins on Stage 1). Additive migration `supabase/migrations/0005_stage1_assignment_first.sql` (0003 is the AI checker, 0004 is access codes). The six-stage structure is unchanged; only Stage 1's internals change, and nothing in Stage 1 advances until the student confirms the parsed assignment.

1. **Upload first.** The student uploads the full assignment (PDF / DOCX / image / pasted text), multiple files plus an optional link list. Extract text; if a PDF or image has no text and `MISTRAL_OCR_API_KEY` is set, run Mistral OCR, otherwise ask them to paste and log `ocr_skipped`. Store files in the private `assignments` bucket. Paste is allowed on the assignment prompt (teacher text), not on later voice-sample answers.

2. **Assignment card.** `MODEL_STRONG` (`grok-4.7`, `reasoning_effort: "low"`) extracts a structured `assignment_requirements` JSON (Zod schema in the Stage 1 spec): paper type, topic/question, length, citation style, formatting rules, required sources, provided readings, structural requirements, due date, rubric criteria with weights, other instructions, optional AI-policy flag. Convert pages to a word estimate at `WORDS_PER_PAGE_DOUBLE_SPACED` (275), labeled as an estimate; never overwrite an explicit word count. Each field has a confidence score; low-confidence (< 0.6) or missing fields are highlighted. The student must confirm or edit every field ("Looks right" per field, or confirm-all after review). Nothing is inferred silently. Required before continue: topic or prompt question, plus length and citation style or an explicit "Not specified." Sync confirmed values onto the existing `papers` columns (`course`, `due_date`, `assignment_prompt`, `required_length`, `citation_style`).

3. **Get to know you, then coaching questions** (only after confirm). First a short, **skippable**, adaptive "get to know you" conversation (3–5 questions: what they care about, hobbies, interests, favorite topics, people they follow, what they'd rather be doing). Start with ~2 interest questions, and weave any remainder into coaching when a natural opening appears (cap 5). Store an `interest_profiles` row (one per user): tags plus the student's own words. Privacy: used only to personalize this student's coaching, never shown to others, deletable; do not ask or infer health, religion, politics, or sexuality (use volunteered content only if it is relevant to this assignment, and never as a standing tag). Then `MODEL_FAST` (`grok-4.3`, `reasoning_effort: "none"`) asks assignment-grounded coaching questions, one at a time, adaptive (dig deeper vs. move on). Example: a 5–7 page APA paper on the value of margin for business owners that must cite 3 leaders who speak about margin → "Do you have any leaders in mind who've talked about margin? Who are you curious to look into?" If they don't know, offer 2–4 example names with a one-line why (e.g. Alex Hormozi on pricing and gross margin) as suggestions to research, not citations; optionally search terms, source types, or links to that person's own books/talks where known. Use the interest profile to steer leads toward things the student finds engaging and authentic while still satisfying the assignment (each interest-steered lead must say why it fits the assignment AND the interest). Illustrative pattern only — do not bake any celebrity–organization pairing in as fact: a student who loves music and names an artist they admire might be offered a related figure, collaborator, or project as a lead, if and only if it also meets the requirement; Stage 4 verifies with real sources and drops leads it cannot verify. If scholarly sources are required, an interest lead may be a hook or example and the card must say scholarly support is still required. Never present unverified quotes or fabricate citations. Every suggestion is marked `to_verify` and stored in `research_leads` for Stage 4. The student chooses; the AI never decides. Fold in brief assignment-tied background (year, major, comfort with the citation style, prior grades/feedback) — not a generic survey. Always include one open-ended personal question: why this topic matters / a personal experience (min 40 words). Always capture an early stance (min 25 words) to hand to Stage 2 as `originalThesis`. After lead suggestions, optionally ask a skippable 1–5 "How interesting do these options feel?" for SOP/retention logging.

4. **Voice capture is embedded.** Paste-blocked answers to the interest, coaching, personal, and fallback questions ARE the voice sample (they count toward the minimum). Minimum: `STAGE1_VOICE_MIN_WORDS` (250) across those answers, at least `STAGE1_VOICE_MIN_LONG_ANSWERS` (2) answers of ≥ `STAGE1_VOICE_MIN_LONG_ANSWER_WORDS` (40), including the personal question at ≥ 40 words. If short, show a fallback prompt (still assignment-grounded). Compute `StyleMetrics` (section 5, including additive variance / register / tone-marker fields) and save `style_profiles`. Reuse the AI checker's `voice_profiles` table (do not fork). If a `voice_profiles` row younger than 180 days exists, offer "Keep this baseline" or "Refresh it with this paper" (see the Stage 1 spec). Show the same friendly readout: "Your natural voice: ~X words per sentence, grade-level Y, Z tone. Your go-to words: ..."

5. **Gate.** Stage 1 completes only when the assignment card is student-confirmed, the voice minimum is met, an early stance (≥ 25 words) is saved, and the student clicks "Start stance interview." Stage 2 then receives the confirmed requirements, early ideas/stance, and research leads.

API routes, schema, microcopy, edge cases (no rubric, vague prompt, multiple assignments in one file, image-only, non-English, teacher forbids AI, failed link fetch), and SOP logging (including personalized vs. generic lead pickup and 1–5 interest ratings) are in the Stage 1 spec. Implement them.

### Stage 2 — Stance interview (counterargument moves)
- Seed table/JSON `lib/coaching/moves.ts` with 5 move types: alternative_explanation, scope_limit, conflicting_evidence, opposing_stakeholder, definition_challenge. Each has 2–3 templated prompts with `{claim}` slot.
- Flow: pick a move, fill `{claim}` with the student's own stance wording, ask ONE challenge, wait for the student's written reply (min 30 words). Give short scripted feedback, probe if thin. Run 3 moves. Never generate a rebuttal for them. Log move id + response.
- Complete after 3 answered moves + a refined thesis statement (min 15 words) written by the student.

### Stage 3 — Outline
- Student builds their own outline: thesis (prefilled from Stage 2, editable), 3–5 main points, each with the evidence they plan to use. Drag-to-reorder.
- Coach checks structure only (every point has evidence, points tie to thesis) with rule-based feedback. No auto-generated outline.
- Complete when thesis + ≥3 points each with ≥1 evidence note.

### Stage 4 — Sources & study beats (+ audio upsell)
- Upload course PDFs/pages to `sources` bucket. Required checkbox per upload: "I'm allowed to use this material for my coursework." Copy: "We summarize for your personal study and never redistribute publisher content."
- For each source, create study beats: `{passage (short quote ≤ 2 sentences), why_it_matters (student's thesis connection)}`. Implement `lib/research/extract.ts`: extract PDF text first; if a PDF has no extractable text and `MISTRAL_OCR_API_KEY` is set, run Mistral OCR, otherwise skip scanned pages and log `ocr_skipped`. Unpaywall open-access fallback uses `UNPAYWALL_EMAIL` as the required contact email. `MODEL_STRONG` writes beat scripts (source summaries for study, never student prose). Store beats in `sources.beats`. Full written beats always visible.
- **Audio upsell (mid-flow):** after the first source's beats render, if `!paper.audio_unlocked` (pack papers already have audio; free and single papers can buy it for $1.99), show a dismissible card:
  > 🎧 **Take this with you?** We pulled the key points from your sources. For $1.99 we'll turn them into short audio beats for a drive or a walk. [Make it audio — $1.99] [Not now]
  "Not now" sets a sessionStorage flag + logs `upsell_declined`; do not show again that session.
- Audio playback: implement `lib/audio/tts.ts` with Google Cloud Text-to-Speech Chirp 3 HD (`GOOGLE_CLOUD_TTS_API_KEY`, voice `GOOGLE_CLOUD_TTS_VOICE_ID` or `TTS_VOICE_DEFAULT`, `audioEncoding: "MP3"`); store files in `audio` bucket; player per beat. Gate playback on `paper.audio_unlocked`. Send only beat-script text to TTS, never student writing.
- Complete when ≥1 source with ≥3 beats AND the student has written, for ≥3 beats, one sentence in their own words on how they'll use it.

### Stage 5 — Draft (student writes)
- Student writes or uploads their draft (textarea + .docx/.txt upload; parse .docx with `mammoth`). Save as a new `drafts` version.
- On save: compute metrics, run mismatch check (section 6), show warning if triggered.
- Side panel: their outline and beats for reference. No "write this for me" button anywhere.
- Complete when a draft ≥ 300 words is saved.

### Stage 6 — Revise & feedback
- Show draft vs. intake voice comparison (bar chart: sentence length, grade level, formality) with coaching tips ("your draft sentences average 31 words vs. your natural 14 — try splitting the longest ones").
- Rule-based revision checklist: thesis present in intro, each outline point appears, citations present per citation style, no beat used without student explanation.
- Student can save new versions; each re-runs mismatch check.
- Mark paper complete → send "Paper complete" email.
- **Professor feedback loop:** after completion, offer "Got your grade back? Upload your professor's grade + comments and get a free paper credit." Upload to `feedback` bucket with consent checkbox ("We use this only to issue your credit and improve coaching; never shared with your school or professor; delete anytime"). Prompt to redact classmates' info. On submit, admin review sets `credit_granted` → +1 `paper_credits`. One credit per paper (unique constraint).

## 5. Style metrics (`lib/style/metrics.ts`, pure functions + unit tests with Vitest)
```ts
export type StyleMetrics = {
  wordCount: number;
  avgSentenceLength: number;        // words / sentences
  sentenceLengthVariance: number;   // population variance of sentence lengths (additive; Stage 1 / checker share this)
  readingGrade: number;             // Flesch-Kincaid: 0.39*(words/sentences) + 11.8*(syllables/words) - 15.59
  formality: 'casual'|'neutral'|'formal';
  formalityScore: number;           // 0..1
  scholarlyRegisterScore: number;   // 0..1 academic register; deterministic, not a detector score
  toneMarkers: string[];            // e.g. 'first-person', 'hedging', 'contractions'
  topContentWords: {word:string; count:number}[]; // top 10, stopwords removed
  vocabulary: string[];             // distinct lowercase content words
};
```
- Sentence split on `.!?` followed by whitespace/end (handle abbreviations Mr., Dr., e.g., i.e.).
- Syllables: vowel-group heuristic with silent-e adjustment, min 1 per word.
- Stopwords: include a standard English list (~175 words) in `lib/style/stopwords.ts`.
- Formality score: start 0.5; subtract for contractions rate, first/second-person pronoun rate, slang/filler list (like, gonna, kinda, lol, stuff, things, really, super), exclamation marks; add for avg word length > 5, passive constructions, formal connectors (however, therefore, moreover, furthermore, consequently). Clamp 0..1. <0.4 casual, 0.4–0.65 neutral, >0.65 formal.

## 6. Mismatch warning (`lib/style/mismatch.ts`, unit tested)
Compare draft metrics to the paper's `style_profiles`:
- `complexityJump`: draft avgSentenceLength > 1.6× sample OR readingGrade > sample + 4.
- `formalityJump`: draft formalityScore − sample ≥ 0.35.
- `unseenVocab`: draft content words of length ≥ 8 not in sample vocabulary and not in the assignment prompt / source beats / outline; flag if > 12% of draft content words, list up to 8 examples.
Trigger warning if 2+ tells, or `unseenVocab` alone > 20%. Save result in `drafts.mismatch`, log `mismatch_warned`.

Warning UI (amber, non-blocking, never accusatory):
> **This reads differently from your writing sample.** We noticed: {tell list, e.g. "sentences average 32 words vs. 14 in your sample", "words that weren't in your sample: X, Y, Z"}. Your own voice is your strongest asset — try reworking these sections in your words.

Do not mention AI detectors or "avoiding flags" anywhere.

## 7. Payments (Stripe)
- `lib/stripe.ts` server client with `STRIPE_SECRET_KEY`.
- Use inline `price_data` (no pre-created Price IDs needed): single $9 "RetainWrite — 1 paper", pack3 $15 "RetainWrite — 3-paper pack (audio included)", audio $1.99 "Audio study beats — 1 paper".
- `POST /api/checkout` body `{kind, paperId?}` → creates a `purchases` row (pending) and a Checkout Session (mode `payment`, `client_reference_id` = purchase id, metadata {user_id, kind, paper_id}), success_url `/app/billing/success?session_id={CHECKOUT_SESSION_ID}`, cancel_url back to origin page. Return URL; client redirects.
- **Starting a new paper:** if `!free_paper_used` → free paper (`is_free_paper=true`, set `free_paper_used=true`, audio locked). Else if `paper_credits > 0` → consume 1 credit, `funded_by='pack3'`, `audio_unlocked=true`. Else → paywall screen offering $9 single or $15 for 3 (show "$5 per paper, audio included").
- `POST /api/stripe/webhook` (route must read raw body; `export const runtime = 'nodejs'`): verify with `STRIPE_WEBHOOK_SECRET`. On `checkout.session.completed`: idempotently mark purchase `paid` (skip if already paid); single → create paper funded `single`; pack3 → +3 `paper_credits` (then auto-consume 1 if they were mid "new paper" flow); audio → set `papers.audio_unlocked=true`. Send receipt email. Handle `checkout.session.expired` → `failed`. Use service role client here.
- `/app/billing`: credits remaining, purchase history.
- Pricing page `/pricing` (public): Free first paper, $9 single, $15 three-pack (audio included, credits never expire), $1.99 audio add-on. Copy: "Pay per paper. No subscription." Homepage blurb: "Your first paper is free, no card needed. After that, pay per paper or grab a 3-pack to save. Want to listen to your sources instead of rereading them? Add audio for $1.99, or get it included with any pack."

## 8. Email (Resend)
`lib/email/send.ts` wrapping Resend with `EMAIL_FROM`; templates in `emails/` with React Email:
- `Welcome` (on signup): what to expect, link to start first free paper.
- `StageComplete` (optional digest, on stages 1, 3, 5): encouragement + next step link.
- `Receipt` (on webhook paid): item, amount, credits remaining.
- `PaperComplete`: congrats + professor-feedback credit offer.
- `FeedbackCreditGranted`: credit added.
All sends are server-side, wrapped in try/catch, failures logged to `session_events` (event `email_failed`) and never block the user flow.

## 9. Pages / routes summary
Public: `/` (landing + how pricing works), `/pricing`, `/login`, `/signup`, `/terms`, `/privacy` (placeholders incl. student-upload rights and feedback-data use), `/blog`, `/blog/[slug]`, `/ai-checker`, `/ai-checker/rubric`, `/ai-checker/report/[token]`.
App: `/app` (dashboard: papers list, credits, "Start new paper"), `/app/papers/new`, `/app/papers/[id]` (redirects to current stage), `/app/papers/[id]/stage/[n]`, `/app/billing`, `/app/billing/success`.
Admin (gate on `profiles.is_admin` — add that boolean column): `/admin/feedback` to review professor-feedback uploads, code praise/flags, grant credits; `/admin/sop` showing session_events aggregates (probe rates per question, drop-off by stage, upsell take rate, mismatch rate).

## 10. Quality bar
- Vitest unit tests for metrics, mismatch, thin-answer detection, stage gating, webhook idempotency, Stage 1 confirm gate, page-to-word estimate (275), voice-minimum calculator, and interest-tag / lead `to_verify` rules (see the Stage 1 spec).
- Accessible (labels, focus states, keyboard nav), mobile-first.
- Loading and error states on every action.
- README with: setup, `supabase db push`, how to run the Stripe webhook locally (`stripe listen --forward-to localhost:3000/api/stripe/webhook`), and deploy notes.
- Do not hardcode any secrets. Use exactly the env var names listed in section 0; do not invent others. Do not add Anthropic or ElevenLabs keys.

Build it end to end now. Start with the migration, env validation, and lib/ utilities with tests, then auth, then stages 1–6, then payments, then email, then admin. Implement Stage 1 from `retainwrite-stage1-intake-spec.md` (that doc wins on Stage 1; migration `0005_stage1_assignment_first.sql`) — do not implement the old four-block intake. After each phase, run typecheck and tests and fix failures before moving on. Then build the public content phases below (blog, then the free AI checker). The checker has its own spec: `retainwrite-ai-checker-spec.md` (that doc wins on checker behavior).

## 11. Phase — Public blog (after admin)

Add `/blog` (index) and `/blog/[slug]` (MDX or Markdown posts in e.g. `content/blog/`). Clean, mobile-first, SEO title + description + canonical, listing page with date and excerpt. Marketing will supply posts; ship the routes and a placeholder post so the pages are not empty. RSS is optional. No chat UI. After this phase, typecheck and fix failures, then immediately build the AI checker in section 12 — do not wait for more blog content.

## 12. Phase — Free AI checker (after the blog)

Build the standalone free tool specified in `retainwrite-ai-checker-spec.md`. Routes: `/ai-checker` (landing + paste box + results), `/ai-checker/rubric` (public rubric v1.0, thresholds, changelog, "updates as detection methods evolve"), `/ai-checker/report/[token]` (shareable/printable report). Landing copy starts from `/workspace/retainwrite/ai-checker-landing-copy.md`, with the copy-alignment fixes in the checker spec section 6 (especially: 0–100 is Signal strength, not an authorship verdict; email gate; typed voice check; privacy FAQ).

### Product rules for this phase (enforce in code)
- Coaching only. Never rewrite, paraphrase, or "humanize" text; never offer alternate sentences. `lib/ai/guard.ts` applies. `// SOP: coaching only, never generate submission text` at every call site. Each named tell is a verbatim quote from the student's text plus a coaching question from the spec's bank.
- Ratings are pattern strength, not authorship probability. Label every 0–100 number **Signal strength**. Never "AI likelihood %," "chance AI wrote this," or similar. high/moderate/low = how strongly the pattern shows up.
- No detector-evasion framing: no "bypass," "beat Turnitin," "undetectable," "pass AI detection." Frame: "Does this sound like you?"
- Honesty disclaimer is visible in the report itself, the email, and the print view, not only on the landing page. Cite Liang et al. (2023) on the landing/rubric/FAQ. Claim no accuracy rate of our own.
- Checker needs no account. Preview is free. Voice check creates a free account and stores a `voice_profiles` baseline (vocabulary, tone, scholarly register). First paper stays free, no card.
- Privacy: drafts aren't stored unless the user is signed in and opts in; never used for training. Users must be 13+.
- Do not pad results. If signals are low, show "Your draft reads fine" / "Reads like you."

### Stack (same as the rest of the app)
- Grok via `openai` SDK, `baseURL: "https://api.x.ai/v1"`, `GROK_API_KEY`. `MODEL_FAST` (`grok-4.3`, `reasoning_effort: "none"`) for light classification; `MODEL_STRONG` (`grok-4.7`, `reasoning_effort: "low"`) for topic sentences and personal-specifics judgments. Zod-validate `response_format` `json_schema` (fallback `json_object`). Timeouts and `ai_fallback` as in the stage specs: deterministic signals still return if the model fails.
- Reuse `lib/style/metrics.ts` and mismatch thresholds for the vocabulary / register comparison when a voice profile exists. Reuse the shared voice-sample helpers (paste blocked, `StyleMetrics`, the same "we need your own typing here" note) for the checker's 150-word sample (`MIN_VOICE_SAMPLE_WORDS`). The checker's four questions and 150-word floor stay unchanged; Stage 1's 250-word minimum applies only to paper intake. Stage 1 writes or reuses the same `voice_profiles` row (do not fork).
- Resend from existing `EMAIL_FROM` (`RetainWrite Coach <coach@send.retainwrite.com>`). No new env vars.

### API, data, limits
- `POST /api/ai-checker/analyze`, `/unlock`, `/voice`, and `GET /api/ai-checker/unsubscribe`, plus cron `/api/cron/checker-retention` (Bearer `CRON_SECRET`). Request/response shapes are in the checker spec section 11.
- Migration `supabase/migrations/0003_ai_checker.sql`: `rubric_versions`, `ai_checker_runs` (counts and numeric scores only — no draft text), `ai_checker_reports` (result + quoted tells, 30-day TTL, token hash), `ai_checker_saved_runs` (signed-in opt-in full draft only), `ai_checker_leads` (source + UTM + marketing_consent default false + age_band), `voice_profiles`. RLS as in the spec. IP stored only as HMAC-SHA256 with `CRON_SECRET`.
- Word limits: min 120, max 4,000. Rate limits: 5/hour and 15/day per IP hash anonymous; 10/hour and 30/day unlocked or signed-in; 3 voice-check completions / user / day.

### Results report design (required in this phase)
Follow checker spec section 5 exactly.
- Each signal and each section shows a prominent 0–100 **Signal strength** score, with a tooltip and a footnote: it is how strongly the pattern appears in the text, not the chance AI wrote it. Overall `ReportSummaryRing` uses the same scale with a plain-language summary: **Reads like you** (0–39, headline "Your draft reads fine" when calibrated low), **A few generic spots** (40–69), **Several machine-like patterns** (70–100).
- Color + icons, never color alone, WCAG AA: green check **Keep** (0–39), amber **Worth a look** (40–69), coral/red flag **Fix first** (70–100). Flagged items expand to the quoted tell and a coaching question.
- **Email gate:** free preview = overall verdict/summary + top 2 signals. "Enter your email to get your full report" unlocks all seven signals, the per-section breakdown, and an emailed PDF/HTML copy via Resend from `coach@send.retainwrite.com`. Marketing consent checkbox unchecked by default, separate from report delivery, hidden for 13–17 (report delivery only, no marketing). CAN-SPAM unsubscribe + physical address 3629 Maizeland Rd, Colorado Springs, CO 80909 on marketing mail. Store leads in `ai_checker_leads` with source and UTM. Under-13 blocked.
- Bottom of the report: `UpsellPanel` with "Want even clearer results? Take this one-minute voice check" and "Start your free first paper" (free trial, no card).
- Premium aesthetic using the spec's design tokens (Newsreader + Source Sans 3, deep ink `#15202B`, warm off-white `#F6F1E8`, restrained terracotta accent `#9A4A2C`, generous spacing, card-based sections). Subtle motion: score count-up and ring fill, skipped when `prefers-reduced-motion`. Skeleton loading with staged progress copy. Mobile-first. Shareable/printable report view. **No chat-bubble UI.**
- Named components: `ReportSummaryRing`, `SignalCard`, `SectionHeatmap`, `EmailGate`, `UpsellPanel`.
- Meet the report acceptance criteria in spec section 5.7 and the product checklist in section 17.

### Rubric and calibration
Implement all seven v1.0 signals and the aggregation / "reads fine" count rules in spec sections 7–9. Do not add an eighth top-level signal. Vocabulary is `needs_voice` until a baseline exists (not scored, not treated as high). Unit-test metrics, stock-phrase clustering, calibration fixtures (clean → Reads like you; stock-heavy → high band; no padding of a clean draft), guard rejections, rate limits, and lead marketing-consent defaults.

After this phase, run typecheck and tests and fix failures.


## 13. Phase — Admin access passcodes (after payments and admin; may run before or after the checker)

Read and implement `/workspace/retainwrite-admin-passcodes-spec.md`. That doc wins on passcode and entitlement behavior. This is a general admin tool for creating access codes that skip Stripe and grant paper access (primary use: the owner issues an unlimited code so his wife can test with real papers).

### Product rules for this phase (enforce in code)
- Admin-only dashboard `/admin/passcodes` plus `POST/GET /api/admin/passcodes` and `GET/PATCH /api/admin/passcodes/[id]`. Gate on the existing `profiles.is_admin` boolean (do not add a `role` column). 404 for non-admins. Service role is server-only, after the admin check; never import `SUPABASE_SERVICE_ROLE_KEY` or `PASSCODE_PEPPER` in client code.
- Codes are `RW-XXXX-XXXX` in Crockford base32, CSPRNG, case-insensitive, optional vanity code. Store only SHA-256(`PASSCODE_PEPPER + ":" + canonical`) and `last4`. Show the full code once at creation, never again.
- Redemption limits: `single_use`, `multi_use` (max N), `unlimited_redemptions`. Grants: `unlimited` (unlimited papers, audio included), `credits` (N credits, audio included by default), `audio`. Optional expiry (redemption deadline only), label, email restriction, revoke. A user may redeem a given code only once.
- "Have an access code?" collapsible on `/signup` and the paywall/checkout screen only — not on Stage 1 intake. Inline validation. Generic error "That code isn't valid." for invalid/expired/used-up/revoked/wrong-email (no enumeration). Distinct copy only for already-redeemed, rate-limited, and unauthenticated.
- Age/guardian gate still applies. Coaching-only rules and `lib/ai/guard.ts` are unchanged. A passcode skips Stripe only.

### Env, data, entitlements
- Add exactly one new env var: `PASSCODE_PEPPER` (server only, required; `openssl rand -hex 32`). Add it to `.env.example`, `lib/env.ts`, and the Vercel env list. Do not invent other names.
- Migration `supabase/migrations/0004_access_codes.sql` (0003 is the AI checker). Tables `access_codes`, `access_code_redemptions`, `access_code_attempts`; profile columns `unlimited_access`, `unlimited_until`, `audio_included`, `passcode_credits`, `access_code_id`; `purchase_kind` value `access_code`. RLS: no client read on those three tables. Security-definer RPC `redeem_access_code(p_code_hash text, p_ip_hash text)` atomically locks the row, checks, increments, and applies the grant. The Route Handler normalizes and hashes; the RPC never receives plaintext.
- Single helper `lib/entitlements.ts` used by every paywall, "Start new paper", `/api/checkout`, and the Stage 4 audio upsell. Funding order: guardian block → active unlimited → unused free first paper → `paper_credits` → `passcode_credits` → paywall. Unlimited users never see the audio upsell or Stripe checkout. Papers funded this way use `funded_by='access_code'` and analytics `source=passcode`. Refund and feedback-credit logic ignore `passcode_credits` and exclude `kind='access_code'` from revenue.
- Rate limit redemptions: 5 per 15 minutes per IP and per user. Audit via `access_code_redemptions` + `session_events`. Toggleable Resend notify to `ADMIN_NOTIFY_EMAIL` on each redemption (`AccessCodeRedeemedAdmin`).

### Tests and seed
- Vitest: normalize/hash/generate, vanity rules, entitlements matrix, checkout refusal, refund isolation, rate limit, admin 404.
- Required race test: two simultaneous redemptions of a `single_use` code yield exactly one success and `redemption_count = 1`.
- README seed (spec section 12): after first deploy, `update profiles set is_admin = true where email = '...'`, confirm `PASSCODE_PEPPER` is set, then create an unlimited code labeled "Angie test" in `/admin/passcodes` and copy it from the one-time modal. Do not bake a code or admin email into the repo.

After this phase, run typecheck and tests and fix failures.
