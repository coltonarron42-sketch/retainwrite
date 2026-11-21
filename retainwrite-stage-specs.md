# RetainWrite — Stage Specs & Cross-Stage Decisions (companion to `retainwrite-cursor-build-prompt.md`)

Paste this into Cursor **after** the build prompt. Where this doc conflicts with the build prompt, **this doc wins** (see "Overrides to the build prompt") for Stages 2–6 and cross-stage rules. **Stage 1 intake is specified in `retainwrite-stage1-intake-spec.md`; that doc wins on Stage 1 behavior.** The six-stage structure is unchanged (intake, stance interview, outline, sources and audio beats, draft, revise and feedback); only Stage 1's internals change. Table names, stage order, price constants and existing env var names are unchanged.

**Governing document:** `retainwrite-coaching-philosophy.md` (v1.2, Nov 20, 2026) governs every stage, probe, summary, and interaction. It wins over this doc on philosophy; this doc still holds the implementation detail for Stages 2–6. The section-by-section loop (DISSECT → PROBE → SEARCH → SUMMARIZE → CONFIRM → LOGIC CHECKPOINT → ADVANCE) is placed on the stages in section 2A.

LOCKED RULES (hold everywhere): coaching only (the app never writes submission prose: no paragraphs, no thesis, no rewrites; AI produces questions, probes, checklists, feedback, and source summaries for study; the student writes every submitted sentence). Style metrics are for feedback/revision coaching only. Mismatch warnings name specific tells and never use detector-evasion framing. Every stage is gated on real student input. Every session is logged to `session_events`. Add `// SOP: coaching only, never generate submission text` at every AI call site.

---

## 0. Decisions made in this doc

1. Stage 2 uses 8 topic clusters plus a `general` fallback; the student picks, an LLM suggests, and the student's pick wins (the LLM is used only when the student skips and its confidence is ≥ 0.6).
2. Stage 2 runs exactly 3 coach moves per paper (weighted by cluster, 3 distinct types), and the student writes ≥ 30 words in reply to each; up to 2 optional extra moves.
3. Coach question slots ({claim}, {key_term}, {group}, {evidence_type}) are only ever filled with verbatim substrings of the student's own text, enforced in code; otherwise a slot-free fallback phrasing is used.
4. Refined thesis passes only if it meets 5 criteria (arguable, specific scope, reason, survives a counterargument, differs from the original or is defended); max 3 attempts, then the student may advance with a flag (never a hard dead end).
5. ~~Stage 2 text boxes are paste-blocked~~ **Superseded Nov 20, 2026 (Colton t44): paste is allowed in every text input in every stage**, including Stage 1 voice answers and Stage 2 boxes. Paste is recorded quietly as metadata (`paste_ratio`) and never blocks (decision 34).
6. Stage 3 outline = the sections of the student-confirmed Stage 1 roadmap (`section_plans`). When the rubric/prompt names no sections, the roadmap defaults to Intro + N body sections + Conclusion, with N = 3 (< 1,500 words), 4 (1,500–3,000), 5 (> 3,000); N = 3 if length is unknown. (Updated Nov 20, 2026: Counterargument/Rebuttal is included only when the assignment requires it or the paper type is argumentative — default kept, **unconfirmed by Colton** as of Nov 20, 2026; Stage 1 spec section 16 item 5.)
7. Every outline section holds only student-written notes (claim, evidence notes, explanation note, and a sentence plan of purpose/point notes with citation flags — section 4.2); the coach checks fit with the thesis; drag-to-reorder (with keyboard up/down buttons); the student clicks Approve; later edits are allowed and logged.
8. Stage 5 coaching is not live per keystroke: prompts come before writing a section, "Ask coach" is on request (max 3 per section), and full feedback arrives when a section is submitted.
9. Stage 5 allows paste from Google Docs/Word; every paste is recorded quietly (size and paste ratio). **Updated Nov 20, 2026 (Colton t46):** a paste of ≥ 80 words shows one supportive, dismissible suggestion, at most once per session: “We suggest using your own writing so your tone is better understood and we can serve you better.” It is not a question, needs no answer, and nothing is ever blocked (section 5.2, decision 35).
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
25. (Nov 20, 2026) **Where the loop lives.** DISSECT ends Stage 1 (a student-confirmed roadmap). The per-section loop runs in **Stages 2–4**: **PROBE** in Stage 2 (after the whole-paper stance work), **SEARCH** in Stage 3 (while each outline card is built), **SUMMARIZE + CONFIRM** in Stage 4, followed by the mandatory, non-blocking **LOGIC CHECKPOINT** (decision 33). **Updated Nov 20, 2026 (Colton, t40): section-first order.** Each section runs PROBE → SEARCH → SUMMARIZE → CONFIRM → LOGIC CHECKPOINT before the next section opens for work. Later sections (and the rest of the workflow, including Stages 5–6) can be **previewed read-only**. A section can be **skipped**; a skipped section counts as finished-for-now so the next one opens, and it stays flagged with a persistent reminder and a jump-back link until it is confirmed. To make this work, the per-stage gate is relaxed **only inside Stages 2–4** (the "loop span"): Stages 3 and 4 open once Stage 2's whole-paper stance work (cluster, 3 moves, refined thesis) is done, and the work inside them is gated per section and per step. All other stage gates are unchanged: Stage 1 → 2, and Stage 5 still opens only when every section is confirmed (no skipped sections left). Section 2A.1.
26. (Nov 20, 2026) **Saved per-section decisions are the skeleton.** Each section's ideas (student's words), chosen leaders, chosen style, and verified sources are saved in `section_decisions` and prefill the Stage 3 outline card, the Stage 5 draft view, and Stage 6 checks. The student never re-explains anything.
27. (Nov 20, 2026) **Stage 5 draft feedback pattern:** section by section, the captured ideas as short notes (never finished sentences), the chosen leader and style, the source excerpts, and transition suggestions (relationship + connective words only). The student writes in their own words (section 5.3).
28. (Nov 20, 2026) **Light cleanup is narrow:** flag spelling, grammar, and citation-format issues for the student to accept or fix; never rephrase (section 6.1 item 12). One-click Accept only for single-word and citation-format fixes — default kept, **unconfirmed by Colton** as of Nov 20, 2026.
29. (Nov 20, 2026) **Stay inside the rubric:** every probe, lead, source card, angle, and suggestion carries a `rubricRef` to the confirmed assignment or roadmap; the guard rejects outputs without one. Imagination (angles, reframed questions, alternative framings) is allowed inside those bounds.
30. (Nov 20, 2026, Colton t40) **Research leads: 3–5 at a time, 20 per paper.** Every lead set shows 3–5 options, never more than 5. If none appeal: **Show me 3–5 more** or **I have someone specific to look into**. The cap is **per paper** (not per section): after 20 AI-researched leads across Stage 1 and Stage 3, the coach stops suggesting and hands the student a ready-to-paste Google search prompt built from the section, rubric terms and story angle, then researches the names they bring back in the same 3–5 card pattern (uncapped, always `to_verify`). Section 2A.3.
31. (Nov 20, 2026, Colton t40) **Final outline exports as Word (.docx) and PDF**, generated in code from saved student data; structure, idea notes, source excerpts and citation flags only, no AI prose. Section 2A.7.
32. (Nov 20, 2026, Colton t40) **Stage 1 voice minimum is 200 words across the answers given** (skipped answers allowed), with 2 answers ≥ 40 words kept and no separate personal-question requirement. The Stage 6 mismatch baseline uses whatever Stage 1 collected; the short-sample downgrade in section 7 still applies below 150 words (since t44, **typed** words; Stage 1 spec 8.1a).
33. (Nov 20, 2026, Colton t41 + t42) **Per-section LOGIC CHECKPOINT, mandatory and never blocking.** After each section's CONFIRM is saved and before ADVANCE, the coach runs a logic check on the section's claim against the story angle, thesis and the assignment's own terms. There are three tiers: **pass**, **moderate** (light feedback when an interpretation is debatable; the student decides) and **strong** (a firm, clear flag with suggested edits and alternative angles as questions when a claim defies logic or contradicts the assignment). **Nothing in the checkpoint gates anything:** every tier ends with the student able to move on, including **Continue anyway** on a strong flag. The student is always the writer, even of a weaker paper. When unsure, the result is **pass**. t41's "hard stop" tier was removed by Colton in t42 and never shipped. Section 2A.4a.
34. (Nov 20, 2026, Colton t43 → t44 → t45) **Paste is allowed in every text input, in every stage.** t43 kept voice answers paste-blocked; t44 removed that exception. **Consequence:** the Stage 6 voice comparison's baseline may include pasted text. **Mitigation (never blocks, never warns during writing):** per-answer `paste_ratio` metadata, a typed-weighted baseline, and the short-sample downgrade when fewer than 150 baseline words were typed or spoken. **t45/t46:** when the baseline's pasted share is over 60%, the Stage 6 comparison (and the checker report) shows one kind, factual note at the very bottom, below the scores, in the soft t46 wording (checker spec 5.9). Spoken input (OS dictation or in-app speech-to-text) counts as typed. No note when there's no baseline. Stage 1 spec 8.1a; checker spec 5.9.
35. (Nov 20, 2026, Colton t46) **Stage 5 paste: a supportive suggestion, not a question.** The old ≥ 80-word paste modal is replaced by one dismissible inline note, “We suggest using your own writing so your tone is better understood and we can serve you better.”, shown at most once per session per paper, with no answer, no buttons beyond Got it, and no recorded choice. Only quiet paste metadata is kept. **Voice note:** one consistent soft style on every surface (checker spec 5.9). Stage 6 uses “Your voice answers were mostly pasted in, which is totally fine. Typed or spoken answers help us understand your voice better, so treat the voice comparison as a lighter read.”

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
| Gates: a stage can't open until the previous stage is complete | Unchanged except inside Stages 2–4 (the loop span): Stages 3–4 open once Stage 2a (whole-paper stance and thesis) is done, and work is gated per section and per step by `assertSectionStepUnlocked`; later sections are read-only previews (section 2A.1, Colton Nov 20, 2026). Stage 5 still requires Stage 4 complete. |
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
- New `session_events.event` names: `cluster_selected`, `move_shown`, `move_answered`, `thesis_attempt`, `thesis_flag_advanced`, `outline_section_checked`, `outline_approved`, `outline_edited`, `section_topic_submitted`, `coach_asked`, `section_feedback`, `section_done`, `paste`, `paste_suggestion_shown`, `paste_suggestion_dismissed`, `mismatch_warned`, `mismatch_response`, `checklist_item`, `revision_saved`, `feedback_submitted`, `feedback_auto_granted`, `feedback_queued`, `feedback_reviewed`, `audio_generated`, `guardian_requested`, `guardian_granted`, `ai_fallback`, `email_failed`.
- Stage 1 session event names (assignment parse/confirm, interest, leads, voice) are listed in `retainwrite-stage1-intake-spec.md` section 13. Do not put interest prose or assignment full text in `session_events.detail`.

