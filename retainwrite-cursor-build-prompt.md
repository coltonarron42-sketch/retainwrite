# RetainWrite — Cursor Build Prompt (paste everything below this line into Cursor)

## Read these first, in this order

1. **`retainwrite-coaching-philosophy.md` — THE governing document** (v1.2, Nov 20, 2026). It governs every stage, probe, summary, and interaction. It wins over every other doc, including the stage specs, **on philosophy**. The specs below still hold the implementation detail. If a spec rule would break a hard limit in the philosophy doc, follow the philosophy doc and flag the conflict in your PR description.
2. `retainwrite-stage1-intake-spec.md` — wins on Stage 1 implementation.
3. `retainwrite-stage-specs.md` — wins on Stages 2–6 and cross-stage implementation (including the section-by-section loop, section 2A).
4. `retainwrite-ai-checker-spec.md` — wins on the standalone AI checker (Phase 11).
5. `retainwrite-admin-passcodes-spec.md` — wins on passcodes (Phase 13).
6. This build prompt — stack, conventions, data model, and build order.

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
9. **Governing philosophy (`retainwrite-coaching-philosophy.md`).** RetainWrite is a learning system, not a writing tool: AI is the guide, not the ghostwriter. The section-by-section loop (DISSECT → PROBE → SEARCH → SUMMARIZE → CONFIRM → LOGIC CHECKPOINT → ADVANCE) is the engine: DISSECT ends Stage 1, the loop runs per section in Stages 2–4 (section-first: each section goes PROBE → SEARCH → SUMMARIZE → CONFIRM → LOGIC CHECKPOINT before the next opens; skip and read-only browse-ahead allowed), Stage 5 drafts from the saved section decisions, and Stage 6 does light cleanup only (stage specs section 2A).

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

