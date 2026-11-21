# RetainWrite — Stage Specs & Cross-Stage Decisions (companion to `retainwrite-cursor-build-prompt.md`)

Paste this into Cursor **after** the build prompt. Where this doc conflicts with the build prompt, **this doc wins** (see "Overrides to the build prompt") for Stages 2–6 and cross-stage rules. **Stage 1 intake is specified in `retainwrite-stage1-intake-spec.md`; that doc wins on Stage 1 behavior.** The six-stage structure is unchanged (intake, stance interview, outline, sources and audio beats, draft, revise and feedback); only Stage 1's internals change. Table names, stage order, price constants and existing env var names are unchanged.

LOCKED RULES (hold everywhere): coaching only (the app never writes submission prose: no paragraphs, no thesis, no rewrites; AI produces questions, probes, checklists, feedback, and source summaries for study; the student writes every submitted sentence). Style metrics are for feedback/revision coaching only. Mismatch warnings name specific tells and never use detector-evasion framing. Every stage is gated on real student input. Every session is logged to `session_events`. Add `// SOP: coaching only, never generate submission text` at every AI call site.

---

## 0. Decisions made in this doc

1. Stage 2 uses 8 topic clusters plus a `general` fallback; the student picks, an LLM suggests, and the student's pick wins (the LLM is used only when the student skips and its confidence is ≥ 0.6).
2. Stage 2 runs exactly 3 coach moves per paper (weighted by cluster, 3 distinct types), and the student writes ≥ 30 words in reply to each; up to 2 optional extra moves.
3. Coach question slots ({claim}, {key_term}, {group}, {evidence_type}) are only ever filled with verbatim substrings of the student's own text, enforced in code; otherwise a slot-free fallback phrasing is used.
4. Refined thesis passes only if it meets 5 criteria (arguable, specific scope, reason, survives a counterargument, differs from the original or is defended); max 3 attempts, then the student may advance with a flag (never a hard dead end).
5. Stage 2 text boxes are paste-blocked (like Stage 1 voice-sample answers: interest, coaching, personal, and fallback); Stage 5 allows paste.
6. Stage 3 outline = Intro + N body sections + Counterargument/Rebuttal + Conclusion, with N = 3 (< 1,500 words), 4 (1,500–3,000), 5 (> 3,000); N = 3 if length is unknown.
7. Every outline section holds only student-written notes (claim, evidence notes, explanation note, and a sentence plan of purpose/point notes with citation flags — section 4.2); the coach checks fit with the thesis; drag-to-reorder (with keyboard up/down buttons); the student clicks Approve; later edits are allowed and logged.
8. Stage 5 coaching is not live per keystroke: prompts come before writing a section, "Ask coach" is on request (max 3 per section), and full feedback arrives when a section is submitted.
9. Stage 5 allows paste from Google Docs/Word; every paste is logged with size; pastes ≥ 80 words trigger a non-blocking "Is this your own writing?" check and a style comparison; nothing is ever blocked.
10. Stage 5 per-section gate: topic sentence first, then coaching questions + an evidence checklist from Stage 4 sources + the outline note, then the student writes, then section feedback, then the student marks done. Hard blockers are minimum length and the topic sentence being in the text; everything else is soft and carries to Stage 6.
11. Stage 6 has a 12-item revision checklist plus a final honesty check (items 1–6 auto-checked, 7–10 AI-checked on demand as questions only, 4/11/12 and the honesty check self-checked); completing the stage needs ≥ 1 saved revision (or a written "no changes needed" reason).
12. Professor-feedback credit: grade + 1–3 files + consent checkbox; automated first pass by the strong model; auto-grant only at confidence ≥ 0.85 with all checks passing, otherwise it goes to the admin queue with a 48-hour review target; 1 credit per paper; the credit is a normal paper credit (audio included).
13. Professor feedback is coded into praise/flag across thesis, evidence, organization, citation, voice, mechanics; raw uploads are deleted 90 days after the decision (30 days if rejected); coded, name-stripped data is kept.
14. Mismatch thresholds are a two-level table (tell / strong): a warning fires on 2 tells or 1 strong signal; minimum 120 words; quotes and citations are excluded; all values are starting points to be tuned from logged data.
15. AI: xAI Grok — `MODEL_FAST` = `grok-4.3` for fast live probing/classification and Stage 1 coaching questions; `MODEL_STRONG` = `grok-4.7` for assignment parsing, rubric evaluation, section feedback, source extraction, and feedback coding. TTS is Google Cloud Text-to-Speech Chirp 3 HD (default voice `en-US-Chirp3-HD-Charon`). All of this is coaching content or study summaries, never student prose.
16. Audio beats are 45–90 words each, capped at 6,000 TTS characters per paper; the free paper has no audio; feedback credits and pack papers include audio.
17. Under-13 is not permitted (no account, DOB not stored). Ages 13–17 need a guardian email plus a guardian email-confirmation click before the first paper or upload.
18. Terms/Privacy language is drafted below and marked DRAFT: needs legal review.
19. Refund policy is one line: unused credits within 14 days; used credits and audio add-ons are non-refundable.
20. Email "from" is `RetainWrite Coach <coach@send.retainwrite.com>`; copy is drafted for signup confirmation (with minor variant), guardian consent, audio delivery, and feedback-credit confirmation (plus two short feedback-status emails).
21. New env vars: `GROK_API_KEY`, `GOOGLE_CLOUD_TTS_API_KEY`, `GOOGLE_CLOUD_TTS_VOICE_ID`, `ADMIN_NOTIFY_EMAIL`, `UNPAYWALL_EMAIL`, `CRON_SECRET`, and optional `MISTRAL_OCR_API_KEY` (see section 8). Do not add `ANTHROPIC_API_KEY`, `ELEVENLABS_API_KEY`, or `ELEVENLABS_VOICE_ID`.
22. AI is never a single point of failure: if an AI call fails, rule-based fallbacks keep the student moving and the failure is logged.
23. Stage 1 is assignment-first (upload → parsed Assignment card the student must confirm → skippable get-to-know-you → assignment-grounded coaching, with voice sampled from those typed answers). Full rules are in `retainwrite-stage1-intake-spec.md`. Interest-steered research leads are always "to verify," never citations; Stage 4 drops leads it cannot verify. Updated Nov 20, 2026: uploads are read immediately and pasting is never a gate; the student confirms a short checklist (missing fields become "Not specified"), gets at most one follow-up question, and picks a story angle before the early stance. Stage 2 receives `storyAngle`.
24. (Nov 20, 2026) The owner's INTD600 workflow sets the order of work across the six unchanged stages: Phase 1 → Stage 1; Phase 2 (story options, pick early) → end of Stage 1, carried into Stage 2; Phase 3 (raw-material interview) → Stage 2; Phase 4 (sentence-level outline + citation flags + short excerpts) → Stage 3 sentence plan + Stage 4 excerpts; Phase 5 (student writes every sentence) → Stage 5; Phase 6 (citation integrity, a/b/c suffixes) → Stage 6 item 4; Phase 7 (final assembly + light check) → Stage 6. Principles: the student owns the sentences; personal detail beats generic summary; citations tie to specific claims; slight imperfection is fine (keep the student's natural voice; never framed around AI detectors); decide the story early. Full table in `retainwrite-stage1-intake-spec.md` section 0B.

---

## 1. Overrides to the build prompt (read first)

| Build prompt says | Now |
|---|---|
| `EMAIL_FROM = "RetainWrite <hello@send.retainwrite.com>"` | `EMAIL_FROM = "RetainWrite Coach <coach@send.retainwrite.com>"` |
| "Do not create additional env var names" | Allowed: exactly the new env vars listed in section 8, and no others. The original seven names stay unchanged. |
| Stage 2: refined thesis min 15 words, no rubric | Rubric in section 3. Min 15 / max 60 words. |
| Stage 3: rule-based coach check only | LLM-assisted section checks with a rule-based fallback (section 4). |
| Stage 5: textarea + .docx/.txt upload | One section at a time; .docx/.txt import inserts into the *open section* and is logged as a paste (section 5). Assembled draft saved as `drafts` v1 when all sections are done. |
| Stage 6: rule-based checklist | 12-item checklist (section 6). |
| Mismatch: 1.6x / +4 grade / 0.35 / 12% / 20% | Two-level table (section 7). Same starting values, plus strong levels, minimum length, exclusions. |
| Admin review sets `credit_granted` | Auto first pass, then admin queue (section 6.3). |
| `purchase_kind` = single, pack3, audio | Add `feedback_credit` (migration 0002). |
| Stage 1: 4 blocks (typed assignment fields, background survey, stance, separate 150-word voice sample) | Assignment-first intake in `retainwrite-stage1-intake-spec.md` (migration 0005). That doc wins on Stage 1. Old Block 3 stance becomes the early-take coaching question; voice is embedded in intake answers (250-word floor). The six-stage structure is unchanged. |