---

## 2. Cross-cutting behavior (applies to Stages 2–6)

- **Thin-answer handling** reuses `lib/coaching/thin.ts` (max 2 probes, then "I'm stuck — flag for help" saves and lets the student continue, as in the build prompt).
- **Philosophy hard limits in the guard (Nov 20, 2026).** In addition to the rules below, `lib/ai/guard.ts` rejects (retry once, then rule-based fallback): (1) any output field meant for notes, ideas, or plans that contains a finished sentence (≥ 13 words, or ending in sentence punctuation with a subject + verb) unless it is a verbatim substring of the student's own text; (2) any probe, lead, source card, angle, or suggestion without a `rubricRef` that exists on the confirmed assignment/roadmap; (3) quotes or excerpts that aren't verbatim substrings of a **verified** source's text; (4) any "% AI," "AI probability," "beat/bypass Turnitin," "undetectable," or "humanize" phrasing; (5) citation text in any coach output (the app never inserts citations); (6) cleanup suggestions outside the light-cleanup definition (section 6.1 item 12). Every system prompt includes the hard limits from `retainwrite-coaching-philosophy.md` section 3.
- **AI output guard** (`lib/ai/guard.ts`): every coaching call returns Zod-validated JSON with length-capped fields (questions ≤ 35 words each, max 3 per response, feedback bullets ≤ 40 words). Reject and retry once (then fall back) if output contains rewrite-style phrases ("here is a revised", "you could write", "try this:", "for example, write") or any sentence of ≥ 12 consecutive words copied from the student's text *with edits* (quoting the student verbatim in quotation marks is allowed). System prompts for every call state: "You are a writing coach. Never write, rewrite, or complete sentences or paragraphs for the student. Ask questions, point to what is present or missing, and stop."
- **AI fallback**: on timeout (8 s `MODEL_FAST`, 30 s `MODEL_STRONG`) or error, log `ai_fallback` and use the rule-based path (lexical overlap with thesis keywords, non-empty checks, scripted probes). The student is never blocked by an AI outage; flagged items show "Coach check unavailable — we'll recheck later" and are re-run when the student next opens the stage.
- **Student data in prompts**: send only the fields needed for the call; never send email/name. Cache static system prompts.
- **Paste policy (Colton, Nov 20, 2026, t44): paste allowed universally.** Every text input in Stages 1–6 accepts paste and drop, with no `preventDefault`, no note, and no CSS or input tricks (Stage 1 spec 0A.1; CI grep with no exceptions). Stage 1 voice answers and Stage 2 boxes record a quiet `paste_ratio` (Stage 1 spec 8.1a). Stage 5 keeps its existing paste logging and non-blocking ≥ 80-word check (section 5.2).

---

## 2A. The section-by-section loop (Stages 2–4) — Nov 20, 2026

Source: `retainwrite-coaching-philosophy.md` (governing). The story angle (Stage 1, Pick your story) is the spine; the roadmap (Stage 1, DISSECT) lists the sections; the loop runs per section underneath both. Every loop screen shows the story angle and the section's `needs` + `rubricRefs` in a header strip.

### 2A.1 Placement

| Loop step | Stage | When | Saved to |
|---|---|---|---|
| DISSECT | 1 (end) | After the early stance | `section_plans` |
| PROBE | 2 | After the 3 moves and the refined thesis, once per roadmap section | `section_decisions.ideas`, `probe_choice` |
| SEARCH | 3 | Per section, as its outline card is built | `section_decisions.search_terms`, `research_leads` (to verify), `chosen_lead_ids`, `chosen_style` |
| SUMMARIZE | 4 | Per section | `sources`, `sources.beats`, `section_decisions.source_card_ids` |
| CONFIRM | 4 | End of each section | `section_decisions.status = 'confirmed'`, `confirmed_at`, `confirm_snapshot` |
| LOGIC CHECKPOINT (Colton, t41/t42) | 4 | Right after CONFIRM is saved, before ADVANCE; mandatory, non-blocking | `section_decisions.logic_*` (2A.6) |
| ADVANCE | 2, 3, 4 | Next section in roadmap order | `section_decisions.loop_step` |