**The section-by-section loop on top of this map** (philosophy appendix A): DISSECT = end of Stage 1 (student-confirmed roadmap, `section_plans`); PROBE = Stage 2, per section, after the thesis work; SEARCH = Stage 3, per section; SUMMARIZE + CONFIRM = Stage 4, per section; **LOGIC CHECKPOINT** (Colton's addition) = Stage 4, right after each CONFIRM, mandatory and never blocking; ADVANCE = next section, **section-first** across Stages 2–4 (skip + read-only browse-ahead; stage specs 2A.1); draft feedback = Stage 5; light cleanup = Stage 6 (one-click only for single-word and citation-format fixes; default kept, unconfirmed by Colton). The story angle stays above the loop as the spine.

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
Also: trigger to insert a `profiles` row on `auth.users` insert; trigger to keep `papers.updated_at` fresh; when a paper is created, insert stage_progress rows 1–6 with stage 1 `in_progress` and 2–6 `locked`. Storage buckets: `sources`, `feedback`, `audio`, `assignment-files` (all private, RLS by user folder `${user_id}/...`). The `assignment-files` bucket is created in migration `0005_stage1_assignment_first.sql` (owner-only, signed URLs only, no public objects).

Generate TypeScript types into `lib/database.types.ts`.

## 3. Auth
- Supabase Auth: email magic link + email/password. No card at signup.
- Pages: `/login`, `/signup`, `/auth/callback`. Middleware refreshes the session and protects `/app/**`.
- On first signup, send the Welcome email (section 8).

## 4. Six stages (routes under `/app/papers/[paperId]/stage/[n]`)
The six-stage structure is unchanged: intake, stance interview, outline, sources and audio beats, draft, revise and feedback. Only Stage 1's internals change (assignment first). Shared UI: left rail showing stages 1–6 with lock icons; conversational one-question-at-a-time panel; "Continue" disabled until requirements met. Every question answered logs a `session_events` row.

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
- Complete after 3 answered moves + a refined thesis statement (min 15 words) written by the student.

### Stage 3 — Outline
- Student builds their own outline: thesis (prefilled from Stage 2, editable), 3–5 main points, each with the evidence they plan to use. Drag-to-reorder.
- Coach checks structure only (every point has evidence, points tie to thesis) with rule-based feedback. No auto-generated outline.
- **SEARCH (loop step 3), per section:** search terms the student would run (with the reasoning shown, to teach the skill), a cross-reference against the rubric's required styles/sources, and **3–5** leads marked **to verify** with a `rubricRef` (“none appeal” → **Show me 3–5 more** or **I have someone specific**). At 20 AI-researched leads **per paper** the server stops suggesting and the card shows a code-built, ready-to-paste Google query (section + rubric terms + story angle, ≤ 32 words, Copy / Open in Google). The student brings names back (up to 5 at a time), and those are researched in the same 3–5 pattern, uncapped and `to_verify`. The student picks leaders and a style. Outline cards come from the confirmed roadmap and are prefilled from `section_decisions` so the student never re-explains (stage specs 2A.3).
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
  - **pass:** quiet ✓, then auto-advance.
  - **moderate** (debatable interpretation): a light card with the reason, angle questions and “Your call. You're the writer.” Buttons **Keep my angle** / **Adjust it**.
  - **strong** (defies logic or contradicts the assignment's terms, e.g. calling Hitler an objectively moral leader when the paper evaluates leaders against ethical principles): a firm, clearly marked card (“This claim doesn't hold up. We strongly suggest a different angle.”) with the reason, the verbatim assignment term and angle questions. Buttons **Pick a new angle** / **Revise my claim** / **Reframe it** (a critical or cautionary analysis passes) / **Continue anyway**.
  - **No gating anywhere:** Continue anyway always advances; gates and stage completion never read `logic_*`. The flag stays as a small reopenable note plus an optional Stage 6 checklist reminder.
  - **Defaults to pass when unsure:** code downgrades strong below confidence 0.80 or without a verbatim cited term / named contradiction, and moderate below 0.60. Errors, timeouts, guard rejects and rate limits fail open to pass.
  - **Logging:** `logic_check_run`, `logic_*_shown`, the student's choice, and **`logic_strong_continued` for SOP review** (`/admin/sop` Logic checkpoints panel). Columns are `section_decisions.logic_*` in 0008 (or 0009 if 0008 is already applied).
- Complete when **every roadmap section is confirmed**, each section with a citation flag has ≥ 1 verified source card, and the student has written, for ≥ 3 source cards, one sentence in their own words on how they'll use it (stage specs 2A.5 replaces the old "≥ 1 source with ≥ 3 beats" rule).

### Stage 5 — Draft (student writes)
- Student writes or uploads their draft (textarea + .docx/.txt upload; parse .docx with `mammoth`). Save as a new `drafts` version.
- On save: compute metrics, run mismatch check (section 6), show warning if triggered.
- **Paste in the draft editor (Colton, Nov 20, 2026, t46):** paste is always allowed and recorded quietly (`paste` events with counts, per-section `paste_ratio` in `drafts.section_paste_meta`). A single paste of ≥ 80 words (not a .docx/.txt import) shows one inline, dismissible note under the editor, at most **once per session per paper**: “We suggest using your own writing so your tone is better understood and we can serve you better.” It's a suggestion, not a question: no yes/no buttons, no answer recorded, no modal, never blocks. Same rule in the Stage 6 revision editor (stage specs 5.2).
- **Draft feedback pattern (philosophy section 4), per section:** "Here are the {n} ideas we captured for this section based on what you told me. We chose {leader}, we chose {style}. Idea one: {idea note}… Write those ideas in your own words." Idea notes are the student's own words or ≤ 12-word fragments, never finished sentences; transition suggestions are a relationship label plus connective words only; the student mixes freely. Built in code from `section_decisions` (stage specs 5.3 step 2).
- Side panel: their outline, sentence plan, linked excerpts, and "Your raw material" bank for reference, as a map only (INTD600 Phase 5). The student writes every sentence in their own voice. No example sentences and no "write this for me" button anywhere.
- Complete when a draft ≥ 300 words is saved.

### Stage 6 — Revise & feedback
- Show draft vs. intake voice comparison (bar chart: sentence length, grade level, formality) with coaching tips ("your draft sentences average 31 words vs. your natural 14 — try splitting the longest ones").
- **Paste-aware baseline (Colton t44/t45):** the comparison uses the typed-weighted Stage 1 baseline. If fewer than 150 baseline words were typed or spoken, use the short-sample downgrade. If the baseline is more than 60% pasted, show at the very bottom of the comparison the soft note (t46): “Your voice answers were mostly pasted in, which is totally fine. Typed or spoken answers help us understand your voice better, so treat the voice comparison as a lighter read.” No note when there's no baseline, and never a block or a warning while writing.
- Rule-based revision checklist: thesis present in intro, each outline point appears, citations present per citation style, no beat used without student explanation.
- **Citation integrity (INTD600 Phase 6, stage specs item 4):** every in-text citation sits next to the specific claim it supports (linked to a flagged sentence), not piled at the end; same author + same year in author-date styles uses a/b/c suffixes (Smith, 2020a / 2020b) that match the reference list; MLA uses short titles instead. Questions only; the app never inserts citations into the draft.
- **Final assembly and light quality check (INTD600 Phase 7):** the assembled draft plus the checklist, read-aloud pass, and honesty check. Light means: flag errors that change meaning or miss the rubric; never push the student to polish away their natural voice.
- **Light cleanup (philosophy hard limit; stage specs 6.1 item 12):** flag spelling, grammar, and citation-format issues; the student accepts a single-word or citation-format fix or fixes it themselves. Never rephrase.
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
Admin (gate on `profiles.is_admin` — add that boolean column): `/admin/feedback` to review professor-feedback uploads, code praise/flags, grant credits; `/admin/sop` showing session_events aggregates (probe rates per question, drop-off by stage, upsell take rate, mismatch rate, and a Logic checkpoints panel: tier rates, downgrades, fail-opens, and a review list of `logic_strong_continued` / `logic_flag_feedback` events).

## 10. Quality bar
- Vitest unit tests for metrics, mismatch, thin-answer detection, stage gating, webhook idempotency, Stage 1 confirm gate, page-to-word estimate (275), voice-minimum calculator, interest-tag / lead `to_verify` rules, file-cap enforcement, MIME sniff, EXIF GPS strip, URL dedupe, OCR fallback order, the hard-limit guard rules in section 1.1 (one test per row), roadmap `rubricRef` validation, per-section loop completion rules, section-first locking (`assertSectionStepUnlocked`, skip unlocks the next section, Stage 5 locked while any section is skipped, preview writes nothing), 200 / 2×40 voice minimum with skips, 3–5 lead batches and the 20-per-paper cap with the search-prompt builder, outline export allow-list (.docx and PDF canary test), the LOGIC CHECKPOINT (Hitler example → `strong` and the student can still Continue anyway and finish Stage 4; a debatable interpretation → `moderate`; a critical-analysis reframe → `pass`; supportable unpopular opinion never `strong`; downgrade and fail-open rules; no gate reads `logic_*`; plus nightly live-model evals in `evals/logic-checkpoint.jsonl`), draft-feedback idea-note rule, light-cleanup fix rule, the three paste-gate tests (photos-only reaches the checklist, banned string absent, single follow-up), the paste-everywhere tests (d)–(f) (desktop + iOS long-press paste in every intake field, no-`preventDefault` grep with no exceptions, pasted voice sample completes Stage 1), the paste-ratio clamp and typed-weighted baseline, the Stage 5 paste suggestion (≥ 80 words, once per session per paper, no answer controls, no `paste_confirm`; CI grep that the retired Stage 5 question string, built from parts, is absent from app code and from the build specs outside changelog lines), the soft voice-note strings (retired t45 wording absent), `missingImportant`, story-angle guard rules, and a/b/c citation-suffix detection (see the Stage 1 spec and stage specs).
- Accessible (labels, focus states, keyboard nav), mobile-first.
- Loading and error states on every action.
- README with: setup, `supabase db push`, how to run the Stripe webhook locally (`stripe listen --forward-to localhost:3000/api/stripe/webhook`), and deploy notes.
- Do not hardcode any secrets. Use exactly the env var names listed in section 0; do not invent others. Do not add Anthropic or ElevenLabs keys.

Build it end to end now. Start with the migration, env validation, and lib/ utilities with tests, then auth, then stages 1–6, then payments, then email, then admin. Implement Stage 1 from `retainwrite-stage1-intake-spec.md` (that doc wins on Stage 1; migrations `0005_stage1_assignment_first.sql` and `0006_stage1_extract_first.sql`) — do not implement the old four-block intake. **If Stage 1 already exists in the repo, ship the paste-gate fix and the paste-everywhere fix (Stage 1 items 0 and 0b / spec sections 0A and 0A.1) first, before anything else.** After each phase, run typecheck and tests and fix failures before moving on. **Current build order (Nov 20, 2026):** (1) Stage 1 paste-gate fix and paste-everywhere fix (Stage 1 items 0 and 0b), (2) the rest of the Stage 1 rewrite, including DISSECT and migration `0008_section_loop.sql`, (3) **Phase 11 — AI checker landing page at `https://www.retainwrite.com/ai-checker`**, (4) the section-by-section loop and draft/cleanup changes in Stages 2–6 (stage specs 2A, 5.3, 6.1; if Stages 2–6 aren't built yet, build them this way from the start), (5) Phase 12 — blog, (6) Phase 13 — passcodes (may run earlier, after payments and admin). Every phase follows `retainwrite-coaching-philosophy.md`. The checker has its own spec: `retainwrite-ai-checker-spec.md` (that doc wins on checker behavior).

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
  - **When:** only when the baseline actually used has `pastedShare > 0.60` (`VOICE_PASTED_SHARE_NOTE`).
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
- (t45/t46) Paste note: a fully pasted sample → `VOICE_NOTE_SAMPLE` (soft wording) at the bottom of the full report/email/PDF with the headline unchanged; a typed or dictated sample → no note; 0.60 → no note, 0.61 → note; no sample and no profile → N/A and no note; a pasted sample plus a reliable profile → the profile is used, no note; the preview never shows the note; Stage 6 shows the same note under the same rule from Stage 1 answers.
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

- **Nov 20, 2026 (t46)** — Per Colton: the voice-baseline note now uses one consistent soft style (`VOICE_NOTE_SAMPLE` for the public checker's writing sample, `VOICE_NOTE_ANSWERS` for voice answers and Stage 6), retiring the t45 wording. Stage 5 (and the Stage 6 editor): the ≥ 80-word paste modal question is replaced by a supportive, dismissible inline suggestion shown at most once per session per paper, with no answer recorded. Tests and greps added.
- **Nov 20, 2026 (t45)** — AI checker phase: added the bottom-of-report voice-baseline paste note (pasted share > 60%; scoped to the writing sample, voice profile, or Stage 1 answers; dictation counts as typed; no note without a baseline), combined with the typed-weighted baseline, plus its tests. Stage 6 shows the same note from the Stage 1 answers.
- **Nov 20, 2026 (t43/t44)** — Added Stage 1 item **0b**, shipped first with item 0: remove every paste block from every intake input. Colton's t44 removed t43's voice-answer exception, so paste is allowed universally, voice answers included. Added tests (d)–(f), a hard-limits row, and the build-order line. The voice-capture item now says paste is allowed, with the quiet `paste_ratio` and typed-weighted baseline as the Stage 6 mitigation (never blocks or warns). Stage 2 raw-material and checker voice-check lines changed from paste-blocked to paste allowed.
- **Nov 20, 2026 (t41/t42)** — Added Colton's per-section LOGIC CHECKPOINT (after CONFIRM, before ADVANCE; mandatory): tiers pass / moderate / strong, schema, UX, guard row in 1.1, `logic_*` columns, events, tests. Per Colton's t42 change, the t41 hard stop was removed before shipping. Strong is a firm flag with **Continue anyway**, logged as `logic_strong_continued` for SOP review, and nothing in the checkpoint gates. Governing doc is now v1.2.

- **Nov 20, 2026 (t40)** — Applied Colton's answers. Voice minimum is now 200 words across the answers given, skipped answers allowed; 2 × 40 kept; personal-question requirement dropped (constants, Stage 1 item 4, hard-limit table). The loop is section-first with skip, read-only browse-ahead, and a persistent bottom reminder with a jump-back link; rule 2 gained the loop-span exception and `assertSectionStepUnlocked`. Lead sets are 3–5, capped at 20 AI-researched leads per paper, then a ready-to-paste Google search prompt (new constants). The final outline exports to .docx (`docx`) and PDF (`@react-pdf/renderer`) with no AI prose. Counterargument (only when required or argumentative) and light cleanup (one-click for single-word and citation-format fixes) keep their defaults, unconfirmed by Colton.

- **Nov 20, 2026** — Stage 1 is now read-the-upload-first: added the urgent "Remove the paste gate" fix (Stage 1 item 0) with three acceptance tests; immediate per-file extraction; a short confirm checklist with "Not specified" instead of a field-by-field gate; one follow-up question; Pick your story. Added coaching principles (section 1, rule 7), rule 8 (paste is never a gate), and the INTD600 phase-to-stage map (section 1A), with matching notes in Stages 2–6. New additive migration `0006_stage1_extract_first.sql`. No new env vars.
- **Nov 20, 2026 (t38)** — Merged and moved the AI checker phase: former §12 "Free AI checker (after the blog)" is now **§11 "AI checker standalone landing page (`/ai-checker`)"**, run right after the Stage 1 paste-gate fix and rewrite; the blog moved from §11 to §12; passcodes stay §13. The phase states the route and the full URL (`https://www.retainwrite.com/ai-checker`, apex 308 → www), with the optional writing sample and N/A renormalization, the "Signal strength" title and "Your draft reads fine" headline, honest calibration with clean rate monitored (never forced or randomized), email-step account creation with the free first paper, in-memory-only privacy, BotID plus a challenge after 3 checks, SEO, an LCP target, analytics, and acceptance tests. New migration `0007_ai_checker_standalone.sql`. `SITE_URL` changed to `https://www.retainwrite.com`, and a note added that the Stripe webhook must use the www URL. Turnstile env vars are optional and pending owner approval.
- **Nov 20, 2026 (t39)** — Added `retainwrite-coaching-philosophy.md` as THE governing document (it wins on philosophy; the specs hold implementation) and a "Read these first" list at the top. Added rule 9 and section 1.1 mapping each hard limit to guard and prompt rules. Stage 1 now ends with DISSECT (roadmap, `section_plans`); the per-section loop runs PROBE in Stage 2, SEARCH in Stage 3, and SUMMARIZE + CONFIRM in Stage 4 (new completion rule); Stage 5 gets the draft feedback pattern; Stage 6 gets narrow light cleanup. New migration `0008_section_loop.sql`; build order updated.