### Migration `supabase/migrations/0002_specs.sql` (additive; RLS on anything new, same `auth.uid() = user_id` pattern)
```sql
-- enum value must be added in its own statement/transaction before use
alter type purchase_kind add value if not exists 'feedback_credit';

create type guardian_status as enum ('not_required','pending','granted','expired');
create type feedback_status as enum ('processing','auto_approved','needs_review','approved','rejected','needs_better_upload');

alter table profiles
  add column birth_date date,
  add column is_admin boolean not null default false,
  add column terms_accepted_at timestamptz,
  add column guardian_email text,
  add column guardian_status guardian_status not null default 'not_required',
  add column guardian_token_hash text,          -- sha256 of a random 32-byte token; token itself only in the email link
  add column guardian_requested_at timestamptz,
  add column guardian_consented_at timestamptz;

alter table professor_feedback
  add column status feedback_status not null default 'processing',
  add column file_paths jsonb not null default '[]',      -- up to 3 storage paths; storage_path = first
  add column file_hashes jsonb not null default '[]',     -- sha256 hex per file
  add column auto_check jsonb not null default '{}',      -- LLM first-pass result (section 6.3)
  add column attempts int not null default 1,
  add column reviewed_by uuid references auth.users,
  add column reviewed_at timestamptz,
  add column review_note text,
  add column raw_delete_after timestamptz,
  add column raw_deleted_at timestamptz;
create index on professor_feedback using gin (file_hashes jsonb_path_ops);
```
Notes:
- Stage data (cluster, moves, thesis attempts, outline, sections, checklist state) lives in `stage_progress.data` as typed JSON (shapes below); validate with Zod on every write. No new tables.
- Dedupe: before accepting an upload, query `file_hashes @> '"<sha>"'` for any other row; if found, reject with "This file has already been used for a credit."
- `drafts`: version 1 = assembled Stage 5 draft; each Stage 6 save = next version. `drafts.metrics` / `mismatch` as in the build prompt.
- Credit grant RPC `grant_feedback_credit(feedback_id uuid)` (security definer, service role only), one transaction: `update professor_feedback set credit_granted=true ... where id=$1 and credit_granted=false returning user_id, paper_id`; if a row returned then `update profiles set paper_credits = paper_credits + 1` and `insert into purchases (user_id, paper_id, kind, amount_cents, status) values (.., 'feedback_credit', 0, 'paid')`. Idempotent.
- New `session_events.event` names: `cluster_selected`, `move_shown`, `move_answered`, `thesis_attempt`, `thesis_flag_advanced`, `outline_section_checked`, `outline_approved`, `outline_edited`, `section_topic_submitted`, `coach_asked`, `section_feedback`, `section_done`, `paste`, `paste_confirm`, `mismatch_warned`, `mismatch_response`, `checklist_item`, `revision_saved`, `feedback_submitted`, `feedback_auto_granted`, `feedback_queued`, `feedback_reviewed`, `audio_generated`, `guardian_requested`, `guardian_granted`, `ai_fallback`, `email_failed`.
- Stage 1 session event names (assignment parse/confirm, interest, leads, voice) are listed in `retainwrite-stage1-intake-spec.md` section 13. Do not put interest prose or assignment full text in `session_events.detail`.

---

## 2. Cross-cutting behavior (applies to Stages 2–6)

- **Thin-answer handling** reuses `lib/coaching/thin.ts` (max 2 probes, then "I'm stuck — flag for help" saves and lets the student continue, as in the build prompt).
- **AI output guard** (`lib/ai/guard.ts`): every coaching call returns Zod-validated JSON with length-capped fields (questions ≤ 35 words each, max 3 per response, feedback bullets ≤ 40 words). Reject and retry once (then fall back) if output contains rewrite-style phrases ("here is a revised", "you could write", "try this:", "for example, write") or any sentence of ≥ 12 consecutive words copied from the student's text *with edits* (quoting the student verbatim in quotation marks is allowed). System prompts for every call state: "You are a writing coach. Never write, rewrite, or complete sentences or paragraphs for the student. Ask questions, point to what is present or missing, and stop."
- **AI fallback**: on timeout (8 s `MODEL_FAST`, 30 s `MODEL_STRONG`) or error, log `ai_fallback` and use the rule-based path (lexical overlap with thesis keywords, non-empty checks, scripted probes). The student is never blocked by an AI outage; flagged items show "Coach check unavailable — we'll recheck later" and are re-run when the student next opens the stage.
- **Student data in prompts**: send only the fields needed for the call; never send email/name. Cache static system prompts.
- **Paste policy by place**: Stage 1 voice-sample answers (get-to-know-you, assignment-grounded coaching, the personal question, and any fallback) and Stage 2 text boxes block paste/drop (`onPaste`/`onDrop` preventDefault + note "we need your own typing here"). Assignment upload/paste is allowed (teacher text). Stages 3 and 5: paste allowed and logged.

---

## 3. STAGE 2 — Stance interview

### 3.1 Topic clustering
Fixed clusters (`lib/coaching/clusters.ts`):

`policy_ethics`, `literary_analysis`, `historical_causation`, `science_empirical`, `social_issue`, `business_econ`, `compare_contrast`, `personal_reflective`, plus fallback `general`.