**Order: section-first (Colton, Nov 20, 2026; replaces the per-stage passes).** After Stage 2's whole-paper stance work, the loop takes one roadmap section at a time through PROBE → SEARCH (with its outline card) → SUMMARIZE → CONFIRM → LOGIC CHECKPOINT (non-blocking, 2A.4a), then ADVANCEs. The left rail still shows Stages 2, 3 and 4, each with per-section progress dots, so the student sees where each section sits.

**Reconciling with the stage gates (the loop span).**
- Stage 2 has two parts. **2a, whole paper:** cluster, 3 moves, refined thesis, gated exactly as before. **2b, PROBE**, runs per section inside the loop.
- `assertStageUnlocked(paperId, 3|4)` passes once 2a is complete (instead of once Stage 2 is complete). Every write inside Stages 2b–4 also calls `assertSectionStepUnlocked(paperId, sectionKey, step)`, which passes only when (1) every earlier section is `confirmed` or `skipped`, and (2) the section's earlier steps are done (probe → search → summarize → confirm). It fails with 409 `section_locked` and names the section to finish first.
- **Stage completion is unchanged in meaning:** Stage 2 completes when 2a is done and every section has a PROBE result; Stage 3 when every section has its SEARCH result and complete card **and** the whole outline is approved (the Approve button appears once the last section's card is complete); Stage 4 when every section is confirmed (2A.5). A skipped section blocks those completions until it is finished.
- **Stage 5 and 6 gates are unchanged:** Stage 5 opens only when Stage 4 is complete, so no section can still be skipped when drafting starts.

**Browse ahead (read-only preview).** The student can open any later section, and the Stage 5–6 screens, to see the workflow: the section's title, rubric criteria and target length, the steps it will go through, and anything already saved. All inputs and buttons are disabled, with the note “Finish or skip {earlier section} to work on this one” and a **Go to {current section}** link. Preview never writes data. Log `section_previewed`.

**Skip a section.** Every loop screen has **Skip this section for now** (in an overflow menu, under the main buttons). Skipping saves `status = 'skipped'`, `skipped_at`, and the step it was on (`loop_step` stays where it stopped), and opens the next section for work. Skipped sections get:
- a **Skipped** badge in the roadmap rail;
- a **persistent reminder bar pinned to the bottom** of every Stage 2–4 screen (and the locked Stage 5 entry screen) for as long as any section is skipped: “You skipped {Section title}. It needs to be finished before you start your draft.” with a **Go back to {Section title} →** link that jumps straight to that section's saved step. With 2 or more skipped sections the bar lists each, in roadmap order, each with its own link;
- when the student returns, the section resumes at its saved step; it becomes `open` again (`skipped_at` kept for analytics). Log `section_skipped`, `section_skip_reminder_clicked`, `section_unskipped`.

The last section's CONFIRM never auto-advances into Stage 5 while a section is skipped; it routes to the first skipped section instead.

### 2A.2 PROBE (Stage 2)

After the refined thesis (Stage 2a), the loop starts at the first roadmap section. Each section, when it opens for work, starts here, and the first prompt is exactly:

> “Do you already have an idea of how you want this section to go, or do you want me to ask some probing questions so we can start finding research?”

Buttons: **I have an idea** / **Ask me some questions**.

- **I have an idea** → textarea (paste allowed), “Tell me the idea in a few words or a few sentences.” No minimum beyond 5 words. Up to 2 follow-ups only if it's vague (`specific=false`).
- **Ask me some questions** → `MODEL_FAST` asks 2–4 probing questions, one at a time, each tied to the section's `rubricRefs` and the story angle (≤ 30 words each).
- **Freeze / “I don't know” / empty twice** → **warm-up questions** first (scripted bank: “What's one thing you already know about this?” / “Who's someone you've seen do this well?” / “What part of this makes you curious?”). Never dump sources cold. Only after a warm-up answer does SEARCH get a framework.
- Every answer is saved verbatim (`ideas[]`, each with `answerId`) and added to the raw-material bank. Paste is allowed, as everywhere (decision 34).
- Skip: **Skip this section for now** saves `status = 'skipped'` (section 2A.1); the next section opens for work and the skipped one stays flagged with the bottom reminder bar and jump-back link. Stage 2 completes only when every section has a PROBE result.

### 2A.3 SEARCH (Stage 3)

For each section, alongside its outline card:

- **Search terms** the student would naturally run (3–6, built from the section's ideas, the rubric's required styles/themes, and the story angle), with a **Copy** button and a short note on why each term helps. Teaching the search is the point: show the reasoning (“We added ‘servant leadership’ because the rubric asks for a named style”).
- **Cross-reference** against `requiredStyles` / `requiredSources`: a small checklist of what the rubric needs in this section and which leads cover it.
- **3–5 leads** (people, organizations, cases, examples, works), never more than 5 at once, each with a one-line why-it-fits-the-rubric, a `rubricRef`, and the badge **To verify**. No quotes. Stage 1 accepted leads tagged to this section appear first. **I have someone else** adds a student lead (also to verify).
- **None of these appeal** → two choices: **Show me 3–5 more** (a new batch; leads already shown aren't repeated) or **I have someone specific to look into** (a name or two, researched in the same card pattern).
- **Lead cap (per paper):** `RESEARCH_LEADS_MAX_PER_PAPER = 20` AI-researched leads per paper, counting every AI-suggested lead shown in Stage 1 and Stage 3 (`research_leads.origin = 'ai_suggested'`). Per paper, not per section, because the cost and the over-reliance risk grow per paper; a 5-section paper averages 4 per section. A batch that would pass the cap is trimmed to what's left (it can be fewer than 3 only for this last batch). The server enforces the cap.
- **At the cap: the search-it-yourself handoff.** The coach says: “I've pulled 20 leads for this paper, so it's your turn to search. Here's a search you can paste into Google. It's built from this section, your rubric and your story angle, so it'll keep finding new names.” The card shows:
  - a **ready-to-paste Google query**, built in code (no model) from the section title, up to 3 rubric terms (from `rubricRefs` and `required_styles`, the teacher's wording), the chosen style, and 1–2 key nouns from the story angle. Template: `"{style or rubric term 1}" {section key terms} ({rubric term 2} OR {rubric term 3}) {story-angle nouns} (interview OR book OR talk OR "case study")`. Quoted phrases are escaped, empty slots dropped, max 32 words (Google's limit). Example: `"servant leadership" pricing gross margin (profit OR "cost control") small business (interview OR book OR talk OR "case study")`;
  - when the rubric needs scholarly sources, a second line with the same terms as a Google Scholar link;
  - **Copy** and **Open in Google** (`https://www.google.com/search?q=…`, new tab) buttons, and a one-line tip: “Skim for people or organizations who come up more than once.”
  - **Bring back names:** a box for up to 5 names at a time (one per line, paste allowed here because these are names, not writing). The coach researches them in the same 3–5 card pattern (why it fits the rubric, `rubricRef`, **To verify**; it says so plainly when it knows nothing reliable about a name) and the student picks as before. Brought-back names (`origin = 'student_brought'`) don't count toward the cap and are unlimited; they still go through Stage 4 verification. Log `lead_cap_reached`, `search_prompt_copied`, `search_prompt_opened`, `student_names_brought`.
- The student picks **leaders** and a **style** (from the rubric's required styles; if none, the section's angle). Saved as `chosen_lead_ids`, `chosen_style`.
- **Never re-explain:** the outline card is prefilled from `section_decisions`: the claim field shows the student's own idea notes as a reference (not auto-filled into the claim), evidence notes are pre-listed from the chosen leaders, and the sentence plan offers rows linked to the ideas. Everything stays editable and student-written.

### 2A.4 SUMMARIZE and CONFIRM (Stage 4)

For each section, in roadmap order:

1. **Verify** the chosen leads: find the real source (open-access fetch, Unpaywall, or a student upload with the rights checkbox). If a lead can't be verified, drop it with “We couldn't verify this lead, so we dropped it,” and offer to go back to SEARCH for that section. No made-up quotes, ever.
2. **Source cards** (`MODEL_STRONG`, from verified source text only): **the claim it supports** (tied to a sentence-plan row the student chose), **a short quotable excerpt** (≤ 2 sentences, verbatim, with page/location), and **one line on why it fits your rubric** (with `rubricRef`). A ten-page op-ed becomes the one nugget the student needs. These are the existing study beats with three added fields.
3. **Audio** (optional, unchanged pricing): “Listen to these cards” uses the existing beats audio when the paper has audio unlocked; otherwise the existing $1.99 upsell. Never required.
4. **CONFIRM:** “Are you comfortable moving forward with {leader} and {style}?” Buttons **Yes, lock it in** / **Not yet**. Yes → `status = 'confirmed'`, `confirm_snapshot` (ideas, leaders, style, source cards, citation flags) saved, then the **LOGIC CHECKPOINT** (2A.4a) runs before ADVANCE. Not yet → back to SEARCH for this section (Stage 3 card via the edit drawer, logged). Log `section_confirmed`.
5. **LOGIC CHECKPOINT** (2A.4a), mandatory, never blocking.
6. **ADVANCE** to the next section.

### 2A.4a LOGIC CHECKPOINT (Colton, Nov 20, 2026, t41; revised t42: no hard stop, nothing blocks)

**Purpose.** A quick logic test of the section's claim, so the student hears clearly when an angle is debatable or doesn't hold up, while staying the writer. It is coaching, not a gate. It checks **logic and fit with the assignment's own terms**, never whether the coach shares the student's opinion.

**When it runs.** Once per section, automatically, right after **Yes, lock it in** saves the CONFIRM snapshot and before ADVANCE. It runs again only if the student edits the section's claim, idea notes, leader or style afterward (re-CONFIRM, a reopen, or **Revise my claim** / **Pick a new angle** / **Reframe it** below). It doesn't run for skipped sections until they're confirmed. Skeleton: “Checking the logic…” for up to 8 s; on timeout or error the result is **pass** (fail open).

**Input (from saved data only):** the section's idea notes (verbatim, with ids), chosen leader(s) and style, the sentence-plan claim/purpose notes, the story angle, the thesis, the section's `rubricRefs` with the teacher's verbatim text, and the assignment prompt text. Never other students' data.

**Tiers.**

| Tier | When | What the student sees | Blocks? |
|---|---|---|---|
| **pass** | The claim is defensible and fits the assignment, **or the coach is unsure** | Nothing beyond a quiet “Logic check ✓” on the section card; auto-ADVANCE | No |
| **moderate** | A reasonable reader could disagree, the interpretation is a stretch, or the evidence chosen doesn't clearly support it | A light card, **“A thought before you move on”**: the reason (≤ 2 sentences), up to 3 alternative angles as questions, and “Your call. You're the writer.” Buttons **Keep my angle** (primary) / **Adjust it** | No |
| **strong** | The claim **defies logic** (self-contradictory, or impossible to support with evidence) **or contradicts the assignment's own terms** (e.g. calling Hitler an objectively moral leader in a paper that asks students to evaluate leaders against ethical leadership principles) | A firm, clearly marked card (amber, ⚠ icon plus text label, not color-only): **“This claim doesn't hold up. We strongly suggest a different angle.”** Then the reason (≤ 2 sentences), **“Your assignment asks: ‘{verbatim teacher term}’”**, and up to 3 alternative angles as questions. A short note when a reframe works: “You can keep this subject if you change what you claim about it, for example by analyzing it critically.” Buttons: **Pick a new angle**, **Revise my claim**, **Reframe it**, and **Continue anyway** (always visible, same size as the others) | **No** |

**Actions (all non-blocking).**
- **Keep my angle** (moderate) → ADVANCE. Log `logic_moderate_kept`.
- **Adjust it** (moderate) / **Revise my claim** (strong) → opens that section's idea notes and claim/purpose notes (the student's words; paste allowed). Saving re-confirms and re-runs the check.
- **Pick a new angle** (strong) → shows the alternative-angle questions plus **Write my own**. The student's answer (≥ 10 words, paste allowed) is saved as a new idea note. The student can go back to SEARCH for this section if the leaders no longer fit (optional), then re-confirm, and the check re-runs.
- **Reframe it** (strong) → a short prompt, “Same subject, different claim. What do you actually want to argue about it?” The answer (≥ 10 words, paste allowed) is saved as an idea note, and the check re-runs. A critical-analysis reframe (e.g. Hitler's leadership as a cautionary example of charisma without ethics) should **pass**.
- **Continue anyway** (strong) → ADVANCE immediately, with no extra confirm dialog and no penalty. Sets `logic_student_choice = 'continued'`. The section card keeps a small, dismissible **“Logic flag”** note with a link to reopen the suggestion. The flag is listed once, non-blocking, in the Stage 6 checklist as an optional item (“You continued past a logic flag in {section}. Want another look?”). Log `logic_strong_continued` for SOP review.
- There is no cap on re-checks that would ever trap the student. After 3 strong results on the same section, the card adds “Still stuck? Your teacher can tell you if this angle works for the assignment,” and **Continue anyway** stays.

**Default to pass when unsure (enforced in code, not just the prompt).**
- `strong` is kept only when `confidence ≥ 0.80` **and** `citedTerm.quote` is a verbatim substring of the assignment text (for an assignment contradiction) **or** `logicFailure` names a concrete contradiction **and** `studentClaimRef.quote` is a verbatim substring of the student's notes. Otherwise it is downgraded to `moderate`.
- `moderate` is kept only when `confidence ≥ 0.60` and a valid `rubricRef` is present. Otherwise it is downgraded to `pass`.
- Downgrades log `logic_check_downgraded {from, to, reason}`.
- Prompt rules: an unpopular, political, religious or moral **opinion** that the student can support with evidence and that fits the assignment is **pass**, or **moderate** at most. A view never gets `strong` just because the coach disagrees with it. `strong` needs a logic failure or a conflict with the assignment's own words. Critical or cautionary analysis of a bad actor is legitimate and passes.

**Grok structured output** (`MODEL_STRONG`, `temperature: 0`, Zod `json_schema`, `lib/coaching/logicCheck.ts`, prompt version `logic_v1`):

```ts
// SOP: coaching only, never generate submission text
export const LogicCheckResult = z.object({
  tier: z.enum(["pass", "moderate", "strong"]),
  basis: z.enum(["none", "debatable_interpretation", "weak_support", "defies_logic", "contradicts_assignment"]),
  confidence: z.number().min(0).max(1),
  reason: z.string().max(240),             // <= 2 sentences, about the logic, addressed to the student; empty when pass
  citedTerm: z.object({                    // the rubric/assignment term the judgment rests on
    rubricRef: z.string(),                 // must exist on the confirmed assignment/roadmap
    quote: z.string().max(200),            // verbatim teacher text
  }).nullable(),
  studentClaimRef: z.object({              // which of the student's notes is being checked
    ideaId: z.string(),
    quote: z.string().max(160),            // verbatim substring of the student's note
  }).nullable(),
  logicFailure: z.string().max(160).nullable(), // strong + defies_logic only: the contradiction, named briefly
  alternativeAngles: z.array(z.object({
    question: z.string().max(160),         // a QUESTION, never a claim, thesis, or sentence to copy
    rubricRef: z.string(),
  })).max(3),
  reframeAvailable: z.boolean(),           // true when the same subject works with a different claim
});
```
Required by tier: `pass` → `reason` empty, no angles. `moderate` → `reason`, a `citedTerm` or section `rubricRef`, and 0–3 angles. `strong` → `reason`, `studentClaimRef`, `citedTerm` (assignment contradiction) or `logicFailure` (defies logic), and 1–3 angles.

**Guard rules (`lib/ai/guard.ts`, in addition to the shared hard limits).**
- Never write the student's sentences. `reason` and every `question` are rejected if they contain a rewrite cue (“you could write”, “try saying”, “instead, write”, “rephrase as”, “a better thesis would be”, “for example: ‘…’”), a quoted sentence the student could paste, or a run of more than 12 words copied from the student's notes.
- Every `alternativeAngles[].question` must end with “?”, be ≤ 25 words, have a valid `rubricRef`, and not start with a declarative stem (“X is…”, “Argue that…”).
- `citedTerm.quote` and `studentClaimRef.quote` must be verbatim substrings (after whitespace normalization) of the assignment text and the student's notes.
- No moralizing or verdict-on-the-person language (“you should be ashamed”, “offensive”, “wrong to think”). The reason is about logic and the assignment's terms.
- No grade or detector language (“this will fail”, “% chance”, “AI”).
- Reject → retry once → otherwise the result is `pass` with `logic_check_failed_open` logged. A broken check never shows a flag.

**Rate limit:** 10 checks per section per day, with a fail-open pass beyond that (logged).

**SOP review.** `/admin/sop` gets a **Logic checkpoints** panel: tier rates per paper and per assignment type, downgrade counts, fail-open counts, the share of strong flags where the student continued, and a review list of `logic_strong_continued` and `logic_flag_feedback` events. Each entry shows the cited term, the student's claim quote (≤ 160 chars), the reason and the student's choice, visible to admins only and never shown to other students. Reviewers tag each as **flag was right** / **coach overreached** to tune `logic_v1`. Nothing in review changes the student's paper.

**Flag feedback.** Every moderate or strong card has a small link, **“This doesn't seem right”**. It logs `logic_flag_feedback` (optional ≤ 200-char note) for SOP review and never changes the flow.

### 2A.5 Completion rules (replace the build prompt's Stage 4 rule)

Stage 4 completes when **every** roadmap section is confirmed, each section with a citation flag has ≥ 1 verified source card linked to it, and the student has written, for ≥ 3 source cards across the paper, one sentence in their own words on how they'll use it (the existing rule, kept).

### 2A.6 Data model — migration `supabase/migrations/0008_section_loop.sql` (additive, after 0007)

```sql
-- 0008_section_loop.sql
create table section_plans (                 -- DISSECT roadmap, one row per section (Stage 1)
  id uuid primary key default gen_random_uuid(),
  paper_id uuid not null references papers on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  section_key text not null,                 -- stable id used by Stage 3 cards and Stage 5 sections
  sort_order int not null,
  title text not null,
  kind text not null,                        -- intro | body | counter | conclusion | custom
  needs text not null,                       -- requirement description, <= 25 words
  rubric_refs jsonb not null default '[]',   -- ids from assignments.requirements
  required_sources jsonb not null default '{}',
  required_styles jsonb not null default '[]',
  target_words int,
  story_link text,
  provenance jsonb not null default '[]',
  source text not null default 'rubric',     -- rubric | default | student
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (paper_id, section_key)
);

create table section_decisions (             -- per-section loop state + saved decisions (Stages 2-4)
  id uuid primary key default gen_random_uuid(),
  section_plan_id uuid not null unique references section_plans on delete cascade,
  paper_id uuid not null references papers on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  loop_step text not null default 'probe',   -- probe | search | summarize | confirm | logic_check | confirmed (t41)
  probe_choice text,                         -- has_idea | wants_probes | warmup
  ideas jsonb not null default '[]',         -- [{ id, text (student verbatim), answerId }]
  search_terms jsonb not null default '[]',
  chosen_lead_ids uuid[] not null default '{}',
  chosen_style text,
  source_card_ids jsonb not null default '[]', -- [{ sourceId, beatIndex }]
  status text not null default 'open',       -- open | skipped | confirmed | reopened (t40)
  skipped_at timestamptz,                    -- set on skip; kept after resume for analytics (t40)
  -- LOGIC CHECKPOINT (t41/t42; non-blocking, no column gates anything)
  logic_tier text,                           -- pass | moderate | strong; null = not run yet
  logic_basis text,                          -- none | debatable_interpretation | weak_support | defies_logic | contradicts_assignment
  logic_confidence numeric(3,2),
  logic_reason text,
  logic_cited_term jsonb,                    -- { rubricRef, quote }
  logic_claim_ref jsonb,                     -- { ideaId, quote }
  logic_alternatives jsonb not null default '[]', -- [{ question, rubricRef }]
  logic_reframe_available boolean,
  logic_student_choice text,                 -- auto_pass | kept | adjusted | new_angle | revised | reframed | continued
  logic_attempts int not null default 0,
  logic_downgraded_from text,                -- set when code downgraded the model's tier
  logic_failed_open boolean not null default false,
  logic_prompt_version text,                 -- e.g. 'logic_v1'
  logic_checked_at timestamptz,
  logic_resolved_at timestamptz,
  logic_history jsonb not null default '[]', -- prior results on this section, newest last
  confirm_snapshot jsonb,
  confirmed_at timestamptz,
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table research_leads add column if not exists section_plan_id uuid references section_plans on delete set null;
alter table research_leads add column if not exists rubric_ref text;
alter table research_leads add column if not exists origin text not null default 'ai_suggested'; -- ai_suggested | student_added | student_brought (t40)
alter table research_leads add column if not exists batch_no int;                                -- 3-5 lead batches (t40)
create index on research_leads (paper_id, origin);
alter table drafts add column if not exists section_paste_meta jsonb not null default '{}'; -- t46: {sectionId: {pastedChars, typedChars, pasteRatio}}; never shown, never gates
alter table sources add column if not exists section_plan_id uuid references section_plans on delete set null;

create index on section_plans (paper_id, sort_order);
create index on section_decisions (paper_id);
-- RLS on both new tables: auth.uid() = user_id (same pattern as 0002).
```

**t40/t41 note:** 0008 was still a spec (not applied) when Colton's answers came in, so the skip, lead-origin and `logic_*` columns were folded into it. If 0008 has already been applied anywhere, ship the t40 lines and the `logic_*` columns as `0009_section_loop_t40_t41.sql` (`alter table section_decisions add column if not exists …`) instead. The lead cap is a count query (`origin = 'ai_suggested'`), not a stored counter; the outline export stores nothing.

Stage 3's `sections[].id` equals `section_plans.section_key`. Source-card fields (`claim`, `excerpt`, `location`, `whyFitsRubric`, `rubricRef`, `sentencePlanRowId`) are added to each item in `sources.beats` (JSON; Zod-validated, no SQL change). Reopening a confirmed section bumps `version` and logs `section_reopened`.

New `session_events`: `section_probe_choice`, `section_warmup_shown`, `section_idea_saved`, `section_search_shown`, `search_term_copied`, `section_lead_picked`, `section_style_picked`, `section_source_card_shown`, `section_lead_dropped`, `section_confirmed`, `section_not_yet`, `section_reopened`, `section_advanced`, `section_previewed`, `section_skipped`, `section_skip_reminder_clicked`, `section_unskipped`, `leads_more_requested`, `lead_specific_requested`, `lead_cap_reached`, `search_prompt_copied`, `search_prompt_opened`, `student_names_brought`, `outline_exported`, `logic_check_run` {tier, basis, confidence_bucket, attempt, latency_ms}, `logic_check_passed`, `logic_moderate_shown`, `logic_moderate_kept`, `logic_moderate_adjusted`, `logic_strong_shown` {basis}, `logic_new_angle_picked`, `logic_claim_revised`, `logic_reframe_submitted`, `logic_strong_resolved` {via, attempts}, `logic_strong_continued` {basis, attempts} (SOP review), `logic_check_downgraded`, `logic_check_failed_open`, `logic_flag_feedback`, `logic_stage6_reminder_opened`, `cleanup_flag_shown`, `cleanup_flag_accepted`, `cleanup_flag_fixed_by_student`, `cleanup_flag_dismissed`.

### 2A.7 Final outline export: Word (.docx) and PDF (Colton, Nov 20, 2026)

**Where:** an **Export outline** button (choose **Word** or **PDF**) on the Stage 3 outline screen, the Stage 4 summary screen, and in the Stage 5–6 side panel. It is labeled **Final outline** once every section is confirmed (Stage 4 complete). Before that the export works but is stamped “In progress: {n} sections not finished” and lists skipped sections.

**Generation (no model call):** `GET /api/papers/[paperId]/outline/export?format=docx|pdf` (Node runtime, owner-only through RLS, paid or free-first-paper access as usual). One pure function `buildOutlineExport(paperId)` assembles an `OutlineExportModel` (Zod-typed) from saved rows only: `assignments`, `papers`, `section_plans`, `section_decisions`, Stage 3 outline cards, `sources`/source cards. Two renderers read that same model:
- **.docx:** the `docx` npm package. Real Word headings (Heading 1 per section) and lists so the student can edit it and screen readers can follow it.
- **PDF:** `@react-pdf/renderer` `renderToBuffer`, a server-side component, US Letter, system-safe font.
The file is streamed with `Content-Disposition: attachment; filename="{paper-title-slug}-outline.{docx|pdf}"` and never stored. Rate limit: 20 exports per paper per hour. Log `outline_exported { format, final }`.

**Contents (in this order), with nothing else:**
1. Header: paper title, course, due date, citation style, length target (from the confirmed checklist; “Not specified” where blank).
2. Story angle (the one the student picked or wrote) and the student's thesis.
3. For each roadmap section, in order: section title, the teacher's rubric criterion names for it (`rubricRefs` resolved to the teacher's wording), target words, the student's **idea notes** (verbatim), chosen leader(s) and style, then the **sentence plan** rows: role, the student's purpose note, and the **citation flag** (`needsCitation`, with the a/b/c suffix when assigned).
4. Under each flagged row, the linked **source excerpts**: the verbatim quote (≤ 2 sentences) with page/location, from verified sources only.
5. A **Sources found** list of raw metadata (author, year, title, publisher/site, URL or DOI, page). It is not a formatted reference list, since the student formats citations.
6. Footer on every page: “Built from your own notes in RetainWrite. Contains no AI-written paper text.”

