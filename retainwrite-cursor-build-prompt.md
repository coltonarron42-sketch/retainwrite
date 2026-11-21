# RetainWrite — Cursor Build Prompt (paste everything below this line into Cursor)

## Read these first, in this order

1. **`retainwrite-coaching-philosophy.md` — THE governing document** (v1.6, Nov 20, 2026). It governs every stage, probe, summary, and interaction. It wins over every other doc, including the stage specs, **on philosophy**. The specs below still hold the implementation detail. If a spec rule would break a hard limit in the philosophy doc, follow the philosophy doc and flag the conflict in your PR description.
2. `retainwrite-stage1-intake-spec.md` — wins on Stage 1 implementation.
3. `retainwrite-stage-specs.md` — wins on Stages 2–6 and cross-stage implementation (including the section-by-section loop, section 2A, and the Stage 2 lesson-first coaching spec, section 2B; section 2C, the interaction design layer and hidden-draft scaffold, is PENDING Colton's review of the open items, build item S3-t57).
4. `retainwrite-stage3-draft-spec.md` — **Drafting spec (Colton's Stage 3; student-facing label "Drafting"), PENDING COLTON'S REVIEW of the remaining open items.** The code's Stage 5 route. Read it for context, but do **not** build it until build items S3-t56 / S3-t57 are marked approved; until then stage specs 5.1–5.3 govern Drafting.
5. `retainwrite-ai-checker-spec.md` — wins on the standalone AI checker (Phase 11).
6. `retainwrite-admin-passcodes-spec.md` — wins on passcodes (Phase 13).
7. This build prompt — stack, conventions, data model, and build order.

You are building **RetainWrite** (retainwrite.com), a student paper-writing COACHING app. It coaches students through writing their own paper in six gated stages. It NEVER writes the submission for the student. Build a complete, production-ready Next.js app in this repo.

## 0. Stack and conventions
- Next.js 14+ App Router, TypeScript (strict), Tailwind CSS, shadcn/ui components.
- Supabase (Postgres + Auth + Storage) via `@supabase/ssr` and `@supabase/supabase-js`.
- Stripe Checkout (one-time payments, NO subscriptions) via `stripe` (server) and `@stripe/stripe-js` (client). The Stripe webhook endpoint must be registered at the **www** URL (`https://www.retainwrite.com/api/stripe/webhook`): Stripe does not follow the apex 308 redirect.
- Resend via `resend` + `@react-email/components` for transactional email.
- xAI Grok via the official `openai` npm SDK (`baseURL: "https://api.x.ai/v1"`, `apiKey: process.env.GROK_API_KEY`). Do not use `@anthropic-ai/sdk`.
- Google Cloud Text-to-Speech Chirp 3 HD for Stage 4 audio beats.
- Zod for all input validation. Server Actions or Route Handlers for all mutations; never trust the client.
- Deployed on Vercel. Canonical domain: **https://www.retainwrite.com** (www is primary; the apex `retainwrite.com` 308-redirects to www at the Vercel domain level). Sending domain: send.retainwrite.com.

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
export const SITE_URL = "https://www.retainwrite.com"; // www is canonical; apex 308-redirects here. Use for canonical, OG, sitemap, email links, magic-link redirectTo, and Stripe success/cancel URLs.
export const EMAIL_FROM = "RetainWrite <hello@send.retainwrite.com>";
export const PRICES = { single: 900, pack3: 1500, audio: 199 }; // cents, USD
export const PACK3_CREDITS = 3;
export const MIN_VOICE_SAMPLE_WORDS = 150;          // AI checker voice check only
export const STAGE1_VOICE_MIN_WORDS = 200;          // Stage 1 embedded voice sample (Colton, Nov 20, 2026; was 250)
export const STAGE1_VOICE_MIN_LONG_ANSWERS = 2;
export const STAGE1_VOICE_MIN_LONG_ANSWER_WORDS = 40;
export const RESEARCH_LEADS_BATCH_MIN = 3;           // lead sets show 3-5 (Colton, Nov 20, 2026)
export const RESEARCH_LEADS_BATCH_MAX = 5;
export const RESEARCH_LEADS_MAX_PER_PAPER = 20;     // AI-researched leads per paper, then the Google search-prompt handoff
export const WORDS_PER_PAGE_DOUBLE_SPACED = 275;
export const ASSIGNMENT_MAX_FILES = 15;
export const ASSIGNMENT_MAX_FILE_BYTES = 25 * 1024 * 1024;
export const ASSIGNMENT_MAX_TOTAL_BYTES = 100 * 1024 * 1024;
export const MODEL_FAST = "grok-4.3";   // live probing / classification / Stage 1 questions
export const MODEL_STRONG = "grok-4.7"; // assignment parsing, rubric, section feedback, extraction, coding
export const TTS_VOICE_DEFAULT = "en-US-Chirp3-HD-Charon";
```

### AI client (xAI Grok) and TTS
- Use the official `openai` npm SDK with `baseURL: "https://api.x.ai/v1"` and `apiKey: process.env.GROK_API_KEY`. Do **not** install or use `@anthropic-ai/sdk`. Plain `fetch` to `https://api.x.ai/v1/chat/completions` is also fine.
- Structured JSON via `response_format: { type: "json_schema", json_schema: { name, strict: true, schema } }` (supported by xAI). Always validate with Zod. If a schema is rejected, retry with `response_format: { type: "json_object" }` + Zod. The coaching-only code guard stays: reject any AI output that rewrites the student's work. Add `// SOP: coaching only, never generate submission text` at every AI call site.
- `MODEL_FAST` (`grok-4.3`) for live probing/classification, with `reasoning_effort: "none"`. `MODEL_STRONG` (`grok-4.7`) for assignment parsing/extraction, rubric evaluation, section feedback, source extraction, and feedback coding, with `reasoning_effort: "low"` unless a task clearly benefits from more. IDs verified against https://docs.x.ai/developers/models (19 Nov 2026).
- TTS: implement `lib/audio/tts.ts` with Google Cloud Text-to-Speech Chirp 3 HD (`GOOGLE_CLOUD_TTS_API_KEY`, voice `GOOGLE_CLOUD_TTS_VOICE_ID` or `TTS_VOICE_DEFAULT`, MP3). Send only beat-script text, never student writing. Optional `MISTRAL_OCR_API_KEY` for scanned PDFs and images. For Stage 1, if that key is missing or Mistral fails, fall back to Grok vision on `MODEL_STRONG`; Stage 4 source extraction may still skip scanned pages and log `ocr_skipped` if the key is missing (see the Stage 1 spec for the Stage 1 fallback order). `UNPAYWALL_EMAIL` is the contact email for the Unpaywall open-access fallback.

## 1. Product rules (hard requirements — enforce in code, not just UI)
1. **Coaching only.** No feature generates paper prose for submission. AI (if added later) may ask questions, give feedback, and summarize sources for study. Add a code comment `// SOP: coaching only, never generate submission text` at every AI/text-generation touchpoint.
2. **Stage gates.** A student cannot open stage N+1 until stage N is marked `complete`. Gate checks happen server-side in a single helper `assertStageUnlocked(paperId, stage)` used by every stage page and action. **Exception, the loop span (Colton, Nov 20, 2026):** inside Stages 2–4 the section-by-section loop runs **section-first**, so Stages 3 and 4 open once Stage 2's whole-paper part (3 moves + refined thesis) is done, and every write there also calls `assertSectionStepUnlocked(paperId, sectionKey, step)`. A section is workable only when every earlier section is confirmed or **skipped**, and steps run in order. Later sections, and Stages 5–6, can be previewed read-only. Skipped sections are flagged with a persistent bottom reminder bar and a jump-back link. Stage 5 still opens only when Stage 4 is complete, so every section must be confirmed first (stage specs 2A.1).
3. **Real input required.** Each stage defines minimum input requirements (below). "Thin" answers trigger a follow-up probe instead of advancing.
4. **Pricing.** First paper free (all stages, NO audio, no card at signup). After that: $9 per paper, or $15 for a 3-paper pack (audio included on pack papers, credits never expire). Audio add-on $1.99 per paper, offered mid-flow (Stage 4) only. No subscriptions anywhere.
5. **Style metrics are for feedback only.** They power the mismatch warning and revision coaching. Never use them to generate text.
6. **Log every session** for SOP improvement (session_events table).
7. **Coaching principles (from the owner's proven INTD600 workflow; encode in system prompts, `lib/ai/guard.ts`, and copy):**
   - **The student owns the sentences.** AI supplies structure (questions, checklists, sentence-plan slots, citation flags) and short verified source excerpts only. It never writes submission prose, example sentences, or rewrites.
   - **Personal detail beats generic summary.** Probes ask for a specific person, place, moment, number, or thing the student saw or did; generic answers get a dig-deeper probe.
   - **Citations are tied to specific claims, not added at the end.** Flag them per sentence in Stage 3, attach excerpts in Stage 4, check them per claim in Stage 6.
   - **Slight imperfection is fine — keep the student's natural voice.** Never coach the student to smooth their natural phrasing, add fancier words, or sound “more academic” unless the rubric requires that register. Fix errors that change meaning or break the rubric; leave the rest. The reason is authenticity and ownership of voice. Never frame any of this around AI detectors; no detector-evasion language anywhere.
   - **Decide the story early.** The student picks a story angle at the end of Stage 1, before the stance interview.
8. **Pasting assignment text is never a gate.** Uploaded files are read automatically; paste and links are optional extras (see Stage 1).
9. **Governing philosophy (`retainwrite-coaching-philosophy.md`).** RetainWrite is a learning system, not a writing tool: AI is the guide, not the ghostwriter. The section-by-section loop (DISSECT → TEACH → PROBE → SEARCH → SUMMARIZE → CONFIRM → LOGIC CHECKPOINT → ADVANCE; TEACH added by Colton t47) is the engine, and every step serves **THE LESSON** of the paper (t47): DISSECT ends Stage 1, the loop runs per section in Stages 2–4 (section-first: each section goes TEACH → PROBE → SEARCH → SUMMARIZE → CONFIRM → LOGIC CHECKPOINT before the next opens; skip and read-only browse-ahead allowed), Stage 5 drafts from the saved section decisions, and Stage 6 does light cleanup only (stage specs section 2A).

### 1.1 Hard limits → guard and prompt rules (enforce in code)

Every system prompt includes the philosophy's hard limits verbatim (`lib/ai/prompts/hardLimits.ts`, a shared constant). `lib/ai/guard.ts` enforces them on every model output (reject → retry once → rule-based fallback, log `ai_guard_rejected` with the rule id):

| Hard limit | Guard / code rule |
|---|---|
| Never write the paper's sentences; AI supplies structure, excerpts, summaries, light cleanup only | Existing rewrite-phrase and 12-word edited-copy rules; any notes/ideas/plan field holding a finished sentence (≥ 13 words, or sentence-final punctuation with subject + verb) is rejected unless it's a verbatim substring of the student's text; transition suggestions only from the fixed connective bank; no thesis/topic-sentence/example-sentence output anywhere |
| Never explore outside the rubric and prompt | Every probe, lead, source card, story angle, and suggestion carries a `rubricRef` that exists on the confirmed assignment or roadmap; missing or unknown → reject. The roadmap never adds an out-of-scope section. Prompts allow imagination (angles, reframed questions, alternative framings) inside those bounds |
| No decorative citations; every citation ties to a claim the student chose | Coach outputs never contain citation text; citations only come from claim-linked citation flags (Stage 3) and verified source cards (Stage 4); Stage 6 checks ties and end-clustering |
| Never promise to beat Turnitin or any detector; signal strength, never "X% AI" | Banned-phrase list (bypass, beat Turnitin, undetectable, pass AI detection, humanize) and a regex for percent-AI / AI-probability phrasing, applied to model output and to UI copy in a CI test |
| Never fake clean results | No padding; the checker's honest calibration and monitored clean rate (checker spec 9.1); determinism tests; mismatch warnings only on real tells |
| Paste is optional backup, never the gate | Stage 1 section 0A tests (photos-only path, banned string) |
| Voice capture conversational, short, skippable | Per-question Skip (including the personal question); minimum 200 words + 2 answers ≥ 40 words across the answers given (Stage 1 spec section 8; decided by Colton Nov 20, 2026) |
| Paste allowed universally (Colton t44) | No paste-blocking handler, attribute, or CSS on any text input (CI grep, no exceptions); the paste ratio is metadata only, never shown, warned about, or gating; the baseline weights typed answers more |
| No made-up quotes; names are to verify | Lead sets are 3–5 and capped at 20 AI-researched leads per paper (server-enforced), then a code-built Google search prompt; student-brought names are researched in the same pattern and are also `to_verify`. Leads default to `to_verify`; excerpts must be verbatim substrings of verified source text; Stage 4 drops what it can't verify |
| Logic checkpoint coaches, never ghostwrites or gates (Colton t41/t42) | `LogicCheckResult` guard: `reason`/`question` reject rewrite cues (“you could write”, “try saying”, “a better thesis would be”), pasteable quoted sentences, > 12 words copied from the student, non-question angles (must end in “?”, ≤ 25 words, `rubricRef` required), moralizing or grade/detector language; quotes must be verbatim substrings; confidence downgrades; fail open to `pass`; no gate reads `logic_*` |
| Teach without ghostwriting; never push for trauma (Colton t47) | `TeachCard` guard: definition ≤ 35 words, `qualities`/`showsUpAs` are fragments (no sentence punctuation, no subject + verb), no citations, no named people in the definition, `ask` ends in “?”; teach cards and highlight reels are never exported or copyable; highlight-reel moves ≤ 20 words, no quotes, **To verify**, max 2; memory triggers come only from the scripted bank in `lib/coaching/memoryTriggers.ts` (CI test against a banned-topic list); at most one wildcard per lead batch, with `wildcard_why` and an allow-listed neutral `controversy_note` |
| Light cleanup is narrow | Cleanup output `{span, issue, rule, fix?}`; `fix` allowed only for a single-word spelling fix, a single-word grammatical form, or a citation-format fix; anything else is flag-only. Never synonyms, reordering, merging/splitting, or rephrasing |

## 1A. The owner's INTD600 workflow → the six stages

The six stages are unchanged. The app follows the owner's proven workflow in this exact order:

| INTD600 phase | Stage | What the app does |
|---|---|---|
| 1. Capture the real assignment first | **Stage 1** | Upload → read immediately (OCR / Grok vision / native text) → short checklist the student confirms → one follow-up if something important is missing. |
| 2. Generate story options and pick early | **End of Stage 1**, carried into Stage 2 | 3–4 story angles, phrased as questions built from the student's own answers; the student picks one or writes their own (`storyAngle`). |
| 3. Structured interview for raw material in the student's natural language | **Stage 2** (seeded by Stage 1 answers) | Stance-interview replies in the student's own words (paste allowed, paste ratio recorded quietly) plus Stage 1 answers; probes push for concrete detail; the student's own phrases are saved verbatim to a “Your raw material” bank shown in Stages 3 and 5. |
| 4. Sentence-level outline with flagged citations and short source excerpts | **Stage 3 + Stage 4** | Stage 3: a sentence plan per section, one row per planned sentence with a student-written purpose/point note (not a finished sentence) and a citation flag where a source is needed. Stage 4: each flag gets a verified source and a short excerpt (≤ 2 sentences). Unverified leads are dropped. |
| 5. Student writes every sentence in their own voice, using the outline only as a map | **Stage 5** | Section by section; the sentence plan and excerpts are a side-panel map. The student types every sentence. |
| 6. Citation integrity with a/b/c suffixes | **Stage 6** (checklist item 4) | Every citation ties to a specific claim. Same author + same year in author-date styles (APA, Harvard, Chicago author-date) gets a/b/c (Smith, 2020a / 2020b) matching the reference list; MLA uses short titles instead. |
| 7. Final assembly and light quality check (loop: light cleanup) | **Stage 6** | Assembled draft, then the revision checklist (thesis, sections, evidence, length, read-aloud, honesty check). A light check that keeps the student's voice, not a polish pass. |

**The section-by-section loop on top of this map** (philosophy appendix A): DISSECT = end of Stage 1 (student-confirmed roadmap, `section_plans`, headed by THE LESSON, t47); TEACH (t47) + PROBE = Stage 2, per section, after the thesis work; SEARCH = Stage 3, per section; SUMMARIZE + CONFIRM = Stage 4, per section; **LOGIC CHECKPOINT** (Colton's addition) = Stage 4, right after each CONFIRM, mandatory and never blocking; ADVANCE = next section, **section-first** across Stages 2–4 (skip + read-only browse-ahead; stage specs 2A.1); draft feedback = Stage 5; light cleanup = Stage 6 (one-click only for single-word and citation-format fixes; default kept, unconfirmed by Colton). The story angle stays above the loop as the spine.

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
  event text not null,                  -- e.g. stage_started, probe_shown, stage_completed, upsell_shown, upsell_declined, voice_nudge_shown
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
Also: trigger to insert a `profiles` row on `auth.users` insert; trigger to keep `papers.updated_at` fresh; when a paper is created, insert stage_progress rows 1–6 with stage 1 `in_progress` and 2–6 `locked`. Storage buckets: `sources`, `feedback`, `audio`, `assignment-files` (all private, RLS by user folder `${user_id}/...`). The `assignment-files` bucket is created in migration `0005_stage1_assignment_first.sql` (owner-only, signed URLs only, no public objects).

Generate TypeScript types into `lib/database.types.ts`.

## 3. Auth
- Supabase Auth: email magic link + email/password. No card at signup.
- Pages: `/login`, `/signup`, `/auth/callback`. Middleware refreshes the session and protects `/app/**`.
- On first signup, send the Welcome email (section 8).

## 4. Six stages (routes under `/app/papers/[paperId]/stage/[n]`)
The six-stage structure is unchanged: intake, stance interview, outline, sources and audio beats, **Drafting** (student-facing label, t58; internal id stage 5 / `draft`), revise and feedback. Only Stage 1's internals change (assignment first). Shared UI: left rail showing stages 1–6 with lock icons; conversational one-question-at-a-time panel; "Continue" disabled until requirements met. Every question answered logs a `session_events` row.

**Thin-answer detection** (`lib/coaching/thin.ts`): an answer is thin if under its min word count, is a stock phrase ("idk", "not sure", "whatever", "n/a"), or repeats the question. Thin → show a scripted follow-up probe (stored per question), log `probe_shown`, do not advance. Max 2 probes, then allow "I'm stuck — flag for help" which saves and lets them continue.

### Stage 1 — Intake (assignment first)
Full spec: `retainwrite-stage1-intake-spec.md` (that doc wins on Stage 1). Additive migration `supabase/migrations/0005_stage1_assignment_first.sql` (0003 is the AI checker, 0004 is access codes). The six-stage structure is unchanged; only Stage 1's internals change, and nothing in Stage 1 advances until the student confirms the assignment checklist. The Nov 20, 2026 revision adds additive migration `0006_stage1_extract_first.sql` (follow-up state, story options/angle, per-file extraction status; fold into 0005 only if 0005 has never been applied anywhere).

0. **FIX FIRST — Remove the paste gate (urgent bug).** The live Stage 1 page shows a red “paste the prompt text for now” message when a student uploads assignment photos. Remove it:
   - Delete every client and server validation, state flag, and piece of copy that requires pasted text when files exist (e.g. `requirePaste`, `pasteRequired`, a minimum-paste-words check, a `!pasteText` disable condition on the continue button, or a server 400 for missing paste).
   - Wire real extraction: every file is read as soon as `finalize` succeeds (Mistral OCR if `MISTRAL_OCR_API_KEY` is set, else Grok vision on `MODEL_STRONG` via `https://api.x.ai/v1`; typed PDF/DOCX/TXT parsed directly; image pages always via OCR/vision). Requirements extraction then runs automatically and the checklist opens.
   - If extraction fails on a file, show a **per-file** retry/retake message (“We couldn't read {filename} yet. Try again, or retake the photo in brighter light.” with **Retry / Retake photo / Remove**). Never a paste demand. Other files keep going.
   - Acceptance tests: **(a)** a photos-only upload of a multi-page assignment reaches the checklist with no paste; **(b)** the string `paste the prompt text` appears nowhere in the app code, copy, or fixtures (add a CI test; build the pattern from parts so it doesn't match itself; skip the spec docs if they're in the repo); **(c)** a partial extraction triggers the single follow-up question exactly once.

0b. **FIX FIRST, with item 0 — Remove every paste block (Colton, Nov 20, 2026, t43 + t44; no exceptions).** Intake text fields currently have paste disabled. Remove every paste-blocking attribute and handler from **every** intake text input: the assignment paste box, the professor-links URL field, the follow-up Add text box, checklist and roadmap edits, any optional writing-sample field, **and** the voice-capture answers (interest, coaching, personal, fallback, own story angle, early stance).
   - Delete: `onPaste` / `onDrop` / `onCopy` / `onCut` handlers that `preventDefault`, `stopPropagation` or clear the field; `beforeinput` / `input` rejection of `insertFromPaste` / `insertFromDrop`; Ctrl/Cmd+V, Shift+Insert and `onContextMenu` traps; `contenteditable` stand-ins, overlays, `readOnly`-on-focus and `type` / `inputmode` / `autocomplete` workarounds; `user-select: none` / `-webkit-touch-callout: none` on fields; the “We need your own typing here” note; and any server rejection of pasted answers.
   - Paste stays optional and secondary to upload, photo library and camera: always available, never a gate.
   - Keep only the passive `usePasteMeta()` measurement, which never calls `preventDefault` and shows no UI. Columns go on `intake_answers` (`pasted_chars`, `typed_chars`, `paste_events`, `paste_ratio`) and `voice_profiles.typed_word_share`, folded into spec-only `0008` (or `0009` if 0008 is applied).
   - **Consequence:** the Stage 6 voice comparison's baseline may include pasted text. The mitigation is typed-weighted baseline metrics plus the existing short-sample downgrade when fewer than 150 typed words exist. It never blocks or warns the student.
   - Acceptance tests: **(d)** pasting into the assignment text box, the URL field, the Add text box and every voice answer works on desktop (Cmd/Ctrl+V, context menu, drag-drop) and mobile (**iOS Safari long-press → Paste**, Android long-press), with no warning shown; **(e)** CI grep over `app/` and `components/` finds no `preventDefault` in any `onPaste` / `onDrop` / `onCopy` / `onCut` / `onBeforeInput` / `onContextMenu` / paste-key handler, no `insertFromPaste` rejection, and no `user-select: none` on form fields, **anywhere in intake, with no exception**; **(f)** a fully pasted voice sample still completes Stage 1 and saves `paste_ratio ≈ 1`.

1. **Upload first (file upload is the primary CTA).** One screen, three methods: (1) upload a PDF/DOCX/TXT document, (2) choose photos/screenshots from the gallery (JPG, PNG, HEIC converted server-side to JPEG, WEBP), (3) take a photo with the device camera (mobile: `<input type="file" accept="image/*" capture="environment">`; desktop: `getUserMedia` still capture with a file-picker fallback), including multi-page capture ("Add another page") and a crop/rotate step. Multiple files per submission (max `ASSIGNMENT_MAX_FILES` 15, `ASSIGNMENT_MAX_FILE_BYTES` 25 MB each, `ASSIGNMENT_MAX_TOTAL_BYTES` 100 MB). Desktop drag-and-drop, thumbnail strip with reorder/remove, per-file progress and retry, and **resumable** uploads to the private `assignment-files` bucket (RLS owner-only, short-lived signed URLs, no public objects). **Paste the assignment text (optional)** is a secondary control and is **never required**. An optional, collapsed **Any links your professor gave you?** multi-URL field sits below the uploads. Paste and links are optional secondary inputs, never a gate. This is the real flow we are building for: a graduate leadership-course paper starts from the professor's assignment document plus any source links, and coaching begins from that anchor (no course number or personal details in the product or copy).

   Extraction starts **immediately** per file after `finalize` (Next.js `after()` / Vercel `waitUntil`); per-file status shows on each thumbnail. Native text for typed PDFs/DOCX/TXT; OCR for images and scanned PDF pages. Fallback order: quality + orientation check (prompt to retake if blurry/dark), then Mistral OCR if `MISTRAL_OCR_API_KEY` is set (do not add `MISTRAL_API_KEY`), then Grok vision on `MODEL_STRONG` via `https://api.x.ai/v1` with image inputs, then a per-file Retry / Retake photo / Remove recovery (never a paste prompt). Per-page confidence is stored. Merge every file into one ordered corpus with file and page provenance. Extract URLs from document text and PDF link annotations into `providedSources`, deduped with the optional URL field. Strip EXIF GPS; MIME-sniff uploads; keep files for the life of the paper plus 90 days, deletable by the student.

2. **Assignment checklist.** When every file is read, `MODEL_STRONG` (`grok-4.7`, `reasoning_effort: "low"`) automatically extracts a structured `assignment_requirements` JSON (Zod schema in the Stage 1 spec, sent as `response_format` `json_schema` `strict: true`) from that corpus: paper type, topic/question (the assignment prompt), length (page/word count), citation style (APA/MLA/etc.), formatting rules, required sources, provided readings and research links, structural requirements (required sections/layout), due date, rubric criteria with weights, other instructions, optional AI-policy flag. Convert pages to a word estimate at `WORDS_PER_PAGE_DOUBLE_SPACED` (275), labeled as an estimate; never overwrite an explicit word count. Each field has a confidence score and cites the file and page it came from, with a **View source** peek at the snippet; low-confidence (< 0.6) or missing fields are highlighted. Show it as a **short checklist** (prompt, format, length, rubric, sections/layout, readings and links, plus course/due date when found). The student edits any line and confirms once with **Looks right — continue**. No field is a blocker: anything still missing is saved as "Not specified." Nothing is inferred silently.

   **Single follow-up.** If an important field (prompt, format, length, rubric, sections/layout) is missing or very low confidence (< 0.4), computed in code, ask exactly once: "Is there any other context or page you want to add so I fully understand the assignment?" The student can add files, text, or links (read immediately, checklist refreshes) or tap **No, that's everything** and continue. New route `POST /api/papers/[paperId]/assignment/followup` (once per assignment). Sync confirmed values onto the existing `papers` columns (`course`, `due_date`, `assignment_prompt`, `required_length`, `citation_style`).

3. **Get to know you, then coaching questions** (only after confirm). First a short, **skippable**, adaptive "get to know you" conversation (3–5 questions: what they care about, hobbies, interests, favorite topics, people they follow, what they'd rather be doing). Start with ~2 interest questions, and weave any remainder into coaching when a natural opening appears (cap 5). Store an `interest_profiles` row (one per user): tags plus the student's own words. Privacy: used only to personalize this student's coaching, never shown to others, deletable; do not ask or infer health, religion, politics, or sexuality (use volunteered content only if it is relevant to this assignment, and never as a standing tag). Then `MODEL_FAST` (`grok-4.3`, `reasoning_effort: "none"`) asks assignment-grounded coaching questions, one at a time, adaptive (dig deeper vs. move on). Example: a 5–7 page APA paper on the value of margin for business owners that must cite 3 leaders who speak about margin → "Do you have any leaders in mind who've talked about margin? Who are you curious to look into?" If they don't know, offer 3–5 example names (never more than 5; “none appeal” → 3–5 more or “someone specific?”; capped at 20 AI-researched leads per paper, then a ready-to-paste Google search prompt, stage specs 2A.3) with a one-line why (e.g. Alex Hormozi on pricing and gross margin) as suggestions to research, not citations; optionally search terms, source types, or links to that person's own books/talks where known. Use the interest profile to steer leads toward things the student finds engaging and authentic while still satisfying the assignment (each interest-steered lead must say why it fits the assignment AND the interest). Illustrative pattern only — do not bake any celebrity–organization pairing in as fact: a student who loves music and names an artist they admire might be offered a related figure, collaborator, or project as a lead, if and only if it also meets the requirement; Stage 4 verifies with real sources and drops leads it cannot verify. If scholarly sources are required, an interest lead may be a hook or example and the card must say scholarly support is still required. Never present unverified quotes or fabricate citations. Every suggestion is marked `to_verify` and stored in `research_leads` for Stage 4. The student chooses; the AI never decides. Fold in brief assignment-tied background (year, major, comfort with the citation style, prior grades/feedback) — not a generic survey. Always ask one open-ended personal question: why this topic matters / a personal experience (skippable, re-offered once; no longer separately required). Personal detail beats generic summary: a generic answer to an experience question gets a "one specific moment or example" probe (max 2). **Pick your story (INTD600 Phase 2):** after the coaching questions, `MODEL_STRONG` offers 3–4 story angles, each a *question* (never a claim or thesis) built from the student's own answers (verbatim phrase checked in code) with a one-line fit to the assignment; the student picks one or writes their own (paste allowed, ≥ 15 words, counts toward voice). Routes `intake/story-options` and `intake/story-pick`; rule-based template fallback. Then always capture an early stance on the chosen angle (min 25 words) to hand to Stage 2 as `originalThesis`. After lead suggestions, optionally ask a skippable 1–5 "How interesting do these options feel?" for SOP/retention logging.

4. **Voice capture is embedded.** Answers to the interest, coaching, personal, and fallback questions ARE the voice sample (they count toward the minimum). **Paste is allowed in them, as in every text input (Colton, Nov 20, 2026, t44).** A passive `usePasteMeta()` hook quietly records `pasted_chars` / `typed_chars` / `paste_ratio` per answer, and the voice baseline weights typed answers more (`w = 1 − 0.8 × paste_ratio`). If fewer than 150 baseline words were typed, Stage 6 uses the short-sample downgrade. The student is never warned or blocked (Stage 1 spec 8.1a, decision 17). Minimum (Colton, Nov 20, 2026): `STAGE1_VOICE_MIN_WORDS` (200) across the answers given, skipped answers allowed, and at least `STAGE1_VOICE_MIN_LONG_ANSWERS` (2) answers of ≥ `STAGE1_VOICE_MIN_LONG_ANSWER_WORDS` (40) from any questions. There is no separate personal-question requirement. If short, show a fallback prompt (still assignment-grounded). Compute `StyleMetrics` (section 5, including additive variance / register / tone-marker fields) and save `style_profiles`. Reuse the AI checker's `voice_profiles` table (do not fork). If a `voice_profiles` row younger than 180 days exists, offer "Keep this baseline" or "Refresh it with this paper" (see the Stage 1 spec). Show the same friendly readout: "Your natural voice: ~X words per sentence, grade-level Y, Z tone. Your go-to words: ..."

4a. **DISSECT — the roadmap (philosophy loop step 1).** After the early stance, `MODEL_STRONG` builds a section-by-section roadmap **only** from the confirmed rubric/prompt (teacher-named sections first; otherwise the default structure). Each section: title, what it needs (≤ 25 words, a requirement, not draft text), `rubricRefs`, required sources/styles, `targetWords` (computed in code), and a story-link question. The student confirms ("This is my roadmap"); saved to `section_plans` (migration `0008_section_loop.sql`, stage specs 2A.6). Routes `intake/roadmap` and `intake/roadmap/confirm`. Voice questions are conversational and each has **Skip**; the 200-word / 2 × 40 minimum is met across the answers given.

5. **Gate.** Stage 1 completes only when the assignment checklist is student-confirmed, the voice minimum is met, a story angle is chosen, an early stance (≥ 25 words) is saved, the roadmap is confirmed, and the student clicks "Start stance interview." Pasted text is never part of the gate. Stage 2 then receives the confirmed requirements, `storyAngle`, early ideas/stance, and research leads.

API routes (`upload-url`, `finalize`, `parse-status` via polling or Realtime, `parse`, `followup`, `confirm`, `intake/story-options`, `intake/story-pick`), schema, microcopy, edge cases (blurry/dark retake, rotation, duplicates, password-protected PDFs, handwriting, multiple assignments, unsupported types, interrupted mobile upload, plus the existing no-rubric / vague prompt / non-English / teacher-forbids-AI cases), and SOP logging are in the Stage 1 spec. Acceptance includes: a 3-photo phone capture of a printed syllabus produces a correct checklist with no paste, a PDF plus 2 screenshots plus 1 professor URL merge correctly, and the three paste-gate tests in item 0 pass. Implement them.

### Stage 2 — Stance interview (counterargument moves)
- Seed table/JSON `lib/coaching/moves.ts` with 5 move types: alternative_explanation, scope_limit, conflicting_evidence, opposing_stakeholder, definition_challenge. Each has 2–3 templated prompts with `{claim}` slot.
- Flow: pick a move, fill `{claim}` with the student's own stance wording, ask ONE challenge, wait for the student's written reply (min 30 words). Give short scripted feedback, probe if thin. Run 3 moves. Never generate a rebuttal for them. Log move id + response.
- **PROBE (loop step 2), per section, after the refined thesis:** the loop is section-first: each section runs PROBE → SEARCH (Stage 3) → SUMMARIZE + CONFIRM + LOGIC CHECKPOINT (Stage 4) before the next opens; **Skip this section for now** is always available (flag + bottom reminder + jump-back link). For each section ask exactly "Do you already have an idea of how you want this section to go, or do you want me to ask some probing questions so we can start finding research?" → the student's idea, or 2–4 probing questions, or warm-up questions if they freeze (never sources cold). Ideas saved verbatim to `section_decisions`. Stage 2 completes only when every section has a PROBE result (stage specs 2A.2).
- Starts from the Stage 1 `storyAngle` and early stance (INTD600 Phase 3: structured interview for raw material). Replies are typed in the student's natural language; probes ask for concrete personal detail over generic summary. Short verbatim phrases from Stage 1 and Stage 2 answers are saved to a "Your raw material" bank (the student's own words only) shown in the Stage 3 and Stage 5 sidebars. See the stage specs.
- **TEACH (loop step, Colton t47), per section, before PROBE:** a short concept card for the section's lesson concept and “Which part interests you most?”; skippable; MIRROR in memory sections. See the build item **S2-t47** below and stage specs 2B.
- Complete after 3 answered moves + a refined thesis statement (min 15 words) written by the student.

### Stage 3 — Outline
- Student builds their own outline: thesis (prefilled from Stage 2, editable), 3–5 main points, each with the evidence they plan to use. Drag-to-reorder.
- Coach checks structure only (every point has evidence, points tie to thesis) with rule-based feedback. No auto-generated outline.
- **SEARCH (loop step 3), per section:** search terms the student would run (with the reasoning shown, to teach the skill), a cross-reference against the rubric's required styles/sources, and **3–5** leads marked **to verify** with a `rubricRef`, **ranked by rubric match, plus one Outside the box wildcard** (t47; counts toward the cap) (“none appeal” → **Show me 3–5 more** or **I have someone specific**). At 20 AI-researched leads **per paper** (wildcards included) the server stops suggesting and the card shows a code-built, ready-to-paste Google query (section + rubric terms + story angle, ≤ 32 words, Copy / Open in Google). The student brings names back (up to 5 at a time), and those are researched in the same 3–5 pattern, uncapped and `to_verify`. The student picks leaders and a style. Outline cards come from the confirmed roadmap and are prefilled from `section_decisions` so the student never re-explains (stage specs 2A.3).
- **Sentence plan (INTD600 Phase 4):** inside each section, the student lists planned sentences as rows: a fixed-enum role (claim, evidence, personal example, explanation, link to thesis, transition), a student-written purpose/point note (not a finished sentence), and a **citation flag** where a source is needed. The coach may suggest the role sequence (structure only); it never writes the notes. Details in the stage specs section 4.
- **Outline export (Colton, Nov 20, 2026):** **Export outline → Word / PDF** on Stages 3–6. `GET /api/papers/[paperId]/outline/export?format=docx|pdf`, generated in code with no model call: one `buildOutlineExport()` model rendered by the `docx` package (.docx) and `@react-pdf/renderer` (PDF), streamed and never stored. Contents: header from the confirmed checklist, story angle, thesis, then per section the rubric criteria, idea notes, leader/style, sentence-plan rows with citation flags, and verbatim source excerpts, plus a raw source metadata list. No AI prose (allow-list plus a canary test). Stamped “In progress” until every section is confirmed (stage specs 2A.7).
- Complete when thesis + ≥3 points each with ≥1 evidence note (stage specs win on the full gate).

### Stage 4 — Sources & study beats (+ audio upsell)
- Upload course PDFs/pages to `sources` bucket. Required checkbox per upload: "I'm allowed to use this material for my coursework." Copy: "We summarize for your personal study and never redistribute publisher content."
- For each source, create study beats: `{passage (short quote ≤ 2 sentences), why_it_matters (student's thesis connection)}`. Implement `lib/research/extract.ts`: extract PDF text first; if a PDF has no extractable text and `MISTRAL_OCR_API_KEY` is set, run Mistral OCR, otherwise skip scanned pages and log `ocr_skipped`. Unpaywall open-access fallback uses `UNPAYWALL_EMAIL` as the required contact email. `MODEL_STRONG` writes beat scripts (source summaries for study, never student prose). Store beats in `sources.beats`. Full written beats always visible.
- **Audio upsell (mid-flow):** after the first source's beats render, if `!paper.audio_unlocked` (pack papers already have audio; free and single papers can buy it for $1.99), show a dismissible card:
  > 🎧 **Take this with you?** We pulled the key points from your sources. For $1.99 we'll turn them into short audio beats for a drive or a walk. [Make it audio — $1.99] [Not now]
  "Not now" sets a sessionStorage flag + logs `upsell_declined`; do not show again that session.
- Audio playback: implement `lib/audio/tts.ts` with Google Cloud Text-to-Speech Chirp 3 HD (`GOOGLE_CLOUD_TTS_API_KEY`, voice `GOOGLE_CLOUD_TTS_VOICE_ID` or `TTS_VOICE_DEFAULT`, `audioEncoding: "MP3"`); store files in `audio` bucket; player per beat. Gate playback on `paper.audio_unlocked`. Send only beat-script text to TTS, never student writing.
- **Excerpts for citation flags (INTD600 Phase 4):** each Stage 3 citation flag is linked to a verified source and one short excerpt (a beat passage, ≤ 2 sentences, quoted source text with page/location). Accepted Stage 1 research leads are verified here; leads that can't be verified are dropped with a note to the student. Unresolved flags carry to Stage 5 as "needs a source."
- **SUMMARIZE + CONFIRM (loop steps 4–5), per section:** verify the chosen leads (drop what can't be verified, with a note); source cards from verified text only: the claim it supports, a short verbatim excerpt (≤ 2 sentences, with location), one line on why it fits the rubric; audio optional (pricing unchanged). End each section with "Are you comfortable moving forward with {leader} and {style}?" → save the decision (`section_decisions.confirm_snapshot`), or go back to SEARCH. Then the LOGIC CHECKPOINT, then ADVANCE (stage specs 2A.4).
- **LOGIC CHECKPOINT (Colton's addition, Nov 20, 2026, t41; revised t42), per section, mandatory, never blocking:** runs automatically right after CONFIRM is saved and before ADVANCE, and again only when the claim, ideas, leader or style change. `lib/coaching/logicCheck.ts`, `MODEL_STRONG`, `temperature: 0`, Zod `LogicCheckResult` (stage specs 2A.4a): `tier: pass | moderate | strong`, `basis`, `confidence`, `reason` (≤ 2 sentences), `citedTerm {rubricRef, quote}` (verbatim teacher text), `studentClaimRef {ideaId, quote}` (verbatim), `logicFailure`, `alternativeAngles[] {question, rubricRef}` (questions only, ≤ 3), `reframeAvailable`.
  - **Opener (Colton t47):** “I want to do a logic check. Do you feel good about this?” → **Yes, check it** / **Let me tweak it first**; the check runs in the background, so neither blocks.
  - **pass:** quiet ✓, then auto-advance.
  - **moderate** (debatable interpretation): a light card with the reason, angle questions and “Your call. You're the writer.” Buttons **Keep my angle** / **Adjust it**.
  - **strong** (defies logic or contradicts the assignment's terms, e.g. calling Hitler an objectively moral leader when the paper evaluates leaders against ethical principles): a **red alert** card (t47: red border, ⚠ plus the text label “Logic alert”; headline “We would not recommend moving forward.”, then “This claim doesn't hold up as written.”) with the reason, the verbatim assignment term and angle questions. Buttons **Pick a new angle** / **Revise my claim** / **Reframe it** (a critical or cautionary analysis passes) / **Continue anyway**.
  - **Counterargument only when the rubric asks for one (confirmed t47);** memory sections get a light check (never strong).
  - **No gating anywhere:** Continue anyway always advances; gates and stage completion never read `logic_*`. The flag stays as a small reopenable note plus an optional Stage 6 checklist reminder.
  - **Defaults to pass when unsure:** code downgrades strong below confidence 0.80 or without a verbatim cited term / named contradiction, and moderate below 0.60. Errors, timeouts, guard rejects and rate limits fail open to pass.
  - **Logging:** `logic_check_run`, `logic_*_shown`, the student's choice, and **`logic_strong_continued` for SOP review** (`/admin/sop` Logic checkpoints panel). Columns are `section_decisions.logic_*` in 0008 (or 0009 if 0008 is already applied).
- Complete when **every roadmap section is confirmed**, each section with a citation flag has ≥ 1 verified source card, and the student has written, for ≥ 3 source cards, one sentence in their own words on how they'll use it (stage specs 2A.5 replaces the old "≥ 1 source with ≥ 3 beats" rule).

### Stage 5 — Drafting (student writes; student-facing label exactly "Drafting", t58)
- Student writes or uploads their draft (textarea + .docx/.txt upload; parse .docx with `mammoth`). Save as a new `drafts` version.
- On save: compute metrics, run mismatch check (section 6), show warning if triggered.
- **Paste in the draft editor (Colton, Nov 20, 2026, t46):** paste is always allowed and recorded quietly (`paste` events with counts, per-section `paste_ratio` in `drafts.section_paste_meta`). A single paste of ≥ 80 words (not a .docx/.txt import) shows one inline, dismissible note under the editor, at most **once per session per paper**: “We suggest using your own writing so your tone is better understood and we can serve you better.” It's a suggestion, not a question: no yes/no buttons, no answer recorded, no modal, never blocks. Same rule in the Stage 6 revision editor (stage specs 5.2).
- **Draft feedback pattern (philosophy section 4), per section:** "Here are the {n} ideas we captured for this section based on what you told me. We chose {leader}, we chose {style}. Idea one: {idea note}… Write those ideas in your own words." Idea notes are the student's own words or ≤ 12-word fragments, never finished sentences; transition suggestions are a relationship label plus connective words only; the student mixes freely. Built in code from `section_decisions` (stage specs 5.3 step 2).
- Side panel: their outline, sentence plan, linked excerpts, and "Your raw material" bank for reference, as a map only (INTD600 Phase 5). The student writes every sentence in their own voice. No example sentences and no "write this for me" button anywhere.
- Complete when a draft ≥ 300 words is saved.
- **Pending (S3-t56, S3-t57):** the Drafting muscle in `retainwrite-stage3-draft-spec.md` (teach-then-draft every section, one sentence at a time, strict order, example language, end-of-Drafting payoff) will layer on this stage behind `FEATURES.draftingMuscle = false` once Colton answers the open items listed in S3-t56. Don't build it yet.

### Stage 6 — Revise & feedback
- Show draft vs. intake voice comparison (bar chart: sentence length, grade level, formality) with coaching tips ("your draft sentences average 31 words vs. your natural 14 — try splitting the longest ones").
- **Paste-aware baseline (Colton t44/t45):** the comparison uses the typed-weighted Stage 1 baseline. If fewer than 150 baseline words were typed or spoken, use the short-sample downgrade. At the very bottom of the comparison, show at most one voice note chosen by the **hybrid rule (Colton t51; replaces the > 60% and ≥ 95% paste-only rules)**: `naturalWords` = typed + spoken words across the paper's counted answers (Stage 1 voice answers + Stage 2–4 conversational answers; pasted excluded). ≥ 600 → none; 200–599 → `VOICE_NOTE_ANSWERS` only if > 60% pasted; 80–199 → `VOICE_NOTE_ANSWERS` (> 60% pasted) or `VOICE_NOTE_ANSWERS_SHORT`; < 80 → `VOICE_NOTE_ANSWERS_LOW` (numbers [PROVISIONAL]; exact strings in checker spec 5.9). No note when there's no baseline, and never a block or a warning while writing.
- Rule-based revision checklist: thesis present in intro, each outline point appears, citations present per citation style, no beat used without student explanation.
- **Citation integrity (INTD600 Phase 6, stage specs item 4):** every in-text citation sits next to the specific claim it supports (linked to a flagged sentence), not piled at the end; same author + same year in author-date styles uses a/b/c suffixes (Smith, 2020a / 2020b) that match the reference list; MLA uses short titles instead. Questions only; the app never inserts citations into the draft.
- **Final assembly and light quality check (INTD600 Phase 7):** the assembled draft plus the checklist, read-aloud pass, and honesty check. Light means: flag errors that change meaning or miss the rubric; never push the student to polish away their natural voice.
- **Light cleanup (philosophy hard limit; stage specs 6.1 item 12):** flag spelling, grammar, and citation-format issues; the student accepts a single-word or citation-format fix or fixes it themselves. Never rephrase.
- **Gentle voice nudge (Colton t48), replaces the mismatch warning's check-in buttons:** see section 6 and build item **S6-t48**.
- Student can save new versions; each re-runs mismatch check.
- Mark paper complete → send "Paper complete" email.
- **Professor feedback loop:** after completion, offer "Got your grade back? Upload your professor's grade + comments and get a free paper credit." Upload to `feedback` bucket with consent checkbox ("We use this only to issue your credit and improve coaching; never shared with your school or professor; delete anytime"). Prompt to redact classmates' info. On submit, admin review sets `credit_granted` → +1 `paper_credits`. One credit per paper (unique constraint).

### Build item S2-t47 — Lesson-first section loop and research (Colton, Nov 20, 2026)

Implement stage specs **section 2B** (decisions 36–44) plus Stage 1 spec **4.6** and decisions 18–19. It's part of build-order step (2) for the Stage 1 pieces and step (4) for Stages 2–4.

**Scope**
1. **THE LESSON:** extract `lesson` + `promptType` in the Stage 1 parse (`lesson_v1`, Zod `Lesson`), show **What this assignment is teaching** on the checklist and a lesson card on DISSECT with a prompt-type **Change**; store on `papers`. Pass `lesson` to every Stage 2–4 prompt with the rule "teach the lesson first; examples serve it." Show "What you're learning" in the loop header strip.
2. **Routing:** `papers.prompt_type` (`lesson` / `personal_experience` / `mixed`), `section_plans.mode` (`lesson` / `memory`) and `section_plans.concept`; `MentionTag` per TEACH/PROBE answer (concept / instance / vague; verbatim mentions only).
3. **TEACH step** (`lib/coaching/teach.ts`): before PROBE; `TeachCard` (definition, 3–5 qualities, shows-up-as, optional debate, ask), chips + **Something else** + **I know this one**; teach-then-ask on vague concept answers (affirm ≤ 15 words → breakdown → ask). `assertSectionStepUnlocked` order teach → probe → search → summarize → confirm; TEACH never blocks.
4. **Highlight reel + search offer** (`lib/coaching/highlightReel.ts`): 1–2 moves (≤ 20 words, To verify, no quotes, dropped when unsure), then "Want me to search for references on how {instance} was a {concept}?"; Yes seeds SEARCH with a `student_added` lead (not capped).
5. **Leads:** ranked by `rubric_match` with `rank`, `lesson_link`; exactly one wildcard (`is_wildcard`, `wildcard_why`, neutral `controversy_note`) labeled **Outside the box**, never preselected, stricter for under-18, omitted when no safe one fits; **counts toward `RESEARCH_LEADS_MAX_PER_PAPER` (20)** and is dropped first when trimming at the cap; the 32-word search-prompt handoff is unchanged.
6. **Source cards** gain `lessonLink` (JSON in `sources.beats`); the outline export allow-list is unchanged (it excludes teach cards, highlight reels, wildcard whys and lesson links).
7. **Memory-forward path:** MIRROR from verbatim `emotionalTerms`; memory PROBE opener; scripted gentle trigger chips (`lib/coaching/memoryTriggers.ts`, theme-tagged, lighter first, `medium` items hidden for under-18) with **Not this one** / **Skip these** / **More ideas**. **(Colton t52, decision 47)** every trigger line is a gentle invitation: a soft "Maybe…" offer (never "Did you…?"), an opt-in to reflect, and a link back to the paper, as in the model line “A family member started or lost a job. Do you want to expand on it so we can explore how it might help your paper?”. Use the 11-line bank in stage specs 2B.8 verbatim, with chip label → full line on tap; kind deflection on heavy disclosures and a safety note (trusted adult + 988) on risk language; SEARCH `not_needed` by default; memory card from verbatim student phrases; CONFIRM "this moment"; logic check clamped to pass/moderate.
8. **Logic checkpoint (t47 copy):** opener "I want to do a logic check. Do you feel good about this?" (**Yes, check it** / **Let me tweak it first**, background run), red-alert strong card "We would not recommend moving forward." with **Continue anyway**; counterargument suggestions only when the rubric requires one. All 2A.4a rules (80/60 downgrades, fail-open, logging) unchanged.
9. **Counterargument:** DISSECT and the outline include a Counterargument & Rebuttal section only when the assignment requires one; Stage 6 item 9 is hidden otherwise.
10. **Voice:** 200 words across answers (skips allowed). **Hybrid voice-note rule (Colton t51, decision 46):** `voiceNoteFor({ naturalWords, pastedShare, hasBaseline, surface })` in `lib/style/voiceBaseline.ts`; `naturalWords` = typed + spoken words across Stage 1 voice answers and Stage 2–4 conversational answers (pasted excluded; per-answer `inputMeta` on Stage 2–4 answers; cached in `papers.natural_voice_words` / `voice_pasted_share`). Tiers [PROVISIONAL]: ≥ 600 → none; 200–599 → lighter note only if > 60% pasted; 80–199 → lighter note; < 80 → stronger note. Strings `VOICE_NOTE_ANSWERS`, `VOICE_NOTE_ANSWERS_SHORT`, `VOICE_NOTE_ANSWERS_LOW` (+ `VOICE_NOTE_SAMPLE…` for the public checker) in `lib/copy/voiceNotes.ts`; `VOICE_NOTE_ANSWERS_ALL` / `VOICE_ALL_PASTED_SHARE` are retired. No voice notes or warnings during any writing step.
11. **Data:** stage specs 2B.11 columns folded into `0008_section_loop.sql`, or `0009_section_loop_followups.sql` if 0008 is already applied. Events in 2B.12.

**Acceptance tests (must pass; full list in stage specs 2B.13)**
- [ ] The leadership prompt ("connect leadership styles to leaders you admire, give three examples") yields `prompt_type = 'lesson'`, a lesson concept "leadership styles", a verbatim evidence quote, and the lesson line on the checklist and roadmap.
- [ ] The summer-vacation prompt yields `personal_experience`, `emotionalTerms` containing "magical", memory sections, no Stage 1 or Stage 3 leads by default, and the MIRROR question "What does magical mean to you?".
- [ ] Each lesson section shows TEACH before PROBE; **I know this one** skips to PROBE; a teach card with sentence-style qualities is rejected by the guard; TEACH never blocks a step.
- [ ] "I like servant leadership" gets affirm → definition + 3–5 chips → "Which part … interests you most?" in one response.
- [ ] "John Legere" gets 1–2 To-verify moves naming servant leadership and the exact-pattern offer "Want me to search for references on how Legere was a servant leader?"; Yes adds an uncapped `student_added` lead; an unknown name gets no invented moves.
- [ ] Lead batches are 3–5 ranked by `rubric_match` plus ≤ 1 wildcard labeled Outside the box (never preselected); the 21st AI-suggested lead of any kind is rejected server-side; at the cap the wildcard is trimmed first and the ≤ 32-word Google query card appears.
- [ ] Memory triggers come only from the scripted bank; the CI banned-topic test passes; **(t52) `memoryTriggers.test.ts` passes for every line**: no opening interrogative auxiliary (`Did/Do/Have/Were/Is/Are/…`), an allow-listed invitation phrase ("Would you like", "Do you want to", "Want to", "If you're comfortable"), an assignment link ("your paper" or `{term}`), ends with "?", ≤ 35 words, no pressure words; a fixture line "Did you lose a tooth?" fails; a model memory follow-up starting "Did you…" is rejected and falls back to the scripted follow-up; every chip has **Not this one**; under-18 never sees `medium` triggers; risk language shows the safety note and logs `memory_safety_note_shown` with no text.
- [ ] Memory sections never get a `strong` logic result (clamped and logged); SEARCH auto-completes as `not_needed`; the memory card holds only verbatim student phrases.
- [ ] The logic-check opener appears after CONFIRM; the strong card reads "We would not recommend moving forward." with a text label and a working **Continue anyway**; the 2A.4a golden cases still pass; no gate reads `logic_*`.
- [ ] No Counterargument section or Stage 6 item 9 appears unless the assignment requires one.
- [ ] Voice (hybrid rule, t51; exact strings from checker spec 5.9): the **58-page paper** (4,200 counted answer words, pastedShare 0.70 → naturalWords 1,260) → **no note**; a **short session with moderate paste** (260 words, pastedShare 0.45 → naturalWords 143) → `VOICE_NOTE_ANSWERS_SHORT`; 300 words at 0.70 → 90 → `VOICE_NOTE_ANSWERS`; 400 words at 0.50 → 200 → no note; 700 words at 0.65 → 245 → `VOICE_NOTE_ANSWERS`; 210 words at 0.65 → 74 → `VOICE_NOTE_ANSWERS_LOW`; 250 words fully pasted → 0 → `VOICE_NOTE_ANSWERS_LOW`; 210 words fully typed (Stage 1 minimum only) → 210 at 0.0 → no note; boundaries 600 vs. 599 and 200 vs. 199 at pastedShare 0.61 (none vs. note; note vs. note), 80 vs. 79 (lighter vs. stronger), 0.60 vs. 0.61 in the `enough` tier (none vs. note); dictated words count as natural; Stage 5 draft text and Stage 3 notes don't change `naturalWords`; no baseline → no note; no voice note on any Stage 1–5 screen; `VOICE_NOTE_ANSWERS_ALL` appears nowhere in app code.
- [ ] The Stage 3 card, the outline export and the Stage 5 view show the lesson concept, teach aspect and memory card from saved data with no re-asked questions; the export canary test still passes.
- [ ] Nightly `evals/stage2-lesson-loop.jsonl` runs the lesson, routing, teach-then-ask, highlight-reel and memory-clamp golden cases against the live model.

### Build item S6-t48 — Gentle voice nudge in revision (Colton, Nov 20, 2026)

Replace the Stage 6 (and Stage 5 section-feedback) mismatch warning UI with the voice nudge (section 6 above; stage specs section 7 and 6.1 item 5; decision 45). Same `lib/style/mismatch.ts` logic and thresholds.
- Copy: "This part sounds a little different from your usual voice. Want to read it aloud and make it sound more like you?" plus a collapsed **What we noticed** with the named tells. No amber, no ⚠.
- **Make it sound like me** → the voice-tips/rework panel (highlights, read-aloud of that part, ≤ 3 tips, no rewritten text). **Keep it as is** → dismiss, `voice_nudge_kept`, no note, no penalty, resolves item 5 for that part.
- Events: `voice_nudge_shown`, `voice_nudge_rework_opened`, `voice_nudge_kept` (replace `mismatch_warned`, `mismatch_response`). `/admin/sop` tracks the nudge rate and rework vs. keep.

**Acceptance tests**
- [ ] A triggered mismatch shows the exact t48 copy and names each tell under **What we noticed**.
- [ ] **Make it sound like me** opens the panel and never shows rewritten or example sentences; saving a revision re-runs the check.
- [ ] **Keep it as is** needs no note, logs `voice_nudge_kept`, and resolves checklist item 5; nothing in the UI implies the student didn't write it.
- [ ] CI grep: the retired warning headline, "I've reworked it", "This is my writing", "I reworked these", and the events `mismatch_warned` / `mismatch_response` (patterns built from parts) appear nowhere in app code.

### Build item S3-t56 — Drafting muscle (Colton's Stage 3; student-facing label "Drafting") (Colton, Nov 20, 2026; updated t58) — ⚠ PENDING COLTON'S REVIEW, DO NOT BUILD YET

> **Status: PENDING (t58).** Spec: **`retainwrite-stage3-draft-spec.md`** (decisions 48–60 and 73–81; statuses DECIDED / LOCKED / PROVISIONAL are marked there). Colton's t58 answers resolved naming (**Drafting**), example language instead of frames, rough-intro-first with the revisit in revision, strict in-order drafting, the payoff location and zoom-out frequency. **DO NOT BUILD YET stays on because material items are still open** (spec section 15):
> 1. **Q20 stage numbering after Drafting:** Colton refers to a "Stage 4" after Drafting and "Stage 5 (revision)", but the code has one stage (Revise & feedback, route 6) after Drafting. This decides where the payoff and the intro revisit live.
> 2. **Decision 81 (rough intro first, revisit in revision)** is provisional pending research validation.
> 3. **Q4 / Q6** (paragraph-per-point default; whether the outline collects a real second sentence) change the framework and ledger shape.
>
> Replace this banner with "APPROVED" once those are answered. When approved, it ships behind `FEATURES.draftingMuscle = false` in `lib/config.ts` (a code constant, not an env var), turned on only after the acceptance tests pass. Until then the classic draft stage (stage specs 5.1–5.3) is the behavior. **Naming:** the student-facing label is exactly **"Drafting"** everywhere (stage rail, headers, buttons, emails, help). Internal ids stay as they are: route `/app/papers/[paperId]/stage/5`, `stage_progress.stage = 5`, `FEATURES.draftingMuscle`, `draft_*` tables and events, `drafts`, `lib/drafting/*`, this item's `S3-` prefix and the spec's file name.

**Implementation steps (when approved)**
1. **Flag and mode:** `FEATURES.draftingMuscle` (default `false`); read at Drafting entry and stored as `stage_progress.data.draftingMode = 'classic'|'muscle'`. Papers already drafting stay classic.
2. **Label:** rename the stage's student-facing label to **Drafting** in the stage rail, headers, emails and help copy (snapshot test). Don't rename internal ids.
3. **Migration `0010_drafting_muscle.sql`** (spec section 12): `papers.paper_genre` + `paper_genre_source`, `draft_ledgers`, `draft_paragraphs` (incl. `intro_variant`, `intro_format`, `opener_choice`, `conclusion_checklist`, `connector_sets_shown`, `rubric_explainers`, `paste_meta`), RLS `auth.uid() = user_id`. 0009 stays reserved for the section-loop fallback.
4. **Locked ledger** (`lib/drafting/ledger.ts`, section 3): built in code from `section_decisions`, the approved outline, verified excerpts, lesson, story angle and thesis; verbatim origins only; versioned on outline edits or section reopen, with the soft "Your plan changed" banner.
5. **Framework** (section 4): intro → one paragraph per major point → counter only if the rubric requires it → conclusion; promote/fold ideas (cap 3 per section); paragraph minimums from the 5.3 formula (floor 50).
6. **Opener on every section** (section 8.1): "Where are you at on this? Want to give it a shot, or want me to break it down?" → **Break it down for me** (shape card → read-back → draft) or **I'll give it a shot** (read-back → draft; shape one tap away). Independence fade after 3 papers [PROVISIONAL].
7. **One sentence at a time** (section 8.2): a single sentence input; committed sentences move up into the paragraph; earlier sentences in the current paragraph editable; multi-sentence paste splits; **Write as one box** alternative; reduced motion honored.
8. **Intro first** (section 5): format card (`lib/coaching/introFormats.ts`), verbatim read-back, the variant's first-summary prompt, opening checklist, "rough is fine" copy. **No intro revisit inside Drafting.**
9. **Per-type intro variants** (section 6, PROVISIONAL): `paper_genre` → thesis / story / reflective / case (fallback from `prompt_type`; `unknown` → thesis); **Change** control; variant formats, checklist, first-summary prompt and default connector set.
10. **Conclusion** (section 8.3): shape card "A conclusion can look back" (covered → figured out → how it finishes), scripted reflective prompts one at a time, soft conclusion checklist; never writes the reflection.
11. **Rubric explainer** (section 7): verbatim teacher quote + ≤ 30-word plain line + self-check question; `MODEL_FAST`, cached; scripted fallback.
12. **Per-paragraph loop** (section 8.4): OPENER → TEACH (if asked) → RE-READ → STUDENT DRAFTS → CHECK → STRUCTURE FEEDBACK → TIGHTEN/REORDER → STUDENT REVISES → SAVE; `ParagraphFeedback` (`MODEL_STRONG`, incl. `connectorRelation`, `heavySentence`, `conclusionChecklist`) with a rule-based fallback; 5.3 hard rules per paragraph; section text derived from paragraphs so `drafts` v1 and the section 7 check are unchanged; **strict in-order** (no skip control in Drafting).
13. **Tightening + example language** (section 9): code-computed flow/tighten checklist (incl. "Sentence {n} is carrying a lot"), reorder questions by number, a Reorder view that moves the student's own text byte-for-byte (no auto-apply), and **connector chips** from `lib/coaching/connectors.ts` (≤ 4 words each, display only, never fill-in-the-blank). Do **not** create `arcFrames.ts`.
14. **Drafting guard** (`lib/ai/draftGuard.ts`, section 10): D1–D9 after `lib/ai/guard.ts` (D6 rejects any frame/slot pattern; D9 is the hidden-draft leak check from S3-t57); retry once, then fallback; `lib/ai/genericWords.ts`; CI bank checks.
15. **Intro revisit in revision** (stage specs 6.1 t58 line, PROVISIONAL): first item of the revision checklist when the muscle is on; questions only.
16. **Edge cases** (section 11): stall reuses TEACH / MIRROR + t52 gentle triggers + Say it out loud + flag; the fixed "write it for me" decline; paste allowed with the 5.2 note once per session per paper; t48 voice nudge only.
17. **Events** (section 13) and `// SOP: coaching only, never generate submission text` at every AI call site.

**Acceptance tests (full list: spec section 14)**
- [ ] Every student-facing string for the stage reads exactly "Drafting"; "Stage 3" / "Draft stage" don't appear in UI copy.
- [ ] Ledger v1 is created on entry with verbatim-only origins; no ledger edit control; outline edits create v2 and flag only affected paragraphs.
- [ ] No Drafting screen re-asks anything answered in Stages 1–4.
- [ ] Every section (intro, body, counter, conclusion) opens with the exact opener; both choices lead to an empty input the student fills first.
- [ ] Sentences commit one at a time and move up; earlier sentences in the current paragraph are editable; later paragraphs/sections can't be opened early; no skip control.
- [ ] The intro opens first with the variant's first-summary prompt; a rough intro at the minimum can be checked and saved; no intro revisit prompt inside Drafting; revision opens with the intro revisit.
- [ ] Per-type variants: thesis types → thesis check; narrative / personal-experience / admissions → story intro with a so-what check and no thesis check; reflective → context + insight; case study → situation + question; the student's **Change** wins.
- [ ] Conclusion shape card teaches looking back, prompts appear one at a time, the repeat-the-intro check is a question, and no reflection text is generated.
- [ ] Rubric intro requirements show a verbatim quote, a plain line and a question; topic claims in the plain line are rejected.
- [ ] Connector chips come only from `connectors.ts`, insert nothing, and contain no slots; no `[ ]`, `___` or "We started with…" pattern exists in app code or coach output.
- [ ] Reorder suggestions use numbers only; no auto-apply; moves are byte-identical.
- [ ] Drafting-guard topic-leak set (servant leadership / Legere cases) passes; nightly `evals/drafting-guard.jsonl` has 0 leaks.
- [ ] Stall paths and the "write it for me" decline never render a sentence; paste never blocks and shows the 5.2 note once per session per paper; drafting text doesn't change `naturalWords`.
- [ ] 5.3 gates, Stage 5 completion and `drafts` v1 shape are unchanged; with the flag `false`, the classic flow renders and no `draft_*` rows are written.

### Build item S3-t57 — Interaction design layer (Stages 1–5) + hidden-draft scaffold (Colton, Nov 20, 2026; updated t58) — ⚠ PENDING COLTON'S REVIEW, DO NOT BUILD YET

> **Status: PENDING (t58).** Spec: `retainwrite-stage-specs.md` **section 2C** (decisions 61–72, 82) and `retainwrite-stage3-draft-spec.md` **section 11A** + draftGuard **D9**. Colton's t58 answers settled section-only zoom-outs, the Drafting milestone pop-up, the payoff at the end of Drafting, and the hidden draft as a full-paper answer key. **DO NOT BUILD YET stays on because material items are still open** (Drafting spec section 15):
> 1. **Q16 disclosure:** whether students are told the hidden full-paper answer key exists, plus legal review of the privacy wording. The hidden draft shouldn't ship without it.
> 2. **Q17 retention:** how long hidden-draft text is kept (drafted: 30 days after Drafting, 90 days max).
> 3. **Q20 stage numbering after Drafting** (where the payoff fires).
>
> Replace this banner with "APPROVED" once those are answered. When approved, it ships behind two code constants in `lib/config.ts`, both **default `false`**: `FEATURES.interactionLayer` (rhythm, ghost, milestone pop-ups, payoff, jump-to-edit) and `FEATURES.hiddenDraft` (answer-key generation, read-back shaping, leak guard). Either can ship alone (the interaction layer has no blocking open items beyond Q20). Stage numbers here are the code's six stages; the stage after the outline and sources is labeled **Drafting**. The internal design-intent phrase for the payoff stays out of app code and copy; student copy is "Look at everything you wrote."

**Implementation steps (when approved)**
1. **Flags/constants:** `FEATURES.interactionLayer`, `FEATURES.hiddenDraft`, `HIDDEN_DRAFT_MODE = 'prose'` (full paper, decided t58; `structure` kept as an outage/cost fallback), `SKELETON_PEEKS = false` in `lib/config.ts`; no new env vars.
2. **Beat addresses + deep links** (2C.1, 2C.6): one question or frame per beat from Stage 1; `{stage, sectionKey, step, beatId}`; URL params; `stage_progress.data.resumeBeat` (Zod).
3. **Skeleton builder** `lib/skeleton/build.ts` (2C.2): pure, from saved rows; labels, the student's captured-idea notes and the student's drafted sentences only; never hidden-draft or coach text.
4. **Ghost** (2C.2, 2C.9–2C.11): appears after DISSECT; desktop rail, mobile segmented strip; `<nav aria-label="Paper progress">`.
5. **Zoom-outs after each section only** (2C.3): none in Stage 1; after the thesis and after each section's loop (after the logic checkpoint resolves), replacing the ADVANCE transition; **no peeks** (`SKELETON_PEEKS = false`). In Drafting: the milestone pop-up with the skeleton as a background ghost, readable only on **Review all**, then **Ready for section {n}?** / **Do you want to review?** (Drafting spec 11A).
6. **Payoff** (2C.4): at the **end of Drafting**, "Look at everything you wrote." with the full outline (intro, body, support, conclusion) in the student's own sentences and a stat row from code (`papers.payoff_shown_at`). The outline stage's last zoom-out shows only "Your outline is complete."
7. **Jump-to-edit** (2C.6): confirmed → CONFIRM + Edit (existing reopen rules), in progress → current beat, locked → read-only preview; in Drafting, strict order: a jump edits an earlier drafted section and then returns to the current beat; **Back to where you were** chip; no gate bypass.
8. **Migration `0011_interaction_layer.sql`** (2C.12): `private` schema (not exposed), `private.hidden_drafts` (RLS on, no policies), `papers.payoff_shown_at`. 0009 stays reserved; 0010 is S3-t56.
9. **Hidden draft = invisible answer key** (2C.7): a server-side full-paper generation from the captured Q&A (the method of the owner's original test run) in `lib/server/hiddenDraft/*` (`import 'server-only'`), `MODEL_STRONG`, per milestone only when the ledger hash changed, cap 15 per paper, one row per paper overwritten; `HiddenDraftSignals` (ids/enums/numbers, incl. `placement`, `pacing`, `gaps`, `landing`, `sentenceWeight`) are the only export; daily purge cron `/api/cron/hidden-draft-purge` (`CRON_SECRET`).
10. **Read-back shaping** (2C.7): code-built from student-verbatim items + signals; idea-by-idea order from the answer key; scripted flags ("This idea might land better in {section}.", pacing, gap, "Your sentence {n} plan carries a lot") with **Move it** / **Keep it here**; max 2, confidence ≥ 0.7; never blocks; never feeds any prompt, voice baseline, mismatch, revision check or checker.
11. **Leak guard H1–H8** (2C.8) + draftGuard **D9**: ESLint `no-restricted-imports`; `assertNoHiddenDraftLeak` (5-gram not in the student corpus; ≥ 0.5 novel-token containment or ≥ 0.6 char-4-gram Jaccard) on every student-facing string in Stages 2–5; never exported (Word/PDF/data export/email); never in API/RSC/HTML responses; never logged; strict Zod response schemas; canary fixtures.
12. **Wildcard safety (LOCKED t58; stage specs 2B.6):** every lead batch, including refreshes, carries a wildcard; allegation-flagged wildcards show "Reported, not confirmed." instead of being blocked; never preselected; the student can override (logged).
13. **Events** (2C.13) and the SOP comment `// SOP: hidden scaffold — internal structure check only; never student-facing, never exported` at the generation call site.

**Acceptance tests (full list: stage specs 2C.14 and Drafting spec section 14 items 18–28)**
- [ ] One question or frame per beat screen from Stage 1; step order and all existing gates unchanged.
- [ ] Ghost absent in Stage 1 before DISSECT; skeleton text is only labels, captured-idea notes and the student's drafted sentences (origin test).
- [ ] No zoom-out in Stage 1; zoom-out after the thesis and after each section's loop (any logic tier); no peeks by default; none after a skip.
- [ ] Drafting milestone pop-up: ghost unreadable until **Review all**; drafted sections clickable; **Ready for section {n}?** / **Do you want to review?**; a jump edits an earlier section and returns to the exact current beat.
- [ ] Payoff shows once at the end of Drafting with clean copy and the full outline (intro, body, support, conclusion); CI grep finds the internal phrase and profanity nowhere in app code or copy.
- [ ] Read-back flags: ≤ 2, confidence ≥ 0.7, scripted templates only; Move transfers the idea unchanged; logic tier unaffected.
- [ ] Leak guard: hidden-draft 5-grams not in the student corpus and near-verbatim paraphrases are blocked and logged; the canary never appears in .docx/PDF, API/RSC/HTML responses, emails, TTS scripts, logs or `session_events` across a full Stage 1–5 Playwright run; `private.hidden_drafts` is unreachable with anon/authenticated keys; ESLint blocks client imports.
- [ ] Regeneration only at milestones with a changed ledger hash; cap enforced; one row per paper; purge works.
- [ ] Every refresh batch has a wildcard; an allegation-flagged wildcard shows "Reported, not confirmed.", isn't preselected, and can be picked (override logged).
- [ ] axe passes on ghost, milestone pop-up, Review all and payoff; focus management, one polite milestone announcement, reduced motion honored; mobile strip, sheet and sticky buttons work at 360 px.
- [ ] With both flags `false`: classic transitions, no skeleton events, no hidden-draft generation or rows, H3/D9 no-ops.

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
Trigger the voice nudge if 2+ tells, or `unseenVocab` alone > 20% (stage specs section 7 wins on thresholds). Save result in `drafts.mismatch`, log `voice_nudge_shown` (t48; replaces `mismatch_warned`).

Voice nudge UI (Colton t48; soft neutral style, no amber, non-blocking, never a check-in or an accusation):
> **This part sounds a little different from your usual voice. Want to read it aloud and make it sound more like you?**

A collapsed **What we noticed** line names the tells (e.g. "sentences here average 32 words; yours usually run about 14", "words you don't usually use: X, Y, Z"). Buttons: **Make it sound like me** (opens voice tips for that part: highlights, read-aloud of just that part, ≤ 3 coaching tips, never rewritten text; logs `voice_nudge_rework_opened`) and **Keep it as is** (dismisses; logs `voice_nudge_kept`; no note, no penalty, resolves Stage 6 item 5 for that part). The old warning headline and the "I've reworked it" / "This is my writing" buttons are retired (stage specs section 7, decision 45).

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
Admin (gate on `profiles.is_admin` — add that boolean column): `/admin/feedback` to review professor-feedback uploads, code praise/flags, grant credits; `/admin/sop` showing session_events aggregates (probe rates per question, drop-off by stage, upsell take rate, mismatch rate, and a Logic checkpoints panel: tier rates, downgrades, fail-opens, and a review list of `logic_strong_continued` / `logic_flag_feedback` events).

## 10. Quality bar
- Vitest unit tests for metrics, mismatch, thin-answer detection, stage gating, webhook idempotency, Stage 1 confirm gate, page-to-word estimate (275), voice-minimum calculator, interest-tag / lead `to_verify` rules, file-cap enforcement, MIME sniff, EXIF GPS strip, URL dedupe, OCR fallback order, the hard-limit guard rules in section 1.1 (one test per row), roadmap `rubricRef` validation, per-section loop completion rules, section-first locking (`assertSectionStepUnlocked`, skip unlocks the next section, Stage 5 locked while any section is skipped, preview writes nothing), 200 / 2×40 voice minimum with skips, 3–5 lead batches and the 20-per-paper cap with the search-prompt builder, outline export allow-list (.docx and PDF canary test), the LOGIC CHECKPOINT (Hitler example → `strong` and the student can still Continue anyway and finish Stage 4; a debatable interpretation → `moderate`; a critical-analysis reframe → `pass`; supportable unpopular opinion never `strong`; downgrade and fail-open rules; no gate reads `logic_*`; plus nightly live-model evals in `evals/logic-checkpoint.jsonl`), draft-feedback idea-note rule, light-cleanup fix rule, the three paste-gate tests (photos-only reaches the checklist, banned string absent, single follow-up), the paste-everywhere tests (d)–(f) (desktop + iOS long-press paste in every intake field, no-`preventDefault` grep with no exceptions, pasted voice sample completes Stage 1), the paste-ratio clamp and typed-weighted baseline, the Stage 5 paste suggestion (≥ 80 words, once per session per paper, no answer controls, no `paste_confirm`; CI grep that the retired Stage 5 question string, built from parts, is absent from app code and from the build specs outside changelog lines), the soft voice-note strings (retired t45 wording absent), `missingImportant`, story-angle guard rules, a/b/c citation-suffix detection, the S2-t47 tests (lesson extraction, three-path routing, TEACH and teach-then-ask, highlight reel, ranked leads + one wildcard counted toward the cap, memory triggers banned-topic test, memory checkpoint clamp, logic-check opener and red alert, counterargument only when required, the t51 hybrid voice-note tiers including the 58-page and short-session cases, the t52 gentle-invitation trigger test), and the S6-t48 voice-nudge tests (see the Stage 1 spec and stage specs).
- Accessible (labels, focus states, keyboard nav), mobile-first.
- Loading and error states on every action.
- README with: setup, `supabase db push`, how to run the Stripe webhook locally (`stripe listen --forward-to localhost:3000/api/stripe/webhook`), and deploy notes.
- Do not hardcode any secrets. Use exactly the env var names listed in section 0; do not invent others. Do not add Anthropic or ElevenLabs keys.

Build it end to end now. Start with the migration, env validation, and lib/ utilities with tests, then auth, then stages 1–6, then payments, then email, then admin. Implement Stage 1 from `retainwrite-stage1-intake-spec.md` (that doc wins on Stage 1; migrations `0005_stage1_assignment_first.sql` and `0006_stage1_extract_first.sql`) — do not implement the old four-block intake. **If Stage 1 already exists in the repo, ship the paste-gate fix and the paste-everywhere fix (Stage 1 items 0 and 0b / spec sections 0A and 0A.1) first, before anything else.** After each phase, run typecheck and tests and fix failures before moving on. **Current build order (Nov 20, 2026):** (1) Stage 1 paste-gate fix and paste-everywhere fix (Stage 1 items 0 and 0b), (2) the rest of the Stage 1 rewrite, including DISSECT and migration `0008_section_loop.sql`, (3) **Phase 11 — AI checker landing page at `https://www.retainwrite.com/ai-checker`**, (4) the section-by-section loop and draft/cleanup changes in Stages 2–6 (stage specs 2A, **2B (build item S2-t47)**, 5.3, 6.1, **7 (build item S6-t48)**; if Stages 2–6 aren't built yet, build them this way from the start; the Stage 1 parts of S2-t47, lesson + prompt type, ship with step (2)), (5) Phase 12 — blog, (6) Phase 13 — passcodes (may run earlier, after payments and admin). Every phase follows `retainwrite-coaching-philosophy.md`. The checker has its own spec: `retainwrite-ai-checker-spec.md` (that doc wins on checker behavior).

## 11. Phase — AI checker standalone landing page (`/ai-checker`) — runs RIGHT AFTER the Stage 1 paste-gate fix and Stage 1 rewrite

**Route:** `/ai-checker` → `app/(marketing)/ai-checker/page.tsx`
**Full URL (canonical):** `https://www.retainwrite.com/ai-checker`
**Apex:** `https://retainwrite.com/ai-checker` → **308** → `https://www.retainwrite.com/ai-checker` (Vercel domain redirect; do not add a second redirect in middleware)
**Supporting routes:** `https://www.retainwrite.com/ai-checker/rubric` (public, versioned rubric v1.0) and `https://www.retainwrite.com/ai-checker/report/[token]` (signed-in, opt-in saved reports only; `noindex`)

**Reconciliation note (Nov 20, 2026):** this phase **replaces the former "§12. Phase — Free AI checker (after the blog)."** The two were merged, not duplicated. The checker moved up to Phase 11 so it ships right after the Stage 1 work; the blog moved from §11 to **§12** and now follows the checker; passcodes stay §13. If checker code already exists from the old §12 instructions, update it to this phase and the spec rather than rebuilding.

**Spec:** build exactly what `retainwrite-ai-checker-spec.md` says (that doc wins on checker behavior and is complete on its own). Landing copy starts from `/workspace/retainwrite/ai-checker-landing-copy.md`, with the conflicts in checker spec section 6.3 resolved as that section says. **Do not publish the landing-copy FAQ 7 or the privacy lines until Colton signs off** (marked pending in both docs).

**What this is:** a standalone lead-capture and credibility landing page. It is **not** part of the six-stage flow: no stage rail, no `stage_progress`, no `assertStageUnlocked`, no paper. Its only connections to the app are the account created at the email step and the **Start your free first paper** CTA.

**Prerequisites:** auth (section 3), the Resend wrapper (section 8), `lib/style/metrics.ts`, `lib/ai/guard.ts`, and the free-first-paper entitlement (section 7, or `lib/entitlements.ts` if Phase 13 is done). Migrations: `0003_ai_checker.sql` (apply it if it isn't applied yet), then the new additive `0007_ai_checker_standalone.sql` (checker spec section 12.1; 0005 and 0006 are Stage 1).

### Product rules for this phase (enforce in code)
- **H1 and `<title>` (exact):** "AI Detector for Student Papers: Does It Sound Like You?"
- **Clean submit box:** one textarea for the draft (120–4,000 words, max 30,000 characters, live counter) and a collapsed **Add a sample of your own writing (optional)** (150–1,500 words, max 10,000 characters). No login to run a check.
- **Rubric v1.0, seven signals, each scored 0–100 for strength:** sentence-length variance, burstiness, vocabulary vs. the student's own writing sample, tone consistency, topic sentences, personal specifics, stock phrases. With no sample (and no saved `voice_profiles` baseline), vocabulary is **N/A** and its weight is removed and the rest **renormalized** (weights in spec section 8). No eighth signal.
- **Overall headline is "Signal strength,"** never "likelihood of AI," "AI %," or "chance AI wrote this." (The owner asked for a "likelihood" headline; we use Signal strength to stay honest.) Bands: **Keep 0–39 / Worth a look 40–69 / Fix first 70–100**, each with icon + label + number, never color alone.
- **Clean drafts** get the headline **"Your draft reads fine"**, not a middle score (count rules cap clean drafts at 39).
- **"About half come back clean" is met only by honest calibration** on a calibration set of real student writing, so typical human drafts land in Keep (spec section 9.1). The live **clean rate is a monitored metric** on `/admin/sop`, never a target the code steers toward. **Never force, randomize, or quota outcomes**; no randomness in scoring, no per-request adjustment, no score A/B tests. A determinism test enforces it.
- **Quotes only, never rewrites:** every tell is a verbatim quote with verified `start`/`end` offsets; the full report highlights them in the student's own text (client-side). No alternate sentences, no "humanize," no "try this." `lib/ai/guard.ts` and `// SOP: coaching only, never generate submission text` at every call site.
- **No detector-evasion framing:** never promise to beat Turnitin or any detector; banned: "bypass," "beat Turnitin," "undetectable," "pass AI detection," "humanize."
- **Visible disclaimer** on the page, in the report, in the email, and in the print view: no detector can prove AI use; false positives hit ESL students and very formal writers hardest; cite **Liang et al. (2023)**, *Patterns* 4(7), 100779, with the DOI link. Claim no accuracy rate.
- **Free preview** = overall result + top 2 signals (with their quotes). **Email capture** unlocks the full report on the page, emails it (HTML + PDF), **creates a free account** via a Supabase magic link (`auth.admin.generateLink`, delivered in our Resend email), and that account gets the **free first paper (no audio, no card)**, consistent with pricing. Age 13+ required, terms checkbox required, marketing checkbox unchecked by default and hidden for 13–17.
- **Privacy:** analyze in memory only; store only anonymous aggregate metrics (`ai_checker_runs`, numbers only). Locked previews carry an encrypted `sealed` result instead of a stored report. Drafts and reports are stored only when the student is signed in and opts in. Never log or send drafts anywhere else; never use them for training.

### Stack (same as the rest of the app)
- Grok via `openai` SDK, `baseURL: "https://api.x.ai/v1"`, `GROK_API_KEY`. `MODEL_FAST` (`grok-4.3`, `reasoning_effort: "none"`) for light classification; `MODEL_STRONG` (`grok-4.7`, `reasoning_effort: "low"`) for topic-sentence and personal-specifics judgments. `response_format` `json_schema` (`strict: true`) + Zod, `json_object` + Zod retry. 8 s / 30 s timeouts; on failure return deterministic signals with `partial: true`.
- Reuse `lib/style/metrics.ts` and the mismatch thresholds for vocabulary/register. The voice check keeps its four questions and 150-word sample (`MIN_VOICE_SAMPLE_WORDS`; paste allowed since Colton's t44, with the same quiet paste ratio feeding `voice_profiles.typed_word_share`) and writes the shared `voice_profiles` row.
- Resend from `EMAIL_FROM` (`RetainWrite Coach <coach@send.retainwrite.com>`).
- Abuse protection without login: Vercel **BotID** (`botid`; `initBotId` in `instrumentation-client.ts`, `checkBotId()` in `/api/ai-checker/analyze` and `/unlock`; no env vars), per-IP-hash limits (5/hour, 15/day anonymous; 10/hour, 30/day signed in), a visible challenge after **3** checks in 24 h, and a Vercel Firewall rate-limit rule as a backstop. The visible challenge uses Cloudflare Turnstile **only if the owner approves two optional env vars** (`NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`); **do not add them unless approved.** Until then, use the no-keys fallback: after 3 anonymous checks in 24 h, require the email step or sign-in to keep checking.
- No other new env vars. The seal key is derived with HKDF from `CRON_SECRET` (spec section 11).

### API, data, limits
- `POST /api/ai-checker/analyze`, `POST /api/ai-checker/unlock`, `POST|DELETE /api/ai-checker/save` (signed-in opt-in), `POST /api/ai-checker/voice`, `GET /api/ai-checker/unsubscribe`, cron `/api/cron/checker-retention` (Bearer `CRON_SECRET`). Shapes in spec section 11.
- Migrations `0003_ai_checker.sql` + `0007_ai_checker_standalone.sql`: `ai_checker_runs` (numbers only, plus `had_sample`, `weights_used`, `signal_status`, `unlocked`), `ai_checker_reports` (signed-in opt-in saves only), `ai_checker_saved_runs`, `ai_checker_leads` (+ `terms_accepted_at`, `account_created`, `run_id`), `checker_calibration_samples` (metrics only), view `ai_checker_daily_stats` (clean rate), `rubric_versions`, `voice_profiles`.
- Limits: draft 120–4,000 words and ≤ 30,000 characters; sample 150–1,500 words and ≤ 10,000 characters; body ≤ 64 KB; over limit → clear message, no model call; rate limited → 429.

### Results report design (required in this phase)
Follow checker spec section 5 exactly: premium, instantly scannable, clear on what to fix and what to keep.
- `ReportSummaryRing` (0–100 gauge titled **Signal strength**; clean state shows a check and **"Your draft reads fine"**), `SignalCard` (score, icon, Keep / Worth a look / Fix first, quoted examples, one coaching question), `HighlightedDraft` (the student's text with highlighted, numbered spans by band, client-side only), `SectionHeatmap`, `EmailGate`, `UpsellPanel`, `SubmitBox`, `Disclaimer`.
- Design tokens: Newsreader + Source Sans 3, ink `#15202B`, warm off-white `#F6F1E8`, terracotta accent `#9A4A2C`, band fills/inks from spec 5.5; WCAG AA; works at 320 px; reduced-motion respected; print view.
- Bottom: **Start your free first paper** and the optional voice check.
- **Voice-baseline paste note (Colton, Nov 20, 2026, t45; softer wording t46; checker spec 5.9):** at the very bottom of the full report, email and PDF, below every score and never interrupting the headline or ring, show in plain muted text one kind note in a single consistent style: for the public checker's writing sample, “Your writing sample was pasted in, which is totally fine. A typed or spoken sample helps us understand your voice better, so treat the voice comparison as a lighter read.”; for voice answers (profile, in-app checks, Stage 6), “Your voice answers were mostly pasted in, which is totally fine. Typed or spoken answers help us understand your voice better, so treat the voice comparison as a lighter read.” Keep both strings in `lib/copy/voiceNotes.ts`; t45's “not reliably determined” wording is retired.
  - **When (t51 hybrid rule, replaces `pastedShare > 0.60` alone):** by `naturalWords` (typed + spoken words in the baseline used) and `pastedShare`: ≥ 600 → none; 200–599 → paste note only if > 0.60; 80–199 → lighter note (paste wording if > 0.60, else `…_SHORT`); < 80 → `…_LOW`. Numbers [PROVISIONAL]; strings and the sample variants in checker spec 5.9. When both a sample and a profile exist, use the one with the better tier.
  - **Which baseline:** the writing-sample box for the standalone checker (`sampleInputMeta`); `voice_profiles.typed_word_share` for a profile; the Stage 1 coaching answers for in-app and Stage 6 checks.
  - **Typed vs. pasted:** dictation and speech count as typed; missing meta counts as typed.
  - **No baseline:** keep vocabulary N/A and show no note.
  - **Combined with weighting:** the same paste ratio drives the typed-weighted baseline (`w = 1 − 0.8 × paste_ratio`); a mostly pasted sample falls back to a reliable profile; under 150 typed baseline words → short-sample downgrade.
  - **Response and logging:** add `voiceBaseline` to the response, `baseline_pasted_bucket` to `ai_checker_runs`, and the event `checker_voice_paste_note_shown`.

### SEO, performance, analytics
- SEO (spec 4.5): title/H1 as above, meta description from the landing copy, canonical `https://www.retainwrite.com/ai-checker`, `metadataBase` www, OG/Twitter image via `next/og`, `FAQPage` + `WebApplication` JSON-LD, sitemap entries, `noindex` on saved reports. Link to the public versioned rubric `/ai-checker/rubric` from the signals section, the report header, and the footer disclaimer.
- Performance (spec 21): static page from the edge; **LCP ≤ 2.0 s at p75 on mobile**, CLS ≤ 0.05, INP ≤ 200 ms; initial JS ≤ 120 KB gzipped; report components lazy-loaded; Lighthouse CI mobile performance ≥ 90, accessibility ≥ 95, SEO 100.
- Analytics (spec 13): `checker_viewed`, `checker_submitted`, `checker_sample_added`, `checker_preview_shown`, `checker_reads_fine`, `checker_band`, `email_gate_submitted`, `report_unlocked`, `account_created_from_checker`, `checker_magic_link_sent`, `free_paper_started_from_checker`, `checker_challenge_shown`, `checker_bot_blocked`, `rate_limited`, `checker_rubric_link_clicked`, `ai_fallback`, and the rest of the spec list. IDs, enums, and numbers only; never text, quotes, or emails in `detail`. Clean rate (daily + 7-day) on `/admin/sop`.

### Acceptance tests (must pass; full list in spec sections 5.7 and 17)
- (t51 supersedes the threshold cases in this line) Voice note: 150 typed words → `VOICE_NOTE_SAMPLE_SHORT`; 650 typed → none; 650 pasted → `VOICE_NOTE_SAMPLE_LOW`; 300 words at 0.70 pasted → `VOICE_NOTE_SAMPLE`; profile at 1,260 natural words and 0.70 pasted → none. (t45/t46, original) Paste note: a fully pasted sample → `VOICE_NOTE_SAMPLE` (soft wording) at the bottom of the full report/email/PDF with the headline unchanged; a typed or dictated sample → no note; 0.60 → no note, 0.61 → note; no sample and no profile → N/A and no note; a pasted sample plus a reliable profile → the profile is used, no note; the preview never shows the note; Stage 6 shows the same note under the same rule from Stage 1 answers.
1. `https://www.retainwrite.com/ai-checker` renders with H1/title "AI Detector for Student Papers: Does It Sound Like You?"; the apex URL returns 308 to it; canonical/OG/sitemap use www.
2. A check runs with no login; the page creates no `stage_progress` rows.
3. No sample → vocabulary N/A and `weightsUsed` covers the six remaining signals (sum 84 before normalization); with a sample → vocabulary scored; the sample is never persisted.
4. A clean fixture returns "Your draft reads fine" (overall ≤ 39); a stock-phrase-heavy fixture lands in Fix first; a mixed fixture can land in Worth a look.
5. Every tell's quote equals `text.slice(start, end)`; the guard rejects rewrites; no replacement text appears in the UI.
6. The locked preview shows exactly the overall result + top 2 signals; the `sealed` blob can't be decoded or altered by the client; an expired or tampered seal is rejected.
7. Unlock creates exactly one account per email (magic link), records terms acceptance, and the new account can start the free first paper (no audio, no card); under-13 is blocked; 13–17 gets no marketing opt-in.
8. Canary test: a unique string in the draft never appears in any table, log, analytics event, or error report.
9. Determinism: the same input (model mocked) gives identical output; scoring has no randomness and does not read clean-rate data.
10. Abuse: BotID blocks the dev `BAD-BOT` bypass; the 4th check in 24 h from one IP requires the challenge (or the email step without Turnstile keys); over-limit → 429 with no model call; > 30,000 characters is rejected client- and server-side.
11. The disclaimer (with the Liang et al. 2023 citation) is visible on the page, in the report, in the email, and in the print view; no banned phrase appears anywhere in the UI.
12. Lighthouse CI (mobile) meets the budgets above.
13. Calibration: the human calibration set reads fine at ≥ 80% (ESL and formal subsets ≥ 75%); results are stored in `checker_calibration_samples` and summarized on the rubric page.

After this phase, run typecheck and tests and fix failures.

## 12. Phase — Public blog (after the AI checker)

Add `/blog` (index) and `/blog/[slug]` (MDX or Markdown posts in e.g. `content/blog/`). Clean, mobile-first, SEO title + description + canonical, listing page with date and excerpt. Marketing will supply posts; ship the routes and a placeholder post so the pages are not empty. RSS is optional. No chat UI. After this phase, typecheck and fix failures, then immediately build the AI checker in section 12 — do not wait for more blog content.

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

---

## Changelog

- **Nov 20, 2026 (t58)** — Folded in Colton's t58 decisions. The draft stage's student-facing label is exactly **Drafting** (internal ids unchanged; noted in S3-t56). **S3-t56** rewritten: opener on every section, one sentence at a time, conclusion that looks back, strict in-order drafting, connector example language instead of arc frames, intro revisit moved to revision. **S3-t57** rewritten: zoom-outs after each section only (peeks off), the Drafting milestone pop-up, the payoff at the end of Drafting, the hidden draft as a server-side full-paper answer key (full prose), wildcard safety per the locked decisions. Both still behind default-`false` flags and still marked **DO NOT BUILD YET**, with the remaining material open items listed in each banner. Build order unchanged.
- **Nov 20, 2026 (t57)** — Added build item **S3-t57** (interaction design layer across Stages 1–5 + hidden-draft scaffold; stage specs 2C, draft spec 11A and D9; decisions 61–72): one beat at a time, progress ghost, peeks and milestone zoom-outs from Stage 2 on, the end-of-outline payoff, jump-to-edit with resume, hidden draft (server-only, per-milestone, short retention) with leak guard H1–H8, migration `0011_interaction_layer.sql`. **Pending Colton's review; behind `FEATURES.interactionLayer = false` and `FEATURES.hiddenDraft = false`.** Governing doc now v1.6. Build order unchanged.
- **Nov 20, 2026 (t56)** — Added build item **S3-t56** (Colton's "Stage 3 — draft stage" drafting muscle; spec `retainwrite-stage3-draft-spec.md`, decisions 48–60): locked ledger, framework, intro first with teach-then-draft and per-type intro variants, rubric intro explainers, per-paragraph loop, tightening with scripted arc frames, drafting guard, migration `0010_drafting_muscle.sql`, acceptance tests. **Pending Colton's review of the open questions; ships behind `FEATURES.draftingMuscle = false`.** Added the spec to Read these first (#4) and a pending pointer under Stage 5. Build order unchanged.
- **Nov 20, 2026 (t51, t52)** — Per Colton: the voice note now uses a hybrid threshold on natural (typed/spoken) words across the paper plus paste share (tiers 600 / 200 / 80 [PROVISIONAL]; `…_SHORT` and `…_LOW` strings; `VOICE_NOTE_ANSWERS_ALL` retired) in Stage 6, S2-t47 item 10 and its tests (including the 58-page and short-session cases), and the checker phase. Memory triggers are rewritten as gentle invitations that connect back to the paper, with a CI phrasing test (S2-t47 item 7 and tests). Governing doc is now v1.5.
- **Nov 20, 2026 (t47, t48)** — Added build item **S2-t47** (Colton's Stage 2 brainstorm: THE LESSON per paper, three routing paths, TEACH before PROBE with teach-then-ask, concept vs. instance highlight reels with a search offer, ranked leads plus one Outside the box wildcard counted toward the 20 cap, memory-forward path for personal prompts, the logic-check opener and red alert, counterargument only when required, the all-pasted voice note) and build item **S6-t48** (gentle voice nudge replacing the mismatch warning's check-in buttons; `voice_nudge_*` events). Loop order, Stage 2/3/4/6 bullets, section 6, the hard-limits table, the quality bar and the build order updated. Governing doc is now v1.4 (still #1 in Read these first).
- **Nov 20, 2026 (t46)** — Per Colton: the voice-baseline note now uses one consistent soft style (`VOICE_NOTE_SAMPLE` for the public checker's writing sample, `VOICE_NOTE_ANSWERS` for voice answers and Stage 6), retiring the t45 wording. Stage 5 (and the Stage 6 editor): the ≥ 80-word paste modal question is replaced by a supportive, dismissible inline suggestion shown at most once per session per paper, with no answer recorded. Tests and greps added.
- **Nov 20, 2026 (t45)** — AI checker phase: added the bottom-of-report voice-baseline paste note (pasted share > 60%; scoped to the writing sample, voice profile, or Stage 1 answers; dictation counts as typed; no note without a baseline), combined with the typed-weighted baseline, plus its tests. Stage 6 shows the same note from the Stage 1 answers.
- **Nov 20, 2026 (t43/t44)** — Added Stage 1 item **0b**, shipped first with item 0: remove every paste block from every intake input. Colton's t44 removed t43's voice-answer exception, so paste is allowed universally, voice answers included. Added tests (d)–(f), a hard-limits row, and the build-order line. The voice-capture item now says paste is allowed, with the quiet `paste_ratio` and typed-weighted baseline as the Stage 6 mitigation (never blocks or warns). Stage 2 raw-material and checker voice-check lines changed from paste-blocked to paste allowed.
- **Nov 20, 2026 (t41/t42)** — Added Colton's per-section LOGIC CHECKPOINT (after CONFIRM, before ADVANCE; mandatory): tiers pass / moderate / strong, schema, UX, guard row in 1.1, `logic_*` columns, events, tests. Per Colton's t42 change, the t41 hard stop was removed before shipping. Strong is a firm flag with **Continue anyway**, logged as `logic_strong_continued` for SOP review, and nothing in the checkpoint gates. Governing doc is now v1.2.

- **Nov 20, 2026 (t40)** — Applied Colton's answers. Voice minimum is now 200 words across the answers given, skipped answers allowed; 2 × 40 kept; personal-question requirement dropped (constants, Stage 1 item 4, hard-limit table). The loop is section-first with skip, read-only browse-ahead, and a persistent bottom reminder with a jump-back link; rule 2 gained the loop-span exception and `assertSectionStepUnlocked`. Lead sets are 3–5, capped at 20 AI-researched leads per paper, then a ready-to-paste Google search prompt (new constants). The final outline exports to .docx (`docx`) and PDF (`@react-pdf/renderer`) with no AI prose. Counterargument (only when required or argumentative) and light cleanup (one-click for single-word and citation-format fixes) keep their defaults, unconfirmed by Colton.

- **Nov 20, 2026** — Stage 1 is now read-the-upload-first: added the urgent "Remove the paste gate" fix (Stage 1 item 0) with three acceptance tests; immediate per-file extraction; a short confirm checklist with "Not specified" instead of a field-by-field gate; one follow-up question; Pick your story. Added coaching principles (section 1, rule 7), rule 8 (paste is never a gate), and the INTD600 phase-to-stage map (section 1A), with matching notes in Stages 2–6. New additive migration `0006_stage1_extract_first.sql`. No new env vars.
- **Nov 20, 2026 (t38)** — Merged and moved the AI checker phase: former §12 "Free AI checker (after the blog)" is now **§11 "AI checker standalone landing page (`/ai-checker`)"**, run right after the Stage 1 paste-gate fix and rewrite; the blog moved from §11 to §12; passcodes stay §13. The phase states the route and the full URL (`https://www.retainwrite.com/ai-checker`, apex 308 → www), with the optional writing sample and N/A renormalization, the "Signal strength" title and "Your draft reads fine" headline, honest calibration with clean rate monitored (never forced or randomized), email-step account creation with the free first paper, in-memory-only privacy, BotID plus a challenge after 3 checks, SEO, an LCP target, analytics, and acceptance tests. New migration `0007_ai_checker_standalone.sql`. `SITE_URL` changed to `https://www.retainwrite.com`, and a note added that the Stripe webhook must use the www URL. Turnstile env vars are optional and pending owner approval.
- **Nov 20, 2026 (t39)** — Added `retainwrite-coaching-philosophy.md` as THE governing document (it wins on philosophy; the specs hold implementation) and a "Read these first" list at the top. Added rule 9 and section 1.1 mapping each hard limit to guard and prompt rules. Stage 1 now ends with DISSECT (roadmap, `section_plans`); the per-section loop runs PROBE in Stage 2, SEARCH in Stage 3, and SUMMARIZE + CONFIRM in Stage 4 (new completion rule); Stage 5 gets the draft feedback pattern; Stage 6 gets narrow light cleanup. New migration `0008_section_loop.sql`; build order updated.