Method:
1. On Stage 2 entry, `MODEL_FAST` classifies Stage 1 inputs (confirmed assignment prompt and course, plus the student's Stage 1 early stance) into `{cluster, confidence 0–1}` (constrained to the enum). Log `cluster_selected` with `source`.
2. Show the student a picker: 8 cards, one-line descriptions (e.g. "Literary analysis — arguing what a text means or how it works"), the suggested card pre-highlighted only if confidence ≥ 0.6, copy "We think this fits — change it if not."
3. Student's choice always wins. If they choose "Not sure": use the LLM cluster if confidence ≥ 0.6, else `general` (all move weights = 2).
4. Store `cluster`, `cluster_source` (`student` | `llm` | `fallback`), `cluster_confidence`.

### 3.2 Move bank (`lib/coaching/moves.ts`)
Slots are filled from the student's Stage 1 early stance (and refined later from earlier answers). **Slot fill rule:** `MODEL_FAST` extracts candidates `{claim, key_term, group, evidence_type}` as *verbatim substrings* of the student's text; code verifies each is a case-insensitive substring of the source text (claim ≤ 25 words; trim to the main clause if longer). A slot that fails verification is dropped, and the phrasing whose slots all verified is used; if none, use `fallback`. The coach never paraphrases the student. `{claim}` falls back to the student's whole Stage 1 early stance (first sentence).

**1. `alternative_explanation`** — Offers a different cause or reason for the same outcome the student is explaining.
- Use when: the claim asserts a cause, effect, or interpretation.
- Phrasings:
  - "You wrote: “{claim}”. What else, besides your reason, could explain {key_term}?"
  - "If someone thought something other than your reason was behind {key_term}, what would they point to?"
  - "Suppose your main reason isn't the whole story. What else might be going on, and how would you tell the difference?"
- Fallback: "What's another explanation for what you're describing, and how would you tell it apart from yours?"

**2. `scope_limit`** — Tests where the claim stops being true: cases, times, groups, conditions.
- Use when: the claim is broad or uses absolutes (always, never, all, everyone, nobody, must).
- Phrasings:
  - "You wrote: “{claim}”. Is there a situation, time, or group where this stops being true?"
  - "How far does “{key_term}” stretch in your claim? What's one case at the edge where you'd hesitate?"
  - "If you had to add one “unless” or “except when” to your claim, what would it be?"
- Fallback: "Where would your claim stop being true? Name one case at the edge."

**3. `conflicting_evidence`** — Makes the student face a fact, source, or example that cuts against the claim.
- Use when: the claim leans on evidence (empirical, historical, textual).
- Phrasings:
  - "What's the strongest piece of evidence you know (or can imagine) that cuts against “{claim}”? How would you deal with it?"
  - "Say your professor points to a source that disagrees with you about {key_term}. What would it say, and what's your response?"
  - "Which part of your {evidence_type} is weakest for your claim, and what would you need to strengthen it?"
- Fallback: "What evidence would a skeptic bring against your claim, and how would you respond?"

**4. `opposing_stakeholder`** — Argues from the view of a person or group who would be affected or unconvinced.
- Use when: the claim affects people, institutions, or choices.
- Phrasings:
  - "Picture {group} reading “{claim}”. What would they object to first?"
  - "Who loses something, or has to change, if you're right? How would they answer you?"
  - "If {group} had five minutes to respond to you, what's their best point, in their words?"
- Fallback: "Think of someone with a real stake in this who disagrees with you. What would they say?"

**5. `definition_challenge`** — Questions what a key term means; a different definition could change the conclusion.
- Use when: the claim hinges on an abstract or contested word (fair, effective, justice, harm, success, art, etc.).
- Phrasings:
  - "What exactly do you mean by “{key_term}” in your claim? How might someone define it differently?"
  - "If “{key_term}” meant something narrower (or broader) than you intend, would your claim still hold?"
  - "How would we test whether something counts as {key_term} or not?"
- Fallback: "Pick the most important word in your claim. What exactly do you mean by it?"

### 3.3 Cluster weights and selection
Weights 0–3 (higher = more likely to be chosen):

| Cluster | alt_explanation | scope_limit | conflicting_evidence | opposing_stakeholder | definition_challenge |
|---|---|---|---|---|---|
| policy_ethics | 1 | 2 | 2 | 3 | 3 |
| literary_analysis | 3 | 1 | 2 | 1 | 3 |
| historical_causation | 3 | 2 | 3 | 2 | 1 |
| science_empirical | 3 | 2 | 3 | 1 | 2 |
| social_issue | 2 | 2 | 2 | 3 | 2 |
| business_econ | 3 | 2 | 2 | 3 | 1 |
| compare_contrast | 1 | 3 | 2 | 1 | 3 |
| personal_reflective | 3 | 2 | 1 | 2 | 2 |
| general | 2 | 2 | 2 | 2 | 2 |

Selection algorithm (`pickMoves(cluster, stanceText, paperId)`):
1. Pool = types with weight > 0. If the stance contains an absolute word (`always|never|all|every|everyone|nobody|no one|must`), force `scope_limit` into the set.
2. Fill remaining slots by weighted random sampling without replacement (seeded by `paperId` so reloads are stable), 3 distinct types total.
3. Guarantee at least one weight-3 type (resample if not).
4. Phrasing variant (1 of 3): chosen by seeded random; use the first variant whose slots verify, else fallback.

### 3.4 Flow
1. Cluster step (above).
2. **Moves (exactly 3 required).** One at a time: show the challenge, a short note ("Answer in your own words; there's no right answer, we're looking for your thinking"), paste-blocked textarea, min **30 words**, soft max 200.
3. After each reply `MODEL_FAST` returns `{engaged: bool, specific: bool, reflection, follow_up}`:
   - `reflection` = one line quoting a short phrase the student wrote ("You said “{their phrase}”; that's a real tension."), ≤ 25 words, never new argument content.
   - If `engaged=false` or `specific=false` → show `follow_up` (one question ≤ 30 words) as a probe; max 2 probes per move, then "I'm stuck — flag for help" (build prompt rule).
   - Log `move_shown` / `move_answered` with `{move_type, phrasing_id, slot_fill_ok, words, probes}`.
4. **Optional extras:** after 3 moves, button "Try another challenge" (max 2 more, same flow). Not required.
5. **Refined thesis** (3.5), then complete.

**Raw material (INTD600 Phase 3).** Stage 2 is the structured interview for raw material in the student's natural language. The header shows the Stage 1 `storyAngle` ("Your story: …"). When `specific=false`, the follow-up asks for a concrete detail (a person, moment, place, or number from their own experience) rather than a generic summary. On each answered move, save up to 3 short **verbatim** phrases the student wrote (substring-checked in code, ≤ 30 words each) to `rawMaterial`, plus the same from Stage 1 coaching answers. This "Your raw material" bank is shown read-only in the Stage 3 and Stage 5 sidebars. It's the student's own words only; the AI never adds to it.

Stage 2 data shape:
```ts
type Stage2Data = {
  cluster: ClusterId; clusterSource: 'student'|'llm'|'fallback'; clusterConfidence: number;
  storyAngle: { text: string; source: 'ai'|'student' }; // Stage 1 pick (INTD600 Phase 2), snapshot
  originalThesis: string;                      // Stage 1 early stance, snapshot
  rawMaterial: { phrase: string; from: 'stage1'|'stage2'; answerId: string }[]; // verbatim student phrases (≤ 30 words each), no AI text
  moves: { type: MoveType; phrasingId: string; prompt: string; slots: Record<string,string>;
           response: string; probes: string[]; flaggedStuck: boolean }[];
  thesisAttempts: { text: string; rubric: RubricResult; at: string }[];
  refinedThesis?: string; thesisFlag?: { advancedUnmet: CriterionId[] };
  defendedOriginal?: string;
};
```

### 3.5 "Good enough" refined thesis
Student writes the refined thesis in a paste-blocked textarea with the prompt: "Now, in one or two sentences, write the claim you'd defend after thinking through those challenges."

**Deterministic checks (code, before any AI call):** 15–60 words; ≤ 2 sentences; not identical to an earlier attempt.

**Rubric (`evaluateThesis`, `MODEL_STRONG`, Zod-validated, each `{pass: boolean, reason ≤ 25 words, probe ≤ 30 words}`):**

| ID | Criterion | Pass when |
|---|---|---|
| C1 `arguable` | Arguable claim | A reasonable person could disagree; it is not a fact, a topic, or a question. |
| C2 `scope` | Specific scope | Names who/what/where/when/which texts or cases; no unlimited terms ("society", "everything") without narrowing. |
| C3 `reason` | Reason stated | Contains a *because*-type reason (because, since, by, through, due to, or an equivalent clause). |
| C4 `counter` | Survives a counterargument | Acknowledges, qualifies, or is visibly narrowed by at least one of the student's 3 move responses (e.g. although/while/unless/even though, or a scope that reflects a move answer). |
| C5 `changed` | Differs from original | Content-word Jaccard similarity with `originalThesis` < 0.80 **or** the student writes ≥ 40 words defending keeping it (shown as an optional "I'm keeping my thesis — here's why" box, saved to `defendedOriginal`). |

**Pass:** deterministic checks + all five criteria pass. The student writes every word; the LLM never proposes wording. The probe for a failed criterion is a question only (e.g. C2: "Who or what exactly does your claim cover? Where would you draw the line?").

**On fail:** show up to 2 failing criteria at a time (lowest ID first) with their probe; student revises and resubmits. Log `thesis_attempt` each time with the rubric result.

**Max attempts:** 3. After attempt 3 with any unmet criterion, show "You can move on and keep working on this." The student may advance; save `thesisFlag.advancedUnmet = [ids]`, set `refinedThesis` to the latest attempt, log `thesis_flag_advanced`. Consequences: Stage 3 shows a banner "Your thesis still needs work on: {criteria in plain words}"; Stage 6 "thesis clarity" becomes a required self-check with a note. Never a dead end.

**Stage 2 complete when:** cluster set, 3 moves answered (or flagged stuck), and a refined thesis saved (passed or flagged-advance).

---

## 4. STAGE 3 — Outline

### 4.1 Structure
Target length: prefer the confirmed Stage 1 assignment card (`assignments.requirements.length` — explicit words if present, otherwise the page-derived estimate at 275 words per double-spaced page; ranges use the midpoint). If the card is missing or marked "Not specified," fall back to parsing `papers.required_length` (`/(\d[\d,]*)\s*(words?|pages?)/i`; same 275 and midpoint rules). If still unparseable, ask the student for a number of words or pages in a small inline field; default 1,000 words.

| Target words | Body sections (N) |
|---|---|
| < 1,500 | 3 |
| 1,500–3,000 | 4 |
| > 3,000 | 5 |

Outline = **Intro** + **Body 1…N** + **Counterargument & Rebuttal** + **Conclusion** (N + 3 cards). Intro is fixed first, Conclusion fixed last; Body cards and the Counterargument card can be reordered between them. The student may remove one body card only if N > 3 (floor of 3 body cards).

### 4.2 What each card contains (all student-written; AI writes none of it)
- **Intro:** hook idea note (≥ 5 words, a note on *how* they'll open, not the sentence); **thesis** (read-only copy of Stage 2 `refinedThesis`; "Revise thesis" link opens an edit that logs `outline_edited` and re-runs the thesis rubric as advisory).
- **Body (each):** `claim` (one sentence, 8–40 words, student-typed); `evidenceNotes[]` (≥ 1, up to 4; each ≥ 5 words, e.g. "Chapter 3 stats on turnout"; optional `sourceId` linkable later in Stage 4/5); `explanationNote` (≥ 10 words: "why this evidence proves the claim").
- **Counterargument & Rebuttal:** shows the student's three Stage 2 move responses as a read-only reference; student chooses which counterargument they'll address (select) and writes `counterNote` (≥ 10 words: what the objection is, in their words) and `rebuttalNote` (≥ 15 words: how they'll respond).
- **Conclusion:** `soWhatNote` (≥ 10 words: what the reader should take away beyond repeating the thesis).
- **Sentence plan (INTD600 Phase 4; every Body card, optional on Intro / Counter / Conclusion):** 2–8 rows, one per planned sentence, in order. Each row: `role` (fixed enum: `claim`, `evidence`, `personal_example`, `explanation`, `link_to_thesis`, `transition`); `purposeNote` (student-written, 3–25 words, *what this sentence will do or say*, not the sentence itself); `needsCitation` (boolean; required true on `evidence` rows); optional `sourceId` / `beatId` filled in Stage 4. The coach may suggest a role sequence for a card (structure only, from the enum); it never writes a `purposeNote`. Guard rejects any `purposeNote` suggestion. Paste allowed and logged, as for the rest of Stage 3.

Stage 3 data: `{ targetWords, sections: [{id, kind:'intro'|'body'|'counter'|'conclusion', order, claim?, evidenceNotes?, explanationNote?, sentencePlan?: {id, role, purposeNote, needsCitation, sourceId?, beatId?}[], ...}], approvedAt?, version }`.

**Stage 4 link-up.** In Stage 4, every `needsCitation` row is matched to a verified source and one short excerpt (the beat `passage`, ≤ 2 sentences of quoted source text with page/location). Unverified Stage 1 leads are dropped, never attached. Rows with no verified source yet show "needs a source" and carry to Stage 5 and Stage 6 as a soft flag.

### 4.3 Coach checks and the approval gate
- **Per-card check** (button "Check this section", also auto-run once when a card first becomes complete). `MODEL_FAST` returns `{supportsThesis: 'yes'|'partly'|'no', question ≤ 30 words}`. Rule-based fallback: content-word overlap between the card text and thesis keywords (≥ 2 shared stems → 'partly', ≥ 4 → 'yes').
  - `yes`: green check. `partly`: amber, shows the question, allowed.
  - `no`: red; the student must either revise the card or write a ≥ 20-word "How this connects to my thesis" reply (saved on the card) before approval.
- **Approve button enabled only when:** no empty/under-minimum field in any card; every Body card has a sentence plan of ≥ 2 rows with every `evidence` row flagged `needsCitation`; every card has been checked at least once with no unresolved `no`; at least 3 body cards; order is valid (Intro first, Conclusion last).
- On click: confirm dialog "Approve this outline? You can still edit it later, and edits are logged." Then run one `MODEL_STRONG` whole-outline pass for *questions only* ({gaps: string[] ≤ 3}), shown on the Stage 4 sidebar (not blocking). Save `approvedAt`, snapshot as `outline_v1`, log `outline_approved`, mark Stage 3 complete.
- **Later edits** (Stages 4–6): outline stays editable via an "Edit outline" drawer. Opening requires a reason (≥ 5 words, e.g. "added a new source"); every save logs `outline_edited` with before/after of changed fields and bumps `version`; changed cards are re-checked. Stage 3 stays complete.

### 4.4 On-screen layout
- **Left rail:** shared stage rail (build prompt). Under Stage 3: progress bar "n of N+3 sections ready" and per-card status dots.
- **Header strip (sticky):** pinned thesis in a bordered box ("Your thesis"), with word count and the target length ("~1,200 words → 3 body sections").
- **Main column:** vertical stack of draggable cards with drag handle, kind label, completion dot, collapsible fields, per-card "Check this section" button and the coach's one-line result. Reordering via drag (dnd-kit with keyboard sensor) plus ▲/▼ buttons for accessibility/mobile; Intro and Conclusion show a lock icon.
- **Right sidebar (desktop; bottom sheet on mobile):** "Coach notes" (latest check questions), the Stage 2 counterarguments for reference, and a checklist of approval requirements with live ✓/✗.
- **Footer:** "Approve outline" button disabled with the reason shown beneath ("2 sections need an evidence note").

---

## 5. STAGE 5 — Draft

### 5.1 Coaching timing (decision)
No keystroke-level or auto-triggered mid-sentence coaching. Coaching happens (a) **before** a section (prompts + evidence checklist), (b) **on request** (button "Ask the coach", max 3 per section, `MODEL_FAST`, returns up to 2 *questions* about what's on the page, rate-limited 1 per 60 s), and (c) **on section submit** (full feedback). This keeps the student generating the writing (generation effect), keeps latency/cost low, and avoids the feeling of being edited while drafting.

### 5.2 Paste policy (decision)
- **Allowed:** pasting from Google Docs/Word and .docx/.txt import (import inserts into the open section only, logged as a paste).
- **Logged:** each paste → `session_events` `paste` `{section_id, chars, words, source:'paste'|'import'}`; the client tracks pasted spans (offsets) in the section state so they can be evaluated separately.
- **Threshold:** a single paste ≥ **80 words** shows a non-blocking modal: "You pasted {n} words. Quick check: is this your own writing?" Options: **"Yes, I wrote this"**, **"Partly — I'll rework it"**, **"It's from a source — I'll quote and cite it."** Choice logged as `paste_confirm`. The third option adds a reminder: "Put quotation marks around it and add the citation in {citation_style}." Then: if the pasted span is ≥ 120 words, run the style comparison on it (section 7) and show the standard warning in-panel if it trips (non-blocking); smaller pastes are evaluated with the section at submit.
- **Never** blocks or accuses; never shows the word "detector". Stage 1 voice-sample answers stay paste-blocked.

### 5.3 Per-section gate (sequential in outline order)
Sections unlock in outline order; Conclusion unlocks after all others are done. Done sections can be reopened (a new revision of that section, feedback re-runs).

1. **Topic sentence first.** The section shows the outline card (claim, evidence notes, explanation note: *the student's own notes, never generated text*). A single-line input: "Write the first sentence of this section." Min 8 words, max 45. `MODEL_FAST` checks `{relatesToClaim: bool, probe}` (fallback: lexical overlap with the card's claim). If not related: probe, max 2, then "I'm stuck — flag" lets them continue. Log `section_topic_submitted`.
2. **Coach prompts** (`MODEL_FAST`, generated once per section): up to 3 *questions* tied to the card ("Which of your evidence notes will you lead with, and what do you want the reader to notice?"), plus:
   - an **evidence checklist** built in code from Stage 4: the evidence notes from the card; any sources linked to them; for each, the source title and the beat's short passage (≤ 2 sentences, it is quoted source text) plus the student's own "how I'll use it" sentence from Stage 4. Checkboxes are for the student's own tracking.
   - a reminder: the student's `explanationNote` verbatim.
   - the card's **sentence plan** as a map (roles + the student's own purpose notes + citation flags, each flag showing its linked Stage 4 excerpt or "needs a source"), plus the "Your raw material" bank. The student writes every sentence; the plan is not text to copy.
   - **No paragraph text, no example sentences.**
3. **Body textarea unlocks** below the locked topic sentence (editable later). Student writes. Autosave every 5 s to `stage_progress.data.sections[id].text` (no AI call on autosave). Live word counter against the minimum.
4. **Minimum length per section:** `min = clamp(round(0.5 × targetWords / (N + 3)), 60, 200)` words (e.g. 1,200 target, 3 body → 100 words). Intro/conclusion use `max(60, 0.75 × min)`.
5. **Submit section** → feedback (`MODEL_STRONG`, ~30 s budget; skeleton loader). Output (Zod): 
   ```ts
   { supportsThesis: 'yes'|'partly'|'no';
     evidenceUsed: { note: string; present: boolean }[];   // one per outline evidence note
     explanationPresent: boolean;
     questions: string[];   // ≤ 3, coach questions only
     praise: string[];      // ≤ 2, specific ("Your second sentence names the study clearly.")
     styleCheck: MismatchResult }  // computed in code, section 7
   ```
   Show as a card: "What's working", "Questions to think about", "Evidence you planned vs. used", style note (amber, if tripped).
6. **Student marks done.** Enabled when: (hard) section ≥ minimum words, the locked topic sentence is still the first sentence of the text, and feedback was viewed. (Soft; never blocking) anything feedback flagged; flagged items are copied into `stage_progress.data.carryFlags` for Stage 6. If `evidenceUsed` shows 0 present on a body section, the student must write a ≥ 15-word "Why I haven't used evidence yet" note (saved, carried to Stage 6) before marking done.
7. **Unlock next section.**

**Stage 5 complete when:** every section is done and the assembled draft is ≥ 300 words. On completion: assemble sections in order (blank line between; no generated connective text), compute metrics, run mismatch on the whole draft, save `drafts` version 1, log `stage_completed`.

Side panel (all sections): outline (collapsible), Stage 4 beats, thesis pinned. No "write this for me" control anywhere.

---

## 6. STAGE 6 — Revise & professor feedback

### 6.1 Revision checklist (student-facing)
Header: "Revise it in your own words. Each item is checked by you, by the app, or both." This is the final assembly and **light** quality check (INTD600 Phase 7): items point out what's missing or unclear and never coach the student to polish away their natural voice (slight imperfection is fine; the reason is authenticity, never AI detectors). Items:

| # | Item | Check type | How it works | Resolved when |
|---|---|---|---|---|
| 1 | Thesis is present in the intro | Auto | Content-word overlap (≥ 60% of refined thesis stems) in the intro section | Pass, or student note ≥ 10 words |
| 2 | Every outline section appears | Auto | Section keys preserved in the assembled draft, each ≥ its minimum words | Pass |
| 3 | Planned evidence appears | Auto | Each outline evidence note has stem overlap ≥ 2 content words somewhere in its section | Pass, or note ≥ 10 words for misses |
| 4 | Citation integrity (INTD600 Phase 6): present, formatted for {citation_style}, tied to claims, disambiguated | Auto + self | Regex check: in-text pattern count (APA `(Author, 2020)`, MLA `(Author 12)`, Chicago footnote markers or author-date), and a "References/Works Cited/Bibliography" heading exists. Plus: (a) **tied to claims** — each Stage 3 `needsCitation` row's section contains an in-text citation, and citations are not clustered only in the final paragraph/sentences of the draft (flag if > 50% of in-text citations fall in the last 10% of the text); (b) **a/b/c suffixes** — in author-date styles (APA, Harvard, Chicago author-date), if the reference list has two or more works by the same author(s) in the same year, in-text citations and references must use matching suffixes (2020a, 2020b); in MLA, same-author works must use short titles. Shown as questions ("Which claim does this citation support?"); the app never inserts or rewrites citations. Student confirms formatting by hand | Auto pass (or a ≥ 10-word note per miss) + self tick |
| 5 | Voice matches your sample | Auto | Mismatch check on the whole draft (section 7); shows the warning with specific tells and the per-section hot spots | No warning, or student ticks "I reworked these" / "I've reviewed this and it's my writing" with a ≥ 10-word note |
| 6 | Length meets the assignment | Auto | Word count vs. parsed target (±15%) | Pass or note |
| 7 | Thesis is clear and arguable | AI (`MODEL_STRONG`, on demand) | Re-runs the rubric C1–C3 as questions | Student marks "reviewed"; required self-check with note if Stage 2 thesis was flag-advanced |
| 8 | Each paragraph ties back to the thesis | AI (`MODEL_STRONG`) | Per-section `supportsThesis` on the full draft; lists weak sections as questions | Student marks reviewed |
| 9 | The counterargument is addressed | AI (`MODEL_STRONG`) | Detects whether the counterargument section engages the chosen Stage 2 objection | Student marks reviewed |
| 10 | Transitions between sections | AI (`MODEL_FAST`) | Looks only at the last/first sentences at each boundary and asks questions ("How does the end of section 2 lead into section 3?") | Student marks reviewed |
| 11 | Conclusion does more than repeat the intro | Self + AI hint | Content-word overlap between conclusion and intro; if > 70% shows a nudge question; student ticks | Student ticks |
| 12 | Mechanics read-aloud pass | Self | "Read my draft aloud" button uses the browser `speechSynthesis` API (no cost); student ticks "I read it aloud and fixed what sounded wrong" | Student ticks |

Plus one **always-required self-check** (no auto): "I wrote and can explain every sentence of this draft." Counts as item 13 in UI ("Final honesty check") but is purely a student statement logged as `checklist_item`.

**Auto-checked:** 1, 2, 3, 4 (format detection), 5, 6. **AI-checked on demand ("Run coach check"):** 7, 8, 9, 10 (questions only; no rewrites). **Self-checked:** 4 (final format confirmation), 11, 12, final honesty check.

**Saving revisions:** the student edits the full draft in a single editor (paste allowed, same paste rules/logging as Stage 5). "Save revision" creates the next `drafts` version, recomputes metrics, reruns mismatch and auto checks, shows the voice comparison chart and tips (build prompt). Log `revision_saved` with metric deltas.

**Stage 6 complete ("Mark paper complete") when:** all 6 auto items are resolved; items 7–10 have been run at least once and marked reviewed; items 11, 12 and the honesty check ticked; and at least one revision version (v2+) was saved **or** the student wrote a ≥ 15-word "Why I'm not changing anything" note. Then send `PaperComplete` email (with the feedback-credit offer) and show the feedback card (6.2).

### 6.2 Professor feedback → free credit: student flow
Available once the paper is complete (`papers.current_stage = 6` and Stage 6 `complete`) and no *approved* `professor_feedback` row exists for that `paper_id` (one credit per paper; a `rejected`/`needs_better_upload` row allows resubmit, max 2 attempts, via `attempts`).

1. Prompt (dashboard card + Stage 6 + PaperComplete email): "Got your grade back? Upload it and earn 1 free paper credit."
2. Form on `/app/papers/[id]/feedback`:
   - **Grade** (required text, 1–20 chars, e.g. "88/100", "B+").
   - **Upload 1–3 files** (JPG/PNG/HEIC/PDF, ≤ 10 MB each): photo of the graded paper, a screenshot or PDF of the LMS (Canvas/Blackboard/Google Classroom) feedback page, or a PDF export. Must show the grade or the instructor's comments.
   - **Redaction note:** "Before uploading, cover up your name, student ID, and any classmates' information. You can keep your professor's comments and grade visible." (Checkbox: "I've covered personal details I don't want us to store.") A name-redacted upload is fully acceptable.
   - **Consent checkbox (required, exact text):** "I choose to share my grade and my instructor's feedback on this paper with RetainWrite. RetainWrite will use it only to issue my credit and to improve its coaching, will not share it with my school or instructor, and will delete the original upload within 90 days of review. I understand I can ask for my uploads to be deleted at any time."
   - Submit → files stored in `feedback` bucket at `${user_id}/${paper_id}/${uuid}.${ext}`; `professor_feedback` row with `consent_given=true`, `status='processing'`, `file_paths`, `file_hashes`, `raw_delete_after = now() + 90 days` (set at decision time, see 6.4).
3. Student sees a status card: Processing → "Approved — credit added" / "Under review (we review within 48 hours)" / "Needs another look: {reason}".

### 6.3 Review: automated first pass, then admin queue
1. **Pre-checks (code):** dedupe by hash (reject if any hash exists on another row), file type/size, paper is complete, no prior approved row for this paper, consent true.
2. **LLM first pass** (`evaluateFeedbackUpload`, `MODEL_STRONG` with image input and extracted PDF text), saved to `auto_check`:
   ```ts
   { looksLikeInstructorFeedback: boolean;   // handwritten/typed comments, rubric, or LMS feedback view
     hasGradeOrComments: boolean; visibleGrade: string|null; gradeMatchesEntered: boolean|null;
     matchesPaper: { score: number /*0-1*/; titleOrTopicEvidence: string };   // compared with papers.title, assignment_prompt, thesis keywords
     concerns: string[];                      // edited/forged look, template/blank rubric, unrelated document, stock image
     containsOtherStudentsInfo: boolean;
     confidence: number;                      // 0-1 overall that this is genuine feedback on this paper
     coded: { praise: Quote[]; flags: Quote[] } }  // see 6.5
   ```
3. **Auto-grant** only if ALL: `looksLikeInstructorFeedback` and `hasGradeOrComments`; `matchesPaper.score ≥ 0.70`; `gradeMatchesEntered !== false`; `concerns.length === 0`; `confidence ≥ 0.85`; and the user has ≤ 2 auto-grants in the last 30 days. Then `status='auto_approved'`, call `grant_feedback_credit`, log `feedback_auto_granted`, send `FeedbackCreditGranted`.
4. **Else** `status='needs_review'`, log `feedback_queued`, email `ADMIN_NOTIFY_EMAIL` (plain notification with a link to `/admin/feedback`), and email the student `FeedbackUnderReview`.
5. **Admin page `/admin/feedback`** (admin = `profiles.is_admin`; Colton): queue sorted oldest first with a **48-hour SLA badge** (amber at 36 h, red at 48 h); shows files via 15-minute signed URLs, entered grade, paper title/prompt/thesis, the auto-check result and its coded comments (editable). Actions: **Approve** (grants credit, sends `FeedbackCreditGranted`), **Reject** (required reason ≥ 5 words; sends `FeedbackNeedsAnotherLook`, status `rejected`), **Ask for better upload** (reason; status `needs_better_upload`). Sets `reviewed_by`, `reviewed_at`, `review_note`, logs `feedback_reviewed`.
6. A daily cron (section 8) re-emails Colton for any item past 36 h in the queue.

### 6.4 Credit and retention
- Credit = +1 `profiles.paper_credits`, plus `purchases` row `kind='feedback_credit'`, `amount_cents=0`, `status='paid'`. It is a normal paper credit: consumption follows the build prompt (new paper consumes 1 credit, sets `funded_by='pack3'`, `audio_unlocked=true`), so **feedback credits include audio**. Credits never expire. Show in `/app/billing` history as "Feedback credit".
- **Retention (decision):** original uploads are deleted from the `feedback` bucket **90 days after the decision** (`approved`/`auto_approved`), **30 days after a rejection**; set `raw_delete_after` at decision time; the daily cron deletes objects, sets `raw_deleted_at`, and empties `file_paths`. **Kept:** the coded JSON (quotes ≤ 200 chars each, names stripped), the normalized grade, and category counts. At coding time also write an anonymized `session_events` row (`user_id` null, event `feedback_coded_anon`, detail = category counts + grade bucket) so aggregates survive account deletion. Account deletion cascades `professor_feedback` rows and removes bucket objects.
- Coded data feeds only coaching analytics and `/admin/sop`; it is never shared outside RetainWrite and never used to generate student text. (Optional later: use a student's own past flags to emphasize a matching Stage 6 check on their next paper.)

### 6.5 Comment coding
Schema stored in `professor_feedback.coded`:
```ts
{ gradeNormalized: number|null;             // 0–100 when computable, else null
  praise: { category: Cat; quote: string }[];
  flags:  { category: Cat; quote: string; severity: 'minor'|'major' }[];
  summary: string }                          // ≤ 40 words, neutral
type Cat = 'thesis'|'evidence'|'organization'|'citation'|'voice'|'mechanics';
```
Rules for the coding prompt: assign every distinct instructor comment to exactly one category and to praise or flag; quote ≤ 200 chars; **omit any personal names** (replace with "[name]"); ignore comments that are only a grade; if the document has no readable comments, return empty arrays. Category hints: thesis (claim, argument, focus), evidence (support, sources, analysis depth), organization (structure, flow, transitions), citation (format, missing cites), voice (tone, clarity, style, word choice), mechanics (grammar, spelling, punctuation). Admin can edit the coding before approving. Show the student a short neutral recap after approval: counts of praise/flags per category.

---

## 7. CROSS-STAGE — Style mismatch thresholds

Starting values; **tune from logged data** (every evaluation logs the full metric deltas to `session_events.detail`). Implement as one exported config object `MISMATCH_THRESHOLDS` in `lib/config.ts` (no magic numbers in logic) and unit-test each row. Compares draft (or section/pasted span) to `style_profiles`.

| Signal | Computed as | "Tell" (counts 1) | "Strong" (triggers alone) |
|---|---|---|---|
| Sentence length | `draft.avgSentenceLength / sample.avgSentenceLength − 1`, and absolute gap ≥ 6 words | ≥ **+60%** | ≥ **+100%** |
| Reading grade | `draft.readingGrade − sample.readingGrade` | ≥ **+4.0** grades | ≥ **+6.0** grades |
| Formality | `draft.formalityScore − sample.formalityScore` (0–1 scale) | ≥ **+0.35** | ≥ **+0.50** |
| Unseen vocabulary | share of the draft's distinct content words that are ≥ 8 letters **and** not in the allow-list | > **12%** | > **20%** |

- **Unseen-vocabulary allow-list** (stem-matched by stripping -s/-es/-ed/-ing/-ly): sample vocabulary, assignment prompt, thesis/outline notes, Stage 4 source passages and the student's own "how I'll use it" notes. Denominator = all distinct content words in the evaluated text. Report up to 8 example words.
- **Minimum text:** evaluate only text of ≥ **120 words**. Shorter sections are evaluated on the cumulative text of all submitted sections so far once ≥ 120 words; pasted spans use their own text if ≥ 120 words.
- **Exclusions before computing:** text inside quotation marks and block quotes, in-text citations, headings, and the references list.
- **Trigger rule:** warn when **≥ 2 tells** (from different signals; sentence length and reading grade count as separate signals) **or ≥ 1 strong signal**. If the sample is under 200 words, the sentence-length signal's "strong" level is treated as a plain tell (so it needs a second signal), to reduce noise from short samples.
- **Direction:** only upward jumps are evaluated; a draft simpler than the sample never warns.
- **Output** (saved to `drafts.mismatch` / section state / event): `{triggered, tells: [{signal, sampleValue, draftValue, level}], examples: string[]}`.
- **Warning copy** (amber, non-blocking, name the tells, never accusatory):
  > **This reads differently from your sample.** We noticed: {e.g. "sentences average 32 words vs. 14 in your sample", "reading level is about 5 grades above your sample", "words that weren't in your sample: X, Y, Z"}. Your own voice is your strongest asset — rework these parts in your words.
  
  Buttons: "Show me which sentences" (highlights the longest sentences and unseen words, coaching only) and "I've reworked it" / "This is my writing" (both log `mismatch_response`; "This is my writing" never penalizes).
- **Tuning plan:** after ~50 completed papers, review `/admin/sop`: target a warning rate of ~10–20% of drafts; if > 30% loosen tells (e.g. +70% / +5 grades); if < 5% tighten. Also track how often students respond "reworked" vs. "my writing".

---

## 8. CROSS-STAGE — AI models, providers, env vars

"Generation" means producing **coaching content and study summaries only** (questions, probes, checklists, feedback, classification, source summaries/beat scripts). The student's prose is never generated.

| Job | Tier | Model (verified against [xAI models](https://docs.x.ai/developers/models) and [pricing](https://docs.x.ai/developers/pricing), 19 Nov 2026) |
|---|---|---|
| Live probing and classification: thin-answer assist, cluster classification, slot extraction, move reflection/follow-up, topic-sentence check, per-card outline check, "Ask coach" questions, section coach prompts, transition questions | Fast/cheap | **Grok 4.3** — `grok-4.3` (`MODEL_FAST`). 1M context; $1.25 / $0.20 cached / $2.50 per 1M tokens under 200k prompt tokens. Supports `reasoning_effort` including `none` (use `none` on live calls to keep latency under ~2 s). Model page: https://docs.x.ai/developers/models/grok-4.3 |
| Heavier analysis: thesis rubric, whole-outline gaps, section feedback, Stage 6 AI checks, source passage extraction and beat scripts, professor-feedback verification and coding (image input + extracted PDF text) | Strong | **Grok 4.7** — `grok-4.7` (`MODEL_STRONG`). Current public-API flagship; 500k context; $2.00 / $0.50 cached / $6.00 per 1M tokens under 200k prompt tokens. Use `reasoning_effort: "low"` unless a task clearly benefits from more. Docs: https://docs.x.ai/developers/models |
| Audio beats (text-to-speech) | TTS | **Google Cloud Text-to-Speech Chirp 3 HD**. Default voice `en-US-Chirp3-HD-Charon` (format `<locale>-Chirp3-HD-<voice>`; Charon is a listed Chirp 3 HD voice). Official voice list: https://docs.cloud.google.com/text-to-speech/docs/chirp3-hd. Pricing is usage-based (Chirp 3 HD list rate $30 / 1M characters; see https://cloud.google.com/text-to-speech/pricing). Do not use a different TTS vendor. |

Note: `grok-4.7` Fast is **not** on the public xAI API (Cursor / Grok Build only). Do not use that slug. Retired mid-2026 slugs such as `grok-4-fast-reasoning` now redirect to `grok-4.3` and should not be used. If a chosen model is later retired, bump the constant to the current model in the same cost/capability tier.

Implementation notes:
- Model IDs are constants in `lib/config.ts` (`MODEL_FAST`, `MODEL_STRONG`), **not** env vars, so they can be bumped in code:
  ```ts
  export const MODEL_FAST = "grok-4.3";
  export const MODEL_STRONG = "grok-4.7";
  export const TTS_VOICE_DEFAULT = "en-US-Chirp3-HD-Charon";
  ```
- AI client: the official `openai` npm SDK pointed at xAI's OpenAI-compatible endpoint. Do **not** install or use `@anthropic-ai/sdk`.
  ```ts
  import OpenAI from "openai";
  export const grok = new OpenAI({
    apiKey: process.env.GROK_API_KEY,
    baseURL: "https://api.x.ai/v1",
  });
  // Equivalent: POST https://api.x.ai/v1/chat/completions
  // with Authorization: Bearer $GROK_API_KEY
  ```
- Structured JSON: use `response_format: { type: "json_schema", json_schema: { name, strict: true, schema } }` (supported; see https://docs.x.ai/developers/model-capabilities/text/structured-outputs). Always validate the result with the existing Zod schemas/guard. If a particular schema is rejected (HTTP 400), retry that call with `response_format: { type: "json_object" }` and Zod validation. Low temperature for classification. For `MODEL_FAST` live calls set `reasoning_effort: "none"`. Static system prompts can be reused to take advantage of cached-input pricing.
- Live stage calls never block on the strong model; Stage 5/6 strong-model calls show a loader (≤ 30 s budget) and fall back per section 2. The coaching-only rules, AI output guard (reject any output that rewrites the student's work), and rule-based fallbacks stay exactly the same.
- PDFs and images: `grok-4.3` and `grok-4.7` accept image input (`jpg`/`png`, see model docs) and text. For course PDFs, extract text first (e.g. pdf-parse). If a PDF has no extractable text and `MISTRAL_OCR_API_KEY` is set, run Mistral OCR on those pages; if the key is missing, skip scanned pages and log `ocr_skipped`. Professor-feedback photos can be sent as image parts to `MODEL_STRONG`, along with any extracted PDF text. Do not send student draft prose to TTS.
- Unpaywall: when the research extractor looks up an open-access copy of a paper the student identified, call Unpaywall with `UNPAYWALL_EMAIL` as the required contact email. This is a fallback only; students still upload only materials they are allowed to use.
- **Audio beat spec** (extends Stage 4): each beat's script is a conversational study summary of a passage from the student's uploaded source, 45–90 words, second person, attributes the source ("In your reading from {title}…"), ends with one retrieval question ("Where might this support your point about X?") — it summarizes the *source*, never argues the student's paper. Full beat text always shown alongside the audio. **Cap 6,000 TTS characters per paper** (~$0.18 at the Chirp 3 HD list rate of $30 / 1M characters); beats beyond the cap are text-only with a notice. Generate asynchronously (route handler, `maxDuration` 300) after `audio_unlocked`; call Google Cloud TTS (`texttospeech.googleapis.com`) with `GOOGLE_CLOUD_TTS_API_KEY`, voice `GOOGLE_CLOUD_TTS_VOICE_ID` or `TTS_VOICE_DEFAULT`, `audioEncoding: "MP3"`; store MP3 in the `audio` bucket; when all beats are ready, send the `AudioReady` email and log `audio_generated`. Send only the beat script text (never student writing) to the TTS provider. Enable the Cloud Text-to-Speech API in the Google Cloud project that owns the key.

### New env vars (flagged NEW; add to Vercel, `.env.example`, and `lib/env.ts`)
| Name | Secret? | Used for |
|---|---|---|
| `GROK_API_KEY` **(NEW)** | Yes, server only | All xAI Grok calls (`api.x.ai`). Create at https://console.x.ai/team/default/api-keys after signing in at https://console.x.ai. A SuperGrok / X Subscription does **not** include API credits — see the note below. |
| `GOOGLE_CLOUD_TTS_API_KEY` **(NEW)** | Yes, server only | Google Cloud Text-to-Speech (Chirp 3 HD) for audio beats |
| `GOOGLE_CLOUD_TTS_VOICE_ID` **(NEW)** | No, server only | Chirp 3 HD voice ID. Default `en-US-Chirp3-HD-Charon` if unset (`TTS_VOICE_DEFAULT`) |
| `ADMIN_NOTIFY_EMAIL` **(NEW)** | No, server only | Address that gets the "feedback needs review" and SLA reminders |
| `UNPAYWALL_EMAIL` **(NEW)** | No, server only | Contact email required by the Unpaywall API fallback |
| `CRON_SECRET` **(NEW)** | Yes, server only | Auth for Vercel Cron routes (`Authorization: Bearer $CRON_SECRET`) |
| `MISTRAL_OCR_API_KEY` **(NEW, optional)** | Yes, server only | Scanned-PDF OCR. If missing, scanned-PDF OCR is off (`ocr_skipped`) |

Do **not** add `ANTHROPIC_API_KEY`, `ELEVENLABS_API_KEY`, or `ELEVENLABS_VOICE_ID`.

`lib/env.ts`: in production, require `GROK_API_KEY`, `GOOGLE_CLOUD_TTS_API_KEY`, `ADMIN_NOTIFY_EMAIL`, `UNPAYWALL_EMAIL`, and `CRON_SECRET`. `GOOGLE_CLOUD_TTS_VOICE_ID` is optional (falls back to `TTS_VOICE_DEFAULT`). `MISTRAL_OCR_API_KEY` is optional. In development, missing AI or TTS keys enable rule-based fallbacks only (TTS is skipped). Cron routes in `vercel.json`: `/api/cron/feedback-sla` and `/api/cron/retention` daily; `/api/cron/guardian-expiry` daily.

Supabase Auth email (dashboard config, no new env var): set custom SMTP to Resend (`smtp.resend.com`, port 465, user `resend`, password = the existing Resend API key entered in the Supabase dashboard only, never in code/chat), sender `coach@send.retainwrite.com`, so confirmation/magic-link emails come from the verified domain.

**SuperGrok / subscription vs API credits.** A Grok or SuperGrok (now part of The X Subscription) account can be the same login as the API console, but billing is separate. The consumer weekly usage pool does not pay for `api.x.ai` calls. Create a key at https://console.x.ai/team/default/api-keys and load prepaid credits in the console before the app can call Grok. Sources: https://docs.x.ai/developers/quickstart, https://docs.x.ai/console/faq/accounts, https://docs.x.ai/console/billing.

---

## 9. CROSS-STAGE — Terms and Privacy (DRAFT — needs legal review before launch)

Put at `/terms` and `/privacy`. Plain-English text:

**What RetainWrite is.** RetainWrite is a writing *coach*. It asks questions, gives feedback, and summarizes your own course materials for study. It does not write your paper. You write every sentence you submit, and you are responsible for following your school's and instructor's academic integrity rules and for what you turn in.

**Who can use it.** You must be at least 13. If you are 13–17, a parent or guardian must agree before you use RetainWrite: you'll enter their email at signup and they will get a message to confirm. Until they confirm, you can't start a paper or upload anything. If we learn that a child under 13 created an account, we'll delete it. Accounts waiting for guardian confirmation for more than 14 days are deleted.

**What we store.** Your account details; your intake answers; your writing sample, outline, and draft versions; style measurements calculated from them (like average sentence length); the course materials and grade/feedback documents you upload; your purchases (payments are handled by Stripe; we never see your card number); and usage logs we use to improve the coaching.

**How we use it.** To run the coaching, show you feedback, deliver audio study beats, process payments, and improve RetainWrite. We do not sell your data and we do not use your writing to advertise. We send the text needed for a feature to our service providers (for example, AI analysis and text-to-speech of study summaries) under terms that do not allow them to train on your content *[legal to confirm provider terms]*. Your uploads are private to your account.

**Course materials.** Only upload materials you are allowed to use for your coursework. We use them for your personal study and do not redistribute them.

**Professor feedback and FERPA.** If you choose to upload your grade or your instructor's feedback, you are sharing your own education record with us voluntarily; we don't get it from your school and we never share it with your school or instructor. Please cover your name and anyone else's personal information first. We review it to issue your credit, keep a short, name-stripped summary of the comments to improve coaching, and delete the original upload within 90 days of review (30 days if not approved).

**Your choices.** You can ask us to delete your account and all your content at any time by emailing support@retainwrite.com; we'll delete it within 30 days (payment records we must keep by law excepted).

**Changes and contact.** We'll post updates here. Questions: support@retainwrite.com.

Signup UI: required checkbox "I agree to the Terms and Privacy Policy"; DOB field (month/day/year); if under 13 → block with "RetainWrite is for ages 13 and up" and **do not store the DOB or email**; if 13–17 → show "Parent/guardian email" (required) and checkbox "My parent or guardian knows I'm signing up and agrees." On submit: `guardian_status='pending'`, send `GuardianConsent` email with a 7-day signed token link (store only the sha256 hash); link lands on `/guardian/confirm` showing what RetainWrite is and a "Yes, I consent" button → `granted`, `guardian_consented_at` set, log `guardian_granted`; student gets a "You're cleared to start" in-app banner. Expired after 14 days → delete account (cron `guardian-expiry`). `assertCanCreatePaper()` must check `guardian_status in ('not_required','granted')`.

---

## 10. CROSS-STAGE — Refund policy (one line)
"Unused paper credits and unused packs can be refunded within 14 days of purchase; used credits and audio add-ons are non-refundable — email support@retainwrite.com."

(Implementation: manual refunds via the Stripe dashboard in v1; set `purchases.status='refunded'` and decrement `paper_credits` accordingly. Show this line on `/pricing`, checkout, and in `/terms`.)

---

## 11. CROSS-STAGE — Email copy
From: `RetainWrite Coach <coach@send.retainwrite.com>`; reply-to `support@retainwrite.com`. React Email templates in `emails/`; plain, warm, no images required; every email has a footer line ("You're getting this because you have a RetainWrite account.").

### 11.1 Signup confirmation (`Welcome`; also used as the Supabase confirm-email body)
**Subject:** Welcome to RetainWrite — your first paper is free

> Hi {first_name_or_there},
>
> Welcome! RetainWrite is a writing coach: we ask the questions, you write the paper, and you end up understanding it better.
>
> Your first paper is free (no card needed). Here's how it goes: upload the assignment and check what we pulled out, answer a few questions in your own words, work through a few tough questions on your argument, build your outline, and then draft it one section at a time with a coach in your corner.
>
> [Start your first paper → {SITE_URL}/app/papers/new]
>
> Questions? Just reply to this email.
>
> — The RetainWrite Coach

**Variant line for 13–17 pending guardian consent** (insert before the button; button becomes disabled text "Waiting on your parent or guardian"):
> One more step: we've emailed {guardian_email} to get your parent or guardian's OK. Once they confirm, you can start your first paper. If they don't see it, ask them to check spam.

### 11.2 Guardian consent (`GuardianConsent`)
**Subject:** {student_first_name} asked to use RetainWrite — your OK needed

> Hello,
>
> {student_first_name} signed up for RetainWrite, a writing-coaching app for students. It asks questions and gives feedback while the student writes their own paper; it never writes the paper for them. Because they're under 18, we need a parent or guardian to agree.
>
> We store the student's account details, writing samples, drafts, and files they upload. We don't sell data, and uploads are private. You can read the details and ask us to delete everything at any time: {SITE_URL}/privacy.
>
> [I agree — let {student_first_name} start → {guardian_confirm_url}] (link valid for 7 days)
>
> If you didn't expect this, ignore this email and no account access will be granted.
>
> — RetainWrite

### 11.3 Audio delivery (`AudioReady`)
**Subject:** Your audio beats are ready 🎧

> Hi {first_name},
>
> Your study beats for “{paper_title}” are ready: {beat_count} short audio clips (about {minutes} min total), each pulled from the course materials you uploaded. Perfect for a drive or a walk.
>
> Every beat has the full text right alongside, so you can read along or skim.
>
> [Listen now → {SITE_URL}/app/papers/{paper_id}/stage/4]
>
> Tip: after each beat, pause and ask yourself where you might use it in your paper. That's where the learning sticks.
>
> — The RetainWrite Coach
>
> These summaries are for your personal study only — please don't share them.

### 11.4 Free-paper-credit confirmation (`FeedbackCreditGranted`)
**Subject:** You earned a free paper credit

> Hi {first_name},
>
> Thanks for sharing your feedback on “{paper_title}”. We've added **1 free paper credit** to your account (audio included, and it never expires). You now have {credits_remaining} paper credit(s).
>
> [Start your next paper → {SITE_URL}/app/papers/new]
>
> As promised, we'll delete your original upload within 90 days. You can ask us to delete it sooner anytime.
>
> — The RetainWrite Coach

### 11.5 Short status emails (`FeedbackUnderReview`, `FeedbackNeedsAnotherLook`)
**FeedbackUnderReview** — Subject: **We're reviewing your feedback upload**
> Hi {first_name}, thanks! We got your grade and feedback for “{paper_title}”. A person reviews each upload, usually within 48 hours. We'll email you as soon as your credit is added.

**FeedbackNeedsAnotherLook** — Subject: **We couldn't use that upload — one more try?**
> Hi {first_name}, we couldn't confirm the upload for “{paper_title}”: {reason}. You can upload a clearer photo or screenshot here: {SITE_URL}/app/papers/{paper_id}/feedback. (Remember to cover your name and anyone else's details.)

### 11.6 Admin notification (plain text, to `ADMIN_NOTIFY_EMAIL`)
**Subject:** Feedback upload needs review ({n} in queue)
> A new professor-feedback upload is waiting: {SITE_URL}/admin/feedback. Oldest has been waiting {hours}h (target: 48h).

All sends: server-side, try/catch, failures logged as `email_failed`, never block the user flow.

---

## 12. Tests to add (Vitest)
Nov 20, 2026 additions: sentence-plan gate (≥ 2 rows per body card, evidence rows flagged), guard rejects AI-written `purposeNote`, `rawMaterial` phrases must be verbatim substrings, citation clustering flag, a/b/c suffix detection (same author + year without matching suffixes flagged in APA; short titles in MLA), Stage 2 receives `storyAngle`.
Cluster/slot verification (non-substring slot rejected), `pickMoves` determinism and absolute-word rule, thesis deterministic checks, thesis max-attempt flag-advance, outline section count by length, approval gating, section minimum formula, paste threshold, mismatch table (each tell, strong, two-tell, exclusions, min length, short-sample downgrade), checklist completion logic, feedback auto-grant conditions and rate limit, dedupe hash, `grant_feedback_credit` idempotency, guardian gating, AI output guard (rewrite phrases rejected), AI fallback paths.