**Excluded on purpose (no AI prose):** coach questions, AI “why it fits” lines, AI `needs` summaries, transition suggestions, warm-up prompts, unverified leads, and any model output except verbatim source excerpts. The export code reads only an allow-list of student-authored or verbatim-source fields, and a test fixture with canary strings in every AI field asserts none appear in either file.

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
2. **Moves (exactly 3 required).** One at a time: show the challenge, a short note ("Answer in your own words; there's no right answer, we're looking for your thinking"), textarea (paste allowed), min **30 words**, soft max 200.
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
Student writes the refined thesis in a textarea (paste allowed) with the prompt: "Now, in one or two sentences, write the claim you'd defend after thinking through those challenges."

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

6. **Per-section PROBE pass** (section 2A.2), after the refined thesis.

**Stage 2 complete when:** cluster set, 3 moves answered (or flagged stuck), a refined thesis saved (passed or flagged-advance), and every roadmap section has a PROBE result (ideas saved). Skipped sections block completion until finished. With the section-first loop, Stages 3–4 work on section 1 can happen before Stage 2 is complete (section 2A.1).

---

## 4. STAGE 3 — Outline

### 4.1 Structure
Target length: prefer the confirmed Stage 1 assignment card (`assignments.requirements.length` — explicit words if present, otherwise the page-derived estimate at 275 words per double-spaced page; ranges use the midpoint). If the card is missing or marked "Not specified," fall back to parsing `papers.required_length` (`/(\d[\d,]*)\s*(words?|pages?)/i`; same 275 and midpoint rules). If still unparseable, ask the student for a number of words or pages in a small inline field; default 1,000 words.

| Target words | Body sections (N) |
|---|---|
| < 1,500 | 3 |
| 1,500–3,000 | 4 |
| > 3,000 | 5 |

**Roadmap first (Nov 20, 2026):** the cards are the confirmed Stage 1 roadmap sections (`section_plans`), in that order, with the teacher's names. The default below applies only when the rubric/prompt names no sections; the Counterargument & Rebuttal card is included only when the assignment requires it or the paper type is argumentative (default kept, **unconfirmed by Colton** as of Nov 20, 2026). Each card runs the SEARCH step (section 2A.3) and is prefilled from that section's saved decisions.

Default outline = **Intro** + **Body 1…N** + **Counterargument & Rebuttal** + **Conclusion** (N + 3 cards). Intro is fixed first, Conclusion fixed last; Body cards and the Counterargument card can be reordered between them. The student may remove one body card only if N > 3 (floor of 3 body cards).

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
- **Recorded quietly:** each paste → `session_events` `paste` `{section_id, chars, words, source:'paste'|'import'}` (counts only, no text). The client tracks pasted spans (offsets) and typed/spoken characters per section, and on section submit saves `pasted_chars`, `typed_chars` and `paste_ratio` into the section's draft state (`drafts.section_paste_meta` jsonb `{sectionId: {pastedChars, typedChars, pasteRatio}}` in 0008, spec-only; else 0009). Dictation counts as typed (Stage 1 spec 8.1a). This metadata is never shown to the student and never gates anything.
- **Supportive suggestion (Colton, Nov 20, 2026, t46; replaces the old “own writing” question):** when a single **paste** (not a .docx/.txt import of the student's own draft file) inserts ≥ **80 words** into the Stage 5 editor or the Stage 6 revision editor, show an inline note just under the editor. It is not a modal, doesn't take focus, is announced politely (`aria-live="polite"`), and has a small ℹ︎ info icon:
  > We suggest using your own writing so your tone is better understood and we can serve you better.
  - A single **Got it** text button / ✕ dismisses it. It **needs no answer** and has no yes/no or multiple-choice buttons. It doesn't block typing, saving, submitting or moving sections. It fades after the next save if not dismissed.
  - **Frequency: at most once per session** (per paper, per browser session; `sessionStorage` key `rw_paste_suggestion_{paperId}`). Once per session rather than per section, so a student who drafts in a doc and pastes section by section sees it once, not five times.
  - Log `paste_suggestion_shown` and `paste_suggestion_dismissed` (counts only). **No answer is recorded**, because there is nothing to answer.
  - **Removed:** the old modal question, its three options (wrote it myself / partly / from a source), the `paste_confirm` event and any stored choice, the quote-and-cite reminder tied to the third option (citation help still lives in Stage 6 citation integrity), and the immediate on-paste style comparison. Pasted text is evaluated with its section at submit like any other text (section 7); the existing ≥ 120-word pasted-span rule there stays.
- **Never** blocks, accuses, or asks the student to explain themselves; never shows the word "detector". Stage 1 voice-sample answers also accept paste (Colton t44), recorded only as quiet metadata with no suggestion.

### 5.3 Per-section gate (sequential in outline order)
Sections unlock in outline order; Conclusion unlocks after all others are done. Done sections can be reopened (a new revision of that section, feedback re-runs).

1. **Topic sentence first.** The section shows the outline card (claim, evidence notes, explanation note: *the student's own notes, never generated text*). A single-line input: "Write the first sentence of this section." Min 8 words, max 45. `MODEL_FAST` checks `{relatesToClaim: bool, probe}` (fallback: lexical overlap with the card's claim). If not related: probe, max 2, then "I'm stuck — flag" lets them continue. Log `section_topic_submitted`.
2. **Draft feedback pattern (philosophy section 4; shown first, before the coach prompts).** Built in code from `section_decisions` (no model call needed):

   > Here are the {n} ideas we captured for this section based on what you told me. We chose **{leader}**, we chose **{style}**.
   > Idea one: {idea note}
   > Idea two: {idea note}
   > Write those ideas in your own words.

   - **Idea notes** are the student's own words: a verbatim phrase from their saved ideas/purpose notes, or a ≤ 12-word fragment with no sentence-ending punctuation (guard-enforced). Never a finished sentence, never a topic sentence written for them. "Idea one" is marked as the **topic-sentence idea** (it maps to the sentence-plan `claim` row).
   - Under each idea: the linked source excerpt (≤ 2 sentences, verbatim, cited by location) when that idea has a citation flag.
   - **Transition suggestions** between ideas and into the next section: a relationship label (e.g. *contrast*, *cause → effect*, *example*, *build on*, *zoom out*) plus 2–4 connective words or short phrases (≤ 3 words each, from a fixed bank: “however,” “by contrast,” “because of this,” “for example,” “building on that”). Never a full transitional sentence. The student mixes freely or ignores them.
   - Footer line: “The outline is the map; your voice is the road.”
3. **Coach prompts** (`MODEL_FAST`, generated once per section): up to 3 *questions* tied to the card ("Which of your evidence notes will you lead with, and what do you want the reader to notice?"), plus:
   - an **evidence checklist** built in code from Stage 4: the evidence notes from the card; any sources linked to them; for each, the source title and the beat's short passage (≤ 2 sentences, it is quoted source text) plus the student's own "how I'll use it" sentence from Stage 4. Checkboxes are for the student's own tracking.
   - a reminder: the student's `explanationNote` verbatim.
   - the card's **sentence plan** as a map (roles + the student's own purpose notes + citation flags, each flag showing its linked Stage 4 excerpt or "needs a source"), plus the "Your raw material" bank. The student writes every sentence; the plan is not text to copy.
   - **No paragraph text, no example sentences.**
4. **Body textarea unlocks** below the locked topic sentence (editable later). Student writes. Autosave every 5 s to `stage_progress.data.sections[id].text` (no AI call on autosave). Live word counter against the minimum.
5. **Minimum length per section:** `min = clamp(round(0.5 × targetWords / (N + 3)), 60, 200)` words (e.g. 1,200 target, 3 body → 100 words). Intro/conclusion use `max(60, 0.75 × min)`.
6. **Submit section** → feedback (`MODEL_STRONG`, ~30 s budget; skeleton loader). Output (Zod): 
   ```ts
   { supportsThesis: 'yes'|'partly'|'no';
     evidenceUsed: { note: string; present: boolean }[];   // one per outline evidence note
     explanationPresent: boolean;
     questions: string[];   // ≤ 3, coach questions only
     praise: string[];      // ≤ 2, specific ("Your second sentence names the study clearly.")
     styleCheck: MismatchResult }  // computed in code, section 7
   ```
   Show as a card: "What's working", "Questions to think about", "Evidence you planned vs. used", style note (amber, if tripped).
7. **Student marks done.** Enabled when: (hard) section ≥ minimum words, the locked topic sentence is still the first sentence of the text, and feedback was viewed. (Soft; never blocking) anything feedback flagged; flagged items are copied into `stage_progress.data.carryFlags` for Stage 6. If `evidenceUsed` shows 0 present on a body section, the student must write a ≥ 15-word "Why I haven't used evidence yet" note (saved, carried to Stage 6) before marking done.
8. **Unlock next section.**

On section submit, the light-cleanup flags (section 6.1 item 12) may also appear for that section, as flags only; the full pass runs in Stage 6.

**Stage 5 complete when:** every section is done and the assembled draft is ≥ 300 words. On completion: assemble sections in order (blank line between; no generated connective text), compute metrics, run mismatch on the whole draft, save `drafts` version 1, log `stage_completed`.

Side panel (all sections): outline (collapsible), Stage 4 source cards, the story angle and thesis pinned, and each section's confirmed decision (leader, style, ideas). No "write this for me" control anywhere.

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
| 12 | Mechanics: light cleanup + read-aloud pass | Auto flags + self | **Light cleanup (Nov 20, 2026, narrow definition):** the app flags spelling, grammar, and citation-format issues inline; the student accepts or fixes each one themselves. One-click **Accept** is offered only for a single-word spelling fix, a single-word grammatical form (e.g. "was" → "were"), or a citation-format fix (punctuation, order, capitalization, a/b/c suffix). Everything else is a flag with a short explanation of the rule, and the student edits. **Never** synonyms, reordering, merging/splitting sentences, tone changes, or any rephrase; guard-enforced. Spelling uses a dictionary check in code; grammar and citation format may use `MODEL_FAST` returning `{span, issue, rule, fix?}` where `fix` must pass the single-word/format rule or is dropped. Then the existing "Read my draft aloud" (`speechSynthesis`) and tick "I read it aloud and fixed what sounded wrong" | All flags accepted, fixed, or dismissed + student ticks |

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
- **Trigger rule:** warn when **≥ 2 tells** (from different signals; sentence length and reading grade count as separate signals) **or ≥ 1 strong signal**. If the sample is under 200 words, the sentence-length signal's "strong" level is treated as a plain tell (so it needs a second signal), to reduce noise from short samples. **Paste-weighted baseline (Colton, Nov 20, 2026, t44/t45):** baseline metrics are typed-weighted (`w = 1 − 0.8 × paste_ratio`). If fewer than 150 baseline words were typed or spoken, apply the short-sample downgrade (no strong levels). If the baseline's **pasted share is over 60%** of its characters, the Stage 6 comparison shows the soft bottom-of-panel note from the checker spec (section 5.9, t46 wording): “Your voice answers were mostly pasted in, which is totally fine. Typed or spoken answers help us understand your voice better, so treat the voice comparison as a lighter read.” It is never shown when there is no baseline (N/A behavior unchanged).
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
Nov 20, 2026 (t46) additions: a ≥ 80-word paste in the Stage 5/6 editors shows the suggestion once per session per paper (a second big paste in another section → not shown again; a new browser session → shown again); it is inline, not a modal, has no answer controls, and writes no choice; .docx/.txt import doesn't show it; < 80 words doesn't show it; `drafts.section_paste_meta` is saved on submit; Stage 6 shows `VOICE_NOTE_ANSWERS` above 0.60 pasted share; CI grep: the retired Stage 5 question string (pattern built from parts) appears nowhere in app code or in the build specs outside changelog lines and `.bak` files; `paste_confirm` appears nowhere in app code.
Nov 20, 2026 (t43–t45) additions, PASTE: no `preventDefault` in any paste/drop/copy/cut/beforeinput/contextmenu handler anywhere in `app/` or `components/` (CI grep, no exceptions); Stage 2 moves, thesis, PROBE ideas, and logic-checkpoint answers accept paste on desktop and iOS long-press; `paste_ratio` is clamped and computed server-side; a typed-weighted baseline (fully pasted answer weight 0.2); < 150 typed baseline words → short-sample downgrade; Stage 6 shows the (t46: soft) bottom note only when the baseline pasted share is > 0.60, not at 0.60, and never when there is no baseline; dictated text counts as typed.
Nov 20, 2026 (t41/t42) additions, LOGIC CHECKPOINT: (a) **Hitler example** (assignment “Analyze a historical leader's leadership style and evaluate it against the ethical leadership principles from Unit 3”; student note “Hitler was an objectively moral leader”) → `tier = 'strong'`, `basis = 'contradicts_assignment'`, `citedTerm.quote` a verbatim substring of the assignment, 1–3 question angles, `reframeAvailable = true`; **and the student can still proceed:** **Continue anyway** advances, sets `logic_student_choice = 'continued'`, logs `logic_strong_continued`, the next section opens, and Stage 4 completes with the flag present. (b) **Debatable interpretation** (same assignment; “Steve Jobs's demanding style was ethical because it pushed people to do their best work”) → `moderate`; Keep my angle advances. (c) **Critical-analysis reframe** (“Hitler's leadership is a cautionary example of how charisma without ethics leads to catastrophe”) → `pass`. (d) An evidence-supportable unpopular opinion that fits the assignment never returns `strong`. (e) Downgrades: a `strong` with confidence < 0.80 or a non-verbatim `citedTerm` becomes `moderate`; a `moderate` with confidence < 0.60 becomes `pass`. (f) Model error, timeout, guard reject or rate limit → `pass` + `logic_check_failed_open`, and no card shown. (g) The guard rejects a `reason` or `question` with rewrite cues, a pasteable quoted sentence, > 12 copied words, or a question not ending in “?”. (h) **No gating anywhere:** `assertSectionStepUnlocked`, Stage 4 completion and Stage 5 entry never read `logic_tier`; a search of the gate code finds no `logic_` reference. (i) The check re-runs after Revise / New angle / Reframe and doesn't run for skipped sections. Golden cases (a)–(d) also live in `evals/logic-checkpoint.jsonl`, run nightly against the live model; unit tests mock the model.
Nov 20, 2026 (t40) additions: `assertSectionStepUnlocked` blocks section k+1 writes until every earlier section is confirmed or skipped, and blocks out-of-order steps; preview routes write nothing; skip sets `status='skipped'` and shows the reminder bar with a working jump-back link on every Stage 2–4 screen; Stage 5 stays locked while any section is skipped; lead batches have 3–5 items (fewer only for the final capped batch); “Show me 3–5 more” never repeats a lead; the 21st AI-suggested lead per paper is rejected server-side and the search-prompt card appears; the query builder output is ≤ 32 words, uses only section/rubric/story terms and escapes quotes; brought-back names don't count toward the cap and are `to_verify`; .docx and PDF exports contain the allow-listed fields only (canary test), are stamped In progress when sections are unfinished, and are not stored.
Nov 20, 2026 (t39) additions: roadmap drives Stage 3 cards; Stage 2 completes only with every section probed; warm-up shown before any lead when the student freezes; leads/cards/probes without a valid `rubricRef` are rejected; idea notes pass the no-finished-sentence rule; transition suggestions contain only bank phrases; CONFIRM writes `confirm_snapshot` and Stage 4 completes only when every section is confirmed; Stage 5 draft view renders from `section_decisions` with no re-asked questions; light-cleanup `fix` rejected unless single-word or citation-format; guard rejects "% AI"-style phrasing.
Nov 20, 2026 additions: sentence-plan gate (≥ 2 rows per body card, evidence rows flagged), guard rejects AI-written `purposeNote`, `rawMaterial` phrases must be verbatim substrings, citation clustering flag, a/b/c suffix detection (same author + year without matching suffixes flagged in APA; short titles in MLA), Stage 2 receives `storyAngle`.
Cluster/slot verification (non-substring slot rejected), `pickMoves` determinism and absolute-word rule, thesis deterministic checks, thesis max-attempt flag-advance, outline section count by length, approval gating, section minimum formula, paste threshold, mismatch table (each tell, strong, two-tell, exclusions, min length, short-sample downgrade), checklist completion logic, feedback auto-grant conditions and rate limit, dedupe hash, `grant_feedback_credit` idempotency, guardian gating, AI output guard (rewrite phrases rejected), AI fallback paths.

---

## 13. Changelog

- **Nov 20, 2026 (t46):** Per Colton, replaced the Stage 5 ≥ 80-word paste modal question with a supportive, dismissible inline suggestion (once per session per paper; no answer, no buttons, no recorded choice; quiet paste metadata only; `paste_confirm` removed). Decision 9 updated, decision 35 added, section 5.2 rewritten. The Stage 6 voice note now uses the soft `VOICE_NOTE_ANSWERS` wording.
- **Nov 20, 2026 (t43/t44/t45):** Paste is now allowed in every text input across Stages 1–6 (Colton t44 removed the voice-answer exception from t43). Decision 5 is superseded, and the section 2 paste policy, Stage 2 boxes, PROBE, the logic-checkpoint inputs and 5.2 are updated. Decision 34 adds the paste-ratio mitigation, a typed-weighted baseline, and (t45) the bottom-of-panel “Voice was not reliably determined” note in Stage 6 when the baseline is more than 60% pasted.
- **Nov 20, 2026 (t41/t42):** Added Colton's mandatory per-section LOGIC CHECKPOINT after CONFIRM, before ADVANCE (decision 33, section 2A.4a). Tiers: pass / moderate / strong. Per t42 it never blocks: strong is a firm flag with alternative angles as questions and a **Continue anyway** button, logged for SOP review. Defaults to pass when unsure. Adds a Grok schema, guard rules, `logic_*` columns on `section_decisions` (folded into spec-only 0008), events and tests. t41's hard-stop tier was dropped before shipping.

- **Nov 20, 2026 (t40):** Applied Colton's answers. Section-first loop with read-only browse-ahead, a skip flag, a persistent bottom reminder and a jump-back link, and loop-span gate reconciliation (decision 25, section 2A.1). Lead sets are 3–5 with “more” / “someone specific” options, a 20-per-paper cap and a Google search-prompt handoff (decision 30, section 2A.3). Final outline exports as .docx and PDF (decision 31, section 2A.7). Voice minimum is now 200 words (decision 32). Counterargument and light-cleanup defaults marked unconfirmed by Colton. 0008 gained `section_decisions.skipped_at`, the `skipped` status, and `research_leads.origin` / `batch_no`.
- **Nov 20, 2026 (t39):** Coaching philosophy folded in: per-section loop in Stages 2–4, philosophy hard limits in the guard, Stage 5 draft feedback pattern, narrow light cleanup, `0008_section_loop.sql`.
