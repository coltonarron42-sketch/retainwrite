# RetainWrite — Stage Specs & Cross-Stage Decisions (companion to `retainwrite-cursor-build-prompt.md`)

Paste this into Cursor **after** the build prompt. Where this doc conflicts with the build prompt, **this doc wins** (see "Overrides to the build prompt") for Stages 2–6 and cross-stage rules. **Stage 1 intake is specified in `retainwrite-stage1-intake-spec.md`; that doc wins on Stage 1 behavior.** The six-stage structure is unchanged (intake, stance interview, outline, sources and audio beats, draft, revise and feedback); only Stage 1's internals change. Table names, stage order, price constants and existing env var names are unchanged.

**Governing document:** `retainwrite-coaching-philosophy.md` (v1.6, Nov 20, 2026) governs every stage, probe, summary, and interaction. It wins over this doc on philosophy; this doc still holds the implementation detail for Stages 2–6. The section-by-section loop (DISSECT → TEACH → PROBE → SEARCH → SUMMARIZE → CONFIRM → LOGIC CHECKPOINT → ADVANCE; TEACH added by Colton t47) is placed on the stages in section 2A, and the Stage 2 coaching behavior inside it (THE LESSON, teach-then-ask, concept vs. instance, ranked leads + wildcard, the memory-forward path for personal prompts) is specified in section 2B. **t57 (PROVISIONAL):** the interaction design layer (one beat at a time, progress ghost, zoom-outs, jump-to-edit) and the hidden-draft scaffold across Stages 1–5 are specified in section 2C.

LOCKED RULES (hold everywhere): coaching only (the app never writes submission prose: no paragraphs, no thesis, no rewrites; AI produces questions, probes, checklists, feedback, and source summaries for study; the student writes every submitted sentence). Style metrics are for feedback/revision coaching only. Mismatch warnings name specific tells and never use detector-evasion framing. Every stage is gated on real student input. Every session is logged to `session_events`. Add `// SOP: coaching only, never generate submission text` at every AI call site.

---

## 0. Decisions made in this doc

1. Stage 2 uses 8 topic clusters plus a `general` fallback; the student picks, an LLM suggests, and the student's pick wins (the LLM is used only when the student skips and its confidence is ≥ 0.6).
2. Stage 2 runs exactly 3 coach moves per paper (weighted by cluster, 3 distinct types), and the student writes ≥ 30 words in reply to each; up to 2 optional extra moves.
3. Coach question slots ({claim}, {key_term}, {group}, {evidence_type}) are only ever filled with verbatim substrings of the student's own text, enforced in code; otherwise a slot-free fallback phrasing is used.
4. Refined thesis passes only if it meets 5 criteria (arguable, specific scope, reason, survives a counterargument, differs from the original or is defended); max 3 attempts, then the student may advance with a flag (never a hard dead end).
5. ~~Stage 2 text boxes are paste-blocked~~ **Superseded Nov 20, 2026 (Colton t44): paste is allowed in every text input in every stage**, including Stage 1 voice answers and Stage 2 boxes. Paste is recorded quietly as metadata (`paste_ratio`) and never blocks (decision 34).
6. Stage 3 outline = the sections of the student-confirmed Stage 1 roadmap (`section_plans`). When the rubric/prompt names no sections, the roadmap defaults to Intro + N body sections + Conclusion, with N = 3 (< 1,500 words), 4 (1,500–3,000), 5 (> 3,000); N = 3 if length is unknown. (Updated Nov 20, 2026: ~~Counterargument/Rebuttal is included only when the assignment requires it or the paper type is argumentative — default kept, unconfirmed by Colton~~ **Confirmed by Colton, t47: a Counterargument/Rebuttal section appears only when the rubric/assignment asks for one** (decision 43); Stage 1 spec section 16 item 5.)
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
25. (Nov 20, 2026) **Where the loop lives.** DISSECT ends Stage 1 (a student-confirmed roadmap). The per-section loop runs in **Stages 2–4**: **PROBE** in Stage 2 (after the whole-paper stance work), **SEARCH** in Stage 3 (while each outline card is built), **SUMMARIZE + CONFIRM** in Stage 4, followed by the mandatory, non-blocking **LOGIC CHECKPOINT** (decision 33). **Updated Nov 20, 2026 (Colton, t40): section-first order.** Each section runs PROBE → SEARCH → SUMMARIZE → CONFIRM → LOGIC CHECKPOINT before the next section opens for work. Later sections (and the rest of the workflow, including Stages 5–6) can be **previewed read-only**. A section can be **skipped**; a skipped section counts as finished-for-now so the next one opens, and it stays flagged with a persistent reminder and a jump-back link until it is confirmed. To make this work, the per-stage gate is relaxed **only inside Stages 2–4** (the "loop span"): Stages 3 and 4 open once Stage 2's whole-paper stance work (cluster, 3 moves, refined thesis) is done, and the work inside them is gated per section and per step. All other stage gates are unchanged: Stage 1 → 2, and Stage 5 still opens only when every section is confirmed (no skipped sections left). Section 2A.1. **t47:** a **TEACH** step now runs in Stage 2 right before PROBE (order teach → probe → search → summarize → confirm; decision 38, section 2B.3).
26. (Nov 20, 2026) **Saved per-section decisions are the skeleton.** Each section's ideas (student's words), chosen leaders, chosen style, and verified sources are saved in `section_decisions` and prefill the Stage 3 outline card, the Stage 5 draft view, and Stage 6 checks. The student never re-explains anything.
27. (Nov 20, 2026) **Stage 5 draft feedback pattern:** section by section, the captured ideas as short notes (never finished sentences), the chosen leader and style, the source excerpts, and transition suggestions (relationship + connective words only). The student writes in their own words (section 5.3).
28. (Nov 20, 2026) **Light cleanup is narrow:** flag spelling, grammar, and citation-format issues for the student to accept or fix; never rephrase (section 6.1 item 12). One-click Accept only for single-word and citation-format fixes — default kept, **unconfirmed by Colton** as of Nov 20, 2026.
29. (Nov 20, 2026) **Stay inside the rubric:** every probe, lead, source card, angle, and suggestion carries a `rubricRef` to the confirmed assignment or roadmap; the guard rejects outputs without one. Imagination (angles, reframed questions, alternative framings) is allowed inside those bounds.
30. (Nov 20, 2026, Colton t40) **Research leads: 3–5 at a time, 20 per paper.** Every lead set shows 3–5 options, never more than 5. If none appeal: **Show me 3–5 more** or **I have someone specific to look into**. The cap is **per paper** (not per section): after 20 AI-researched leads across Stage 1 and Stage 3, the coach stops suggesting and hands the student a ready-to-paste Google search prompt built from the section, rubric terms and story angle, then researches the names they bring back in the same 3–5 card pattern (uncapped, always `to_verify`). Section 2A.3. **t47:** each batch is ranked by rubric match and adds one **Outside the box** wildcard, which counts toward the 20 (decision 40, section 2B.6).
31. (Nov 20, 2026, Colton t40) **Final outline exports as Word (.docx) and PDF**, generated in code from saved student data; structure, idea notes, source excerpts and citation flags only, no AI prose. Section 2A.7.
32. (Nov 20, 2026, Colton t40) **Stage 1 voice minimum is 200 words across the answers given** (skipped answers allowed), with 2 answers ≥ 40 words kept and no separate personal-question requirement. The Stage 6 mismatch baseline uses whatever Stage 1 collected; the short-sample downgrade in section 7 still applies below 150 words (since t44, **typed** words; Stage 1 spec 8.1a). **t47:** Colton's "200 words total across skipped answers" is read as across all answers given, skipped answers allowed (decision 44).
33. (Nov 20, 2026, Colton t41 + t42) **Per-section LOGIC CHECKPOINT, mandatory and never blocking.** After each section's CONFIRM is saved and before ADVANCE, the coach runs a logic check on the section's claim against the story angle, thesis and the assignment's own terms. There are three tiers: **pass**, **moderate** (light feedback when an interpretation is debatable; the student decides) and **strong** (a firm, clear flag with suggested edits and alternative angles as questions when a claim defies logic or contradicts the assignment). **Nothing in the checkpoint gates anything:** every tier ends with the student able to move on, including **Continue anyway** on a strong flag. The student is always the writer, even of a weaker paper. When unsure, the result is **pass**. t41's "hard stop" tier was removed by Colton in t42 and never shipped. Section 2A.4a. **t47:** Colton's opener and red-alert copy added (decision 42).
34. (Nov 20, 2026, Colton t43 → t44 → t45) **Paste is allowed in every text input, in every stage.** t43 kept voice answers paste-blocked; t44 removed that exception. **Consequence:** the Stage 6 voice comparison's baseline may include pasted text. **Mitigation (never blocks, never warns during writing):** per-answer `paste_ratio` metadata, a typed-weighted baseline, and the short-sample downgrade when fewer than 150 baseline words were typed or spoken. **t45/t46:** when the baseline's pasted share is over 60%, the Stage 6 comparison (and the checker report) shows one kind, factual note at the very bottom, below the scores, in the soft t46 wording (checker spec 5.9). **Superseded t51:** the note now follows the hybrid rule (decision 46). Spoken input (OS dictation or in-app speech-to-text) counts as typed. No note when there's no baseline. Stage 1 spec 8.1a; checker spec 5.9.
35. (Nov 20, 2026, Colton t46) **Stage 5 paste: a supportive suggestion, not a question.** The old ≥ 80-word paste modal is replaced by one dismissible inline note, “We suggest using your own writing so your tone is better understood and we can serve you better.”, shown at most once per session per paper, with no answer, no buttons beyond Got it, and no recorded choice. Only quiet paste metadata is kept. **Voice note:** one consistent soft style on every surface (checker spec 5.9). Stage 6 uses “Your voice answers were mostly pasted in, which is totally fine. Typed or spoken answers help us understand your voice better, so treat the voice comparison as a lighter read.”

36. (Nov 20, 2026, Colton t47) **Lesson-first hierarchy.** Every assignment is analyzed for THE LESSON (what it's trying to teach, why the paper is assigned, what the student should learn), extracted in Stage 1 with the parse, shown and editable on the checklist and roadmap, and stored per paper in `papers.lesson`. All coaching spends more effort elaborating the lesson than the examples used to show it ("connect leadership styles to leaders you admire" → the lesson is leadership styles; the leaders serve it). Section 2B.1.
37. **[LOCKED, Colton t58 — the three-path routing from proven muscles; the 13-type taxonomy additions (`paper_genre`, per-type intro variants) stay PROVISIONAL]** (Nov 20, 2026, Colton t47) **Three routing paths.** Paper-level `papers.prompt_type` = `lesson` (default) / `personal_experience` / `mixed`, classified in Stage 1 and changeable by the student; section-level `section_plans.mode` = `lesson` / `memory`. Inside lesson sections, each answer is tagged as naming a **concept** (→ teach) or an **instance** (→ highlight reel). Memory sections run the memory-forward path. Section 2B.2.
38. (Nov 20, 2026, Colton t47) **TEACH step and teach-then-ask.** The loop is now DISSECT → **TEACH** → PROBE → SEARCH → SUMMARIZE → CONFIRM → LOGIC CHECKPOINT → ADVANCE. TEACH runs in Stage 2 before PROBE: a short concept card (definition, 3–5 qualities, how it shows up) and "Which part interests you most?". It's skippable (**I know this one**) and never blocks. On a vague concept answer anywhere ("I like servant leadership"), the coach affirms warmly, gives the concise breakdown, then asks which aspect interests the student most. Teach cards are study material, never exported or offered for copying. Section 2B.4.
39. (Nov 20, 2026, Colton t47) **Concept vs. instance (style vs. leader, generalized).** Concepts (styles, theories, frameworks, devices) get the textbook treatment. Instances (named people, organizations, cases, works, events) get a highlight reel of 1–2 concrete moves that match the style, marked **To verify** with no quotes, then always "Want me to search for references on how {instance} was a {concept}?". Accepted searches seed SEARCH with a student-added lead (not counted toward the cap). Section 2B.5.
40. **[LOCKED, Colton t58: a wildcard in every lead batch, including every "Show me 3–5 more" refresh; wildcard safety flags controversial figures with a neutral "Reported, not confirmed" note instead of blocking, and the student can override (2B.6 as amended t58)]** (Nov 20, 2026, Colton t47) **Ranked leads plus one wildcard.** Each lead batch is 3–5 leads ranked by rubric match (including how well they show the lesson concept) plus exactly one **Outside the box** wildcard with a one-line why. It's never preselected and never offensive for its own sake; controversial picks get a neutral note such as "although controversial"; stricter rules apply for under-18 students; it's omitted when no safe one fits. **The wildcard counts toward the 20-per-paper cap** and is dropped first when a batch is trimmed at the cap. The 32-word Google/Scholar search-prompt handoff is unchanged. Section 2B.6.
41. **[LOCKED (sensitivity guideline per decision 47), Colton t58]** (Nov 20, 2026, Colton t47) **Memory-forward path for vague/personal prompts.** MIRROR the prompt's emotional words ("What does magical mean to you?"), then on a stall show gentle, scripted memory-trigger chips (a little milestone like losing a tooth, getting hurt, a family member starting or losing a job, moving houses, plus lighter ones; every line rewritten as a gentle invitation in t52, decision 47), each with **Not this one** and a **Skip these** option. It never pushes for trauma disclosure, and a supportive safety note shows if risk language appears. SEARCH is optional (off by default unless the rubric requires sources), the summary is a memory card in the student's own words, CONFIRM asks about "this moment," and the logic checkpoint is light (pass or moderate prompt-fit only, never strong). How common these prompts are, and at which grade levels, is an open TODO for Paper Coach Research (no statistics invented). Section 2B.8.
42. (Nov 20, 2026, Colton t47) **Logic checkpoint copy and outcomes confirmed.** Opener: "I want to do a logic check. Do you feel good about this?" (**Yes, check it** / **Let me tweak it first**; the check runs in the background, so neither choice blocks). Three outcomes: no flag, light constructive feedback (moderate), or strong pushback as a **red alert**, "We would not recommend moving forward.", with **Continue anyway**. No hard stops. Moderate for debatable takes, strong for indefensible ones (e.g. Hitler as objectively moral in a leadership paper). When unclear, let it through. The 80/60 downgrade rules and the `logic_strong_continued` logging stay. Section 2B.9 (amends 2A.4a).
43. (Nov 20, 2026, Colton t47) **Counterargument only when the rubric asks for one** (confirms the earlier default, now tighter: the "or argumentative paper type" inclusion is dropped). DISSECT adds a Counterargument & Rebuttal section only when the assignment requires it; Stage 6 item 9 and the logic checkpoint apply only then. The Stage 2 counterargument *moves* still run for every paper, because they stress-test the student's own claim and don't add a section.
44. (Nov 20, 2026, Colton t47) **Voice capture confirmed.** 200 words total across the answers given; "across skipped answers" is read as across all answers with skips allowed (t40). The quiet safeguard down-weights mostly-pasted answers (paste_ratio, 0.2 weight for fully pasted) and favors typed or spoken ones. No warnings during the flow. End-of-results notes: ~~> 60% pasted → `VOICE_NOTE_ANSWERS`; ≥ 95% pasted → `VOICE_NOTE_ANSWERS_ALL`~~ **superseded by the t51 hybrid rule (decision 46).** Section 2B.10; checker spec 5.9.
45. (Nov 20, 2026, Colton t48) **Stage 6 (and Stage 5) voice-mismatch warning becomes a gentle voice nudge.** The amber "This reads differently from your sample" warning and its "I've reworked it" / "This is my writing" buttons are retired. It now reads: **“This part sounds a little different from your usual voice. Want to read it aloud and make it sound more like you?”**, with a collapsed **What we noticed** list that still names the specific tells. Buttons: **Make it sound like me** (opens the voice-tips/rework panel: highlights the sentences, read-aloud for that part, and coaching tips, never rewrites) and **Keep it as is** (dismisses; logged neutrally; no note, no penalty, no accusation). Same trigger and thresholds (section 7). Events `mismatch_warned` / `mismatch_response` are replaced by `voice_nudge_shown` / `voice_nudge_rework_opened` / `voice_nudge_kept`. Section 7 and 6.1 item 5.
46. **[LOCKED rule, Colton t58; tier numbers remain tunable starting values]** (Nov 20, 2026, Colton t51) **Hybrid voice-note threshold.** The bottom-of-results voice note no longer depends on paste % alone. It weighs `naturalWords` (typed + dictated/spoken words across the whole paper's conversational answers; pasted words excluded) together with `pastedShare`. Tiers [PROVISIONAL]: ≥ 600 → no note at any paste %; 200–599 → lighter-read note only if > 60% pasted; 80–199 → lighter-read note regardless of paste %; < 80 → stronger note regardless of paste %. New strings `VOICE_NOTE_ANSWERS_SHORT`, `VOICE_NOTE_ANSWERS_LOW` (replaces `VOICE_NOTE_ANSWERS_ALL`) and the sample equivalents. The public checker applies the same tiers to the writing sample. The Stage 6 baseline now uses the same counted answers. Section 2B.10; checker spec 5.9.
47. **[LOCKED, Colton t58]** (Nov 20, 2026, Colton t52) **Memory-trigger sensitivity guideline.** Every personal-prompt memory trigger reads as a caring coach gently opening a door: the memory is offered softly ("Maybe…"), never as a yes/no interrogation; the student is invited to reflect; and the line connects back to the assignment. Model line: “A family member started or lost a job. Do you want to expand on it so we can explore how it might help your paper?” The whole bank is rewritten, with a CI/guard test for the phrasing. **Not this one**, **Skip these** and the safety note stay. Section 2B.8.
48–60, 73–81. **Moved (t56/t58):** the drafting-stage decisions (48–59, first drafted here in t53) and the new per-type intro decision 60, plus the t58 Drafting decisions 73–81, live in `retainwrite-stage3-draft-spec.md` section 0 (statuses there). Not duplicated here.
61. **[DECIDED, Colton t58] Interaction design layer, Stages 1–5: one beat at a time** (one question or frame per beat from Stage 1; zoom-out from Stage 2). One question or frame on screen at a time, about a single section or beat, each with a beat address. Layout only; step order and gates are unchanged. Behind `FEATURES.interactionLayer = false`. Section 2C.1.
62. **[PROVISIONAL, t57] Progress ghost.** A low-key paper skeleton (intro, body sections, counter only if required, conclusion) fills in from saved data in the background, from the end of Stage 1 (after DISSECT) through Stage 5. Only short labels and the student's own words; no AI or hidden-draft text; no model call. Section 2C.2.
63. **[DECIDED, Colton t58 — amended] Zoom-out milestones.** **t58:** zoom-outs come **after each section only**; per-frame peeks are **off by default** (`SKELETON_PEEKS = false`); in Drafting the milestone pop-up shows the skeleton as a background ghost readable on **Review all**, then **Ready for section {n}?** / **Do you want to review?** (Drafting spec 11A, decision 77). Original t57 text: No zoom-out in Stage 1. From Stage 2 on: a full-outline zoom-out after the thesis is saved and after each section's loop completes (after the logic checkpoint, any tier), replacing the ADVANCE transition; a non-modal "peek" after each finished sentence/paragraph frame in Stages 3–5; full zoom-out per section in Stage 5. Skipped sections get no zoom-out. Section 2C.3.
64. **[SUPERSEDED in part, Colton t58] End-of-Stage-3 payoff.** **t58:** the big payoff moves to the **end of Drafting** (full outline of intro, body, support, conclusion in the student's own sentences, "Look at everything you wrote."; Drafting spec decision 79). The outline stage keeps only a light "Your outline is complete." line on its last milestone pop-up. Original t57 text: At outline approval: "Look at everything you built." with the whole outline in the student's words and a stat row ({n} sections · {k} sources · {w} words of your own ideas). The "holy crap, I just wrote a long paper" feeling is internal design intent only; student copy is clean. A parallel "Here's your full draft" view ends Stage 5. Section 2C.4.
65. **[DECIDED, Colton t58; details PROVISIONAL] Jump-to-edit and Ready for next.** (t58: in Drafting, strict in-order; a jump edits an earlier section and returns to the current beat.) Any section in the zoom-out (or ghost) is clickable: confirmed → CONFIRM summary with Edit (existing reopen rules), in progress → its current beat, locked future → read-only preview. A saved resume beat and a "Back to where you were" chip return the student to the exact beat. Ready for next = ADVANCE. Jumps never bypass a gate. Section 2C.6.
66. **[PROVISIONAL, t57; amended t58: per-frame peeks are off by default (`SKELETON_PEEKS = false`), zoom-outs after each section only] Same pattern in Stages 3–5.** Zoom into one sentence frame (outline sentence-plan row), one source/excerpt row, or one paragraph; work it; peek out to see the paper grow. Fits 2A/2B, the logic checkpoint (unchanged, runs before the zoom-out, never reads hidden-draft signals), the Stage 3 outline gate, and the draft spec's intro loop. Sections 2C.3, 2C.5.
67. **[DECIDED, Colton t58 — amended] Hidden-draft scaffold.** **t58:** the coach generates its own **full paper** server-side from the captured Q&A (the same method as the owner's original test run) as an invisible answer key: it checks structure and pacing, whether idea three lands where it should, whether sentence six carries too much weight, and shapes the idea-by-idea read-back. Never shown; default and only planned mode is full prose (`structure` stays as an outage/cost fallback switch). Original t57 text: The coach privately generates its own version of the paper from the captured ideas (`MODEL_STRONG`, server-only) to check structure, pacing and idea placement. Regenerated per milestone (section complete, outline approved, draft section done) only when the ledger changed; cap 15 per paper; never in Stage 1. `HIDDEN_DRAFT_MODE = 'prose'` (default, per Colton) or `'structure'` (signals only, no prose). Behind `FEATURES.hiddenDraft = false`. Section 2C.7.
68. **[PROVISIONAL, t57] Hidden-draft storage and retention.** Server-side only in `private.hidden_drafts` (not an exposed API schema; RLS with no policies; service role only); one row per paper, overwritten on regeneration; text purged 30 days after the draft stage completes or 90 days after creation, whichever is first, and immediately on paper/account deletion. Section 2C.7.
69. **[LOCKED rule, Colton t58; thresholds PROVISIONAL] Hidden-draft leak guard H1–H8.** Code isolation (server-only module, lint-blocked imports); code-built readbacks; a pre-send 5-gram and near-verbatim similarity check against the hidden draft (excluding words the student wrote) on every student-facing string in Stages 2–5; never exported (Word/PDF/data export/email); never in any API, RSC or HTML response; never fed into other prompts; never logged; canary tests across a full run. draftGuard gains D9. Section 2C.8.
70. **[DECIDED, Colton t58] Readback shaping, student's voice only.** The hidden draft only reorders the student's own ideas or flags them ("This idea might land better in {section}." with Move it / Keep it here; pacing and gap flags), max 2 flags, confidence ≥ 0.7, never blocking. It never supplies or rephrases words and is never a voice baseline, mismatch input, check or grade. Section 2C.7.
71. **[PROVISIONAL, t57] Mobile and accessibility.** Mobile: segmented progress strip, full-screen zoom-out sheet, sticky Ready for next and Back chip, peeks never over the keyboard. Accessibility: labeled nav region, dialog semantics with focus management, one polite milestone announcement, no color-only status, full keyboard use, reduced motion honored. Sections 2C.10–2C.11.
72. **[PROVISIONAL, t57] Data and events.** Spec-only migration `0011_interaction_layer.sql` (`private.hidden_drafts`, `papers.payoff_shown_at`; 0009 reserved, 0010 = drafting muscle), `resumeBeat` in `stage_progress.data` (Zod), a daily purge cron, and new events (`skeleton_zoomout_shown`, `section_jump`, `ready_for_next`, `hidden_draft_generated`, `hidden_draft_leak_blocked`, and others). Sections 2C.12–2C.13.
82. **[LOCKED, Colton t58] Prior-batch statuses locked.** (1) A wildcard in every lead batch, including refreshes (decision 40). (2) Wildcard safety flags controversial figures with a neutral "Reported, not confirmed" note rather than blocking; allegations aren't confirmations; the student can override (2B.6). (3) The all-pasted voice note uses the hybrid threshold of natural (typed/spoken) words plus paste share (decision 46; tier numbers tunable). (4) The memory-trigger sensitivity guideline, with Colton's line verbatim: "a family member started or lost a job — do you want to expand on it so we can explore how it might help your paper?" (decisions 41, 47; 2B.8 bank line unchanged). (5) Prompt-type routing built from proven muscles (decision 37); taxonomy additions stay provisional. Drafting-stage decisions 73–81 (t58) live in `retainwrite-stage3-draft-spec.md` section 0.

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
- New `session_events.event` names: `cluster_selected`, `move_shown`, `move_answered`, `thesis_attempt`, `thesis_flag_advanced`, `outline_section_checked`, `outline_approved`, `outline_edited`, `section_topic_submitted`, `coach_asked`, `section_feedback`, `section_done`, `paste`, `paste_suggestion_shown`, `paste_suggestion_dismissed`, `voice_nudge_shown`, `voice_nudge_rework_opened`, `voice_nudge_kept` (t48; replace the retired `mismatch_warned` / `mismatch_response`), `checklist_item`, `revision_saved`, `feedback_submitted`, `feedback_auto_granted`, `feedback_queued`, `feedback_reviewed`, `audio_generated`, `guardian_requested`, `guardian_granted`, `ai_fallback`, `email_failed`.
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

Source: `retainwrite-coaching-philosophy.md` (governing). The story angle (Stage 1, Pick your story) is the spine; the roadmap (Stage 1, DISSECT) lists the sections; the loop runs per section underneath both. Every loop screen shows **THE LESSON** ("What you're learning: …", t47, 2B.1), the story angle and the section's `needs` + `rubricRefs` in a header strip. **t47:** the Stage 2 coaching behavior inside the loop (TEACH, teach-then-ask, concept vs. instance, ranked leads + wildcard, memory-forward path) is specified in section 2B, which wins over this section where they differ.

### 2A.1 Placement

| Loop step | Stage | When | Saved to |
|---|---|---|---|
| DISSECT | 1 (end) | After the early stance | `section_plans` (+ `mode`, `concept`, t47) |
| TEACH (Colton, t47) | 2 | Start of each section, before PROBE; lesson mode: concept card + "Which part interests you most?"; memory mode: MIRROR (2B.4, 2B.8). Skippable, never blocks | `section_decisions.teach_*` |
| PROBE | 2 | After the 3 moves and the refined thesis, once per roadmap section | `section_decisions.ideas`, `probe_choice` |
| SEARCH | 3 | Per section, as its outline card is built | `section_decisions.search_terms`, `research_leads` (to verify), `chosen_lead_ids`, `chosen_style` |
| SUMMARIZE | 4 | Per section | `sources`, `sources.beats`, `section_decisions.source_card_ids` |
| CONFIRM | 4 | End of each section | `section_decisions.status = 'confirmed'`, `confirmed_at`, `confirm_snapshot` |
| LOGIC CHECKPOINT (Colton, t41/t42) | 4 | Right after CONFIRM is saved, before ADVANCE; mandatory, non-blocking | `section_decisions.logic_*` (2A.6) |
| ADVANCE | 2, 3, 4 | Next section in roadmap order | `section_decisions.loop_step` |

**Order: section-first (Colton, Nov 20, 2026; replaces the per-stage passes).** After Stage 2's whole-paper stance work, the loop takes one roadmap section at a time through TEACH (t47) → PROBE → SEARCH (with its outline card) → SUMMARIZE → CONFIRM → LOGIC CHECKPOINT (non-blocking, 2A.4a), then ADVANCEs. The left rail still shows Stages 2, 3 and 4, each with per-section progress dots, so the student sees where each section sits.

**Reconciling with the stage gates (the loop span).**
- Stage 2 has two parts. **2a, whole paper:** cluster, 3 moves, refined thesis, gated exactly as before. **2b, TEACH + PROBE** (TEACH added t47), runs per section inside the loop.
- `assertStageUnlocked(paperId, 3|4)` passes once 2a is complete (instead of once Stage 2 is complete). Every write inside Stages 2b–4 also calls `assertSectionStepUnlocked(paperId, sectionKey, step)`, which passes only when (1) every earlier section is `confirmed` or `skipped`, and (2) the section's earlier steps are done (teach → probe → search → summarize → confirm; t47 added teach, which is done once explored, skipped, `not_applicable`, or mirrored; in memory mode search auto-completes as `not_needed`). It fails with 409 `section_locked` and names the section to finish first.
- **Stage completion is unchanged in meaning:** Stage 2 completes when 2a is done and every section has a PROBE result; Stage 3 when every section has its SEARCH result and complete card **and** the whole outline is approved (the Approve button appears once the last section's card is complete); Stage 4 when every section is confirmed (2A.5). A skipped section blocks those completions until it is finished.
- **Stage 5 and 6 gates are unchanged:** Stage 5 opens only when Stage 4 is complete, so no section can still be skipped when drafting starts.

**Browse ahead (read-only preview).** The student can open any later section, and the Stage 5–6 screens, to see the workflow: the section's title, rubric criteria and target length, the steps it will go through, and anything already saved. All inputs and buttons are disabled, with the note “Finish or skip {earlier section} to work on this one” and a **Go to {current section}** link. Preview never writes data. Log `section_previewed`.

**Skip a section.** Every loop screen has **Skip this section for now** (in an overflow menu, under the main buttons). Skipping saves `status = 'skipped'`, `skipped_at`, and the step it was on (`loop_step` stays where it stopped), and opens the next section for work. Skipped sections get:
- a **Skipped** badge in the roadmap rail;
- a **persistent reminder bar pinned to the bottom** of every Stage 2–4 screen (and the locked Stage 5 entry screen) for as long as any section is skipped: “You skipped {Section title}. It needs to be finished before you start your draft.” with a **Go back to {Section title} →** link that jumps straight to that section's saved step. With 2 or more skipped sections the bar lists each, in roadmap order, each with its own link;
- when the student returns, the section resumes at its saved step; it becomes `open` again (`skipped_at` kept for analytics). Log `section_skipped`, `section_skip_reminder_clicked`, `section_unskipped`.

The last section's CONFIRM never auto-advances into Stage 5 while a section is skipped; it routes to the first skipped section instead.

### 2A.2 PROBE (Stage 2)

After the refined thesis (Stage 2a), the loop starts at the first roadmap section. **t47:** each section now opens with TEACH (2B.4; MIRROR in memory mode, 2B.8) and then comes here. In lesson mode the first PROBE prompt is exactly:

> “Do you already have an idea of how you want this section to go, or do you want me to ask some probing questions so we can start finding research?”

Buttons: **I have an idea** / **Ask me some questions**.

- **I have an idea** → textarea (paste allowed), “Tell me the idea in a few words or a few sentences.” No minimum beyond 5 words. Up to 2 follow-ups only if it's vague (`specific=false`).
- **Ask me some questions** → `MODEL_FAST` asks 2–4 probing questions, one at a time, each tied to the section's `rubricRefs` and the story angle (≤ 30 words each).
- **Freeze / “I don't know” / empty twice** → **warm-up questions** first (scripted bank: “What's one thing you already know about this?” / “Who's someone you've seen do this well?” / “What part of this makes you curious?”). Never dump sources cold. Only after a warm-up answer does SEARCH get a framework.
- **t47 response patterns:** a vague answer that names a concept gets **teach-then-ask** (affirm → breakdown → "Which part interests you most?", 2B.4); a named leader/person/org/case gets a **highlight reel** of 1–2 moves and the search offer (2B.5). Memory-mode sections use the memory opener and trigger chips instead (2B.8).
- Every answer is saved verbatim (`ideas[]`, each with `answerId`) and added to the raw-material bank. Paste is allowed, as everywhere (decision 34).
- Skip: **Skip this section for now** saves `status = 'skipped'` (section 2A.1); the next section opens for work and the skipped one stays flagged with the bottom reminder bar and jump-back link. Stage 2 completes only when every section has a PROBE result.

### 2A.3 SEARCH (Stage 3)

For each section, alongside its outline card:

- **Search terms** the student would naturally run (3–6, built from the section's ideas, the rubric's required styles/themes, and the story angle), with a **Copy** button and a short note on why each term helps. Teaching the search is the point: show the reasoning (“We added ‘servant leadership’ because the rubric asks for a named style”).
- **Cross-reference** against `requiredStyles` / `requiredSources`: a small checklist of what the rubric needs in this section and which leads cover it.
- **3–5 leads** (people, organizations, cases, examples, works), never more than 5 ranked leads at once, **ranked by rubric match** (t47), each with a one-line why-it-fits-the-rubric, a `rubricRef`, a `lessonLink`, and the badge **To verify**, **plus exactly one Outside the box wildcard** below them (t47, 2B.6; counts toward the cap; omitted when no safe one fits). No quotes. Stage 1 accepted leads tagged to this section appear first. **I have someone else** adds a student lead (also to verify).
- **None of these appeal** → two choices: **Show me 3–5 more** (a new batch; leads already shown aren't repeated) or **I have someone specific to look into** (a name or two, researched in the same card pattern).
- **Lead cap (per paper):** `RESEARCH_LEADS_MAX_PER_PAPER = 20` AI-researched leads per paper, counting every AI-suggested lead shown in Stage 1 and Stage 3 (`research_leads.origin = 'ai_suggested'`), **wildcards included** (t47; when a batch is trimmed at the cap, the wildcard is dropped first). Per paper, not per section, because the cost and the over-reliance risk grow per paper; a 5-section paper averages 4 per section. A batch that would pass the cap is trimmed to what's left (it can be fewer than 3 only for this last batch). The server enforces the cap.
- **At the cap: the search-it-yourself handoff.** The coach says: “I've pulled 20 leads for this paper, so it's your turn to search. Here's a search you can paste into Google. It's built from this section, your rubric and your story angle, so it'll keep finding new names.” The card shows:
  - a **ready-to-paste Google query**, built in code (no model) from the section title, up to 3 rubric terms (from `rubricRefs` and `required_styles`, the teacher's wording), the chosen style, and 1–2 key nouns from the story angle. Template: `"{style or rubric term 1}" {section key terms} ({rubric term 2} OR {rubric term 3}) {story-angle nouns} (interview OR book OR talk OR "case study")`. Quoted phrases are escaped, empty slots dropped, max 32 words (Google's limit). Example: `"servant leadership" pricing gross margin (profit OR "cost control") small business (interview OR book OR talk OR "case study")`;
  - when the rubric needs scholarly sources, a second line with the same terms as a Google Scholar link;
  - **Copy** and **Open in Google** (`https://www.google.com/search?q=…`, new tab) buttons, and a one-line tip: “Skim for people or organizations who come up more than once.”
  - **Bring back names:** a box for up to 5 names at a time (one per line, paste allowed here because these are names, not writing). The coach researches them in the same 3–5 card pattern (why it fits the rubric, `rubricRef`, **To verify**; it says so plainly when it knows nothing reliable about a name) and the student picks as before. Brought-back names (`origin = 'student_brought'`) don't count toward the cap and are unlimited; they still go through Stage 4 verification. Log `lead_cap_reached`, `search_prompt_copied`, `search_prompt_opened`, `student_names_brought`.
- The student picks **leaders** and a **style** (from the rubric's required styles; if none, the section's angle). Saved as `chosen_lead_ids`, `chosen_style`.
- **Memory-mode sections (t47):** SEARCH is off by default (`search_status = 'not_needed'`) with a **Want to look anything up?** link; it's `required` only when the rubric requires sources (2B.8).
- **Never re-explain:** the outline card is prefilled from `section_decisions`: the claim field shows the student's own idea notes as a reference (not auto-filled into the claim), evidence notes are pre-listed from the chosen leaders, and the sentence plan offers rows linked to the ideas. Everything stays editable and student-written.

### 2A.4 SUMMARIZE and CONFIRM (Stage 4)

For each section, in roadmap order:

1. **Verify** the chosen leads: find the real source (open-access fetch, Unpaywall, or a student upload with the rights checkbox). If a lead can't be verified, drop it with “We couldn't verify this lead, so we dropped it,” and offer to go back to SEARCH for that section. No made-up quotes, ever.
2. **Source cards** (`MODEL_STRONG`, from verified source text only): **the claim it supports** (tied to a sentence-plan row the student chose), **a short quotable excerpt** (≤ 2 sentences, verbatim, with page/location), **one line on why it fits your rubric** (with `rubricRef`), and (t47) a **lessonLink** naming the concept it shows (2B.7). Memory-mode sections get a **memory card** in the student's own words instead (2B.8). A ten-page op-ed becomes the one nugget the student needs. These are the existing study beats with three added fields.
3. **Audio** (optional, unchanged pricing): “Listen to these cards” uses the existing beats audio when the paper has audio unlocked; otherwise the existing $1.99 upsell. Never required.
4. **CONFIRM:** “Are you comfortable moving forward with {leader} and {style}?” (memory mode, t47: “Are you comfortable moving forward with this moment?”) Buttons **Yes, lock it in** / **Not yet**. Yes → `status = 'confirmed'`, `confirm_snapshot` (ideas, leaders, style, source cards, citation flags) saved, then the **LOGIC CHECKPOINT** (2A.4a) runs before ADVANCE. Not yet → back to SEARCH for this section (Stage 3 card via the edit drawer, logged). Log `section_confirmed`.
5. **LOGIC CHECKPOINT** (2A.4a), mandatory, never blocking.
6. **ADVANCE** to the next section.

### 2A.4a LOGIC CHECKPOINT (Colton, Nov 20, 2026, t41; revised t42: no hard stop, nothing blocks)

**Purpose.** A quick logic test of the section's claim, so the student hears clearly when an angle is debatable or doesn't hold up, while staying the writer. It is coaching, not a gate. It checks **logic and fit with the assignment's own terms**, never whether the coach shares the student's opinion.

**Opener (Colton, t47).** The coach first says **“I want to do a logic check. Do you feel good about this?”** with **Yes, check it** / **Let me tweak it first** (2B.9). The check runs in the background meanwhile, so neither button blocks or waits.

**When it runs.** Once per section, automatically, right after **Yes, lock it in** saves the CONFIRM snapshot and before ADVANCE. It runs again only if the student edits the section's claim, idea notes, leader or style afterward (re-CONFIRM, a reopen, or **Revise my claim** / **Pick a new angle** / **Reframe it** below). It doesn't run for skipped sections until they're confirmed. Skeleton: “Checking the logic…” for up to 8 s; on timeout or error the result is **pass** (fail open).

**Input (from saved data only):** the section's idea notes (verbatim, with ids), chosen leader(s) and style, the sentence-plan claim/purpose notes, the story angle, the thesis, the section's `rubricRefs` with the teacher's verbatim text, and the assignment prompt text. Never other students' data.

**Tiers.**

| Tier | When | What the student sees | Blocks? |
|---|---|---|---|
| **pass** | The claim is defensible and fits the assignment, **or the coach is unsure** | Nothing beyond a quiet “Logic check ✓” on the section card; auto-ADVANCE | No |
| **moderate** | A reasonable reader could disagree, the interpretation is a stretch, or the evidence chosen doesn't clearly support it | A light card, **“A thought before you move on”**: the reason (≤ 2 sentences), up to 3 alternative angles as questions, and “Your call. You're the writer.” Buttons **Keep my angle** (primary) / **Adjust it** | No |
| **strong** | The claim **defies logic** (self-contradictory, or impossible to support with evidence) **or contradicts the assignment's own terms** (e.g. calling Hitler an objectively moral leader in a paper that asks students to evaluate leaders against ethical leadership principles) | A firm, clearly marked **red alert** card (t47: red border, ⚠ icon plus the text label “Logic alert”, not color-only): **“We would not recommend moving forward.”** then “This claim doesn't hold up as written.” Then the reason (≤ 2 sentences), **“Your assignment asks: ‘{verbatim teacher term}’”**, and up to 3 alternative angles as questions. A short note when a reframe works: “You can keep this subject if you change what you claim about it, for example by analyzing it critically.” Buttons: **Pick a new angle**, **Revise my claim**, **Reframe it**, and **Continue anyway** (always visible, same size as the others) | **No** |

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
- **Counterargument (confirmed t47, decision 43):** never flag a missing counterargument and never suggest adding one unless the rubric/assignment requires it.
- **Memory sections (t47):** `mode: 'memory'` clamps the tier to `pass | moderate` (prompt fit only; logged `logic_memory_clamped`), never `strong` (2B.8).
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
  loop_step text not null default 'teach',   -- teach (t47) | probe | search | summarize | confirm | logic_check | confirmed (t41)
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
-- t47 additions (lesson, prompt type, section mode/concept, teach/memory/highlight fields, lead rank + wildcard): see section 2B.11; fold them in here.
```

**t47 note:** the section 2B.11 lines are folded into 0008 too (still spec-only). If 0008 has already been applied, ship the t40/t41/t44/t47 lines together as `0009_section_loop_followups.sql`.

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

## 2B. Stage 2 coaching spec: the lesson-first section loop and research (Colton, Nov 20, 2026, t47)

Source: Colton's Stage 2 brainstorm (t47). It's the core coaching muscle and sits under the governing philosophy (v1.4). It **adds** to sections 2A and 3; where the two disagree on Stage 2–4 coaching behavior, this section wins. Hard limits hold throughout: coaching only, the student writes every submitted sentence, AI output is study material or questions, and nothing is framed around detectors. Decisions 36–44.

### 2B.0 What changed, in one table

| Topic | Before t47 | Now (t47) |
|---|---|---|
| What the coach teaches toward | Rubric criteria per section | **THE LESSON** of the paper, extracted once per paper and stored (`papers.lesson`). Every probe, teach card, lead and source card serves the lesson first; examples serve the lesson (2B.1) |
| Loop order | DISSECT → PROBE → SEARCH → SUMMARIZE → CONFIRM → LOGIC CHECKPOINT → ADVANCE | DISSECT → **TEACH** → PROBE → SEARCH → SUMMARIZE → CONFIRM → LOGIC CHECKPOINT → ADVANCE. TEACH runs in Stage 2 (2b), right before PROBE (2B.3) |
| Vague answers ("I like servant leadership") | Up to 2 thin-answer probes | **Teach-then-ask:** affirm warmly → concise breakdown of the concept → "Which part interests you most?" (2B.4) |
| Concepts vs. named examples | Treated the same | **Concept** (style, theory, framework, device) gets the textbook treatment. **Instance** (a person, organization, case, text, event) gets a 1–2 move highlight reel, then "Want me to search for references…?" (2B.5) |
| Lead sets | 3–5, unranked | 3–5 **ranked by rubric match**, plus exactly **one wildcard** labeled **Outside the box** with a one-line why. The wildcard counts toward the 20-per-paper cap (2B.6) |
| Prompt types | One path | Paper-level `prompt_type`: `lesson` / `personal_experience` / `mixed`. Personal-experience sections run **memory-forward**: MIRROR → memory triggers, research optional, light checkpoint (2B.2, 2B.8) |
| Logic checkpoint | Auto-run, amber strong card | Same tiers and rules, plus Colton's opener **"I want to do a logic check. Do you feel good about this?"** and a **red alert** strong card, **"We would not recommend moving forward"**, with **Continue anyway** (2B.9) |
| Counterargument | Default, unconfirmed | **Confirmed:** only when the rubric/assignment asks for one (decision 43) |
| Voice | > 60% pasted → soft note | **t51 hybrid rule:** the note depends on how many natural (typed/spoken) words were captured across the paper, not paste % alone: ≥ 600 → none; 200–599 → lighter note only if > 60% pasted; 80–199 → lighter note; < 80 → stronger note [PROVISIONAL]. No warnings during the flow (2B.10) |

### 2B.1 THE LESSON (lesson-first hierarchy)

**Rule.** Every assignment is analyzed for THE LESSON: what the assignment is trying to teach, why the student is writing this paper, and what they're meant to learn. All coaching spends more effort elaborating the lesson than any example used to drive it home. Example: "Connect leadership styles to leaders you admire; give three examples" → the lesson is **leadership styles** (what they are, how they show up in action). The three leaders serve the lesson; they aren't the point.

**When it's extracted.** In Stage 1, as part of the assignment parse (Stage 1 spec 4.6), shown as one line on the confirm checklist ("What this assignment is teaching"), editable, and finalized with the DISSECT roadmap (Stage 1 spec 3.4b). Stored on `papers.lesson` (2B.11). Re-extracted only if the student re-confirms a changed assignment.

**Shape (Zod `Lesson`, `MODEL_STRONG`, `reasoning_effort: "low"`, prompt version `lesson_v1`):**
```ts
// SOP: coaching only, never generate submission text
export const Lesson = z.object({
  statement: z.string().max(200),        // what the paper teaches, <= 30 words, phrased as a learning goal ("How leadership styles show up in real leaders' choices")
  why: z.string().max(160),              // why the paper is assigned, <= 25 words
  concepts: z.array(z.object({           // the things to learn, from the prompt/rubric wording
    term: z.string().max(60),            // verbatim or near-verbatim teacher term, e.g. "servant leadership", "leadership styles"
    rubricRef: z.string(),
  })).max(6),
  examplesServe: z.string().max(160).nullable(), // how the requested examples serve the lesson, e.g. "three leaders illustrate the styles"
  evidence: z.object({ file: z.string(), page: z.number().nullable(), quote: z.string().max(240) }), // verbatim prompt/rubric text it rests on
  emotionalTerms: z.array(z.string().max(40)).max(4), // personal-experience prompts only: verbatim feeling words ("magical") for MIRROR (2B.8)
  confidence: z.number().min(0).max(1),
});
```
- `evidence.quote` and every `emotionalTerms[]` item must be verbatim substrings of the confirmed assignment text (guard). `statement`/`why` describe the **learning goal**, never draft content, never a thesis, never a sentence the student could submit (finished-sentence rule applies: `statement` is a noun phrase or "How/Why…" phrase, no subject + verb claim).
- Fallback (model error / guard reject twice / confidence < 0.5): `statement` = the confirmed assignment prompt's first requirement sentence, verbatim; `concepts` = `requiredStyles` + rubric criterion names; `source = 'fallback'`. The student can edit it on the checklist or roadmap screen.
- Personal-experience prompts: `concepts` is usually empty and `statement` describes what the prompt asks the student to share and reflect on ("Three moments from your summer and why they felt magical").

**How the lesson weights coaching (prompt rules + code):**
1. Every Stage 2–4 system prompt receives `lesson.statement` and `lesson.concepts` and the rule: *"Teach the lesson first. Examples exist to show the lesson. When you talk about an example, connect it back to the concept."*
2. **TEACH** (2B.4) always teaches a lesson concept before any example is discussed.
3. **Highlight reels** (2B.5) are capped at 2 moves and must name the concept each move shows.
4. **Lead ranking** (2B.6) scores how clearly each lead illustrates the section's lesson concept as part of rubric match.
5. **Source cards** (2B.7) add a `lessonLink` line: which concept the excerpt shows.
6. **Stage 5 draft view** shows the section's lesson concept above the leader and style, so the student writes about the concept through the example.
7. Ratio check (code, soft): in a TEACH or highlight-reel response, concept text must be ≥ 50% of the coach's words; otherwise retry once with "focus on the concept", then accept (logged `lesson_ratio_retry`). Never blocks the student.

The roadmap header strip (2A) shows **"What you're learning: {lesson.statement}"** above the story angle on every loop screen.

### 2B.2 Prompt-type routing (three paths)

**Paper level.** `papers.prompt_type`:
- `lesson` — academic/rubric prompts with a concept to learn (default).
- `personal_experience` — vague or personal prompts with no rubric lesson to dissect ("Tell us about your summer vacation: three things that stood out and made it magical").
- `mixed` — a lesson paper that also asks for personal experience (e.g. "connect a leadership style to a time you led a group").

Classified with the lesson in Stage 1 (`promptType`, `promptTypeConfidence`). Signals for `personal_experience`: second-person "tell us about your / describe a time you / reflect on your" framing, no named concepts, no required sources, emotional or experiential words. Confidence < 0.6 → `lesson` (the existing path). The student sees it on the DISSECT screen as a small line ("This looks like a personal-story assignment. We'll help you remember and tell it." / "This assignment teaches {concept}…") with **Change** (pick one of the three). The student's choice wins and is logged (`prompt_type_changed`).

**Section level.** Each roadmap section gets `section_plans.mode`: `lesson` or `memory`. `lesson` papers → all `lesson`; `personal_experience` → all `memory` (intro/conclusion included); `mixed` → sections whose `needs` asks for a personal moment are `memory`, the rest `lesson`. The student can flip a section's mode on the roadmap.

**Answer level (inside a lesson section).** Every student answer in TEACH/PROBE is tagged by `MODEL_FAST` (`MentionTag`, 2B.5) as naming a **concept**, an **instance**, both, or neither, and whether it's **vague**. That decides the response pattern:

| Path | Trigger | Coach pattern |
|---|---|---|
| 1. Concept | Section has a lesson concept, or the student names one (often vaguely) | TEACH card / teach-then-ask (2B.4) |
| 2. Instance | The student names a specific leader/person/org/case/text | Highlight reel (1–2 concrete moves matching the style) → offer to search (2B.5) |
| 3. Memory | Section `mode = 'memory'` | MIRROR the prompt's emotional words → memory triggers on stall → memory card (2B.8) |

### 2B.3 Section flow (end to end)

Front of the paper (Stage 1, unchanged except the lesson): dissect the assignment → summarize the sections → roadmap up front (DISSECT, Stage 1 spec 3.4b), now headed by THE LESSON and showing each section's mode.

Then, **for each section, in roadmap order (section-first, 2A.1):**

| # | Step | Stage | Lesson mode | Memory mode | Saved to |
|---|---|---|---|---|---|
| 1 | **TEACH** (new) | 2 (2b) | Concept card for the section's concept, then "Which part interests you most?" (2B.4). Skippable: **I know this one** | **MIRROR**: "Your prompt says “{emotional term}.” What does {term} mean to you?" (2B.8) | `section_decisions.teach_*` |
| 2 | **PROBE** | 2 (2b) | Colton's exact opener (2A.2), teach-then-ask on vague answers, highlight reel on named leaders | Memory opener + memory triggers on stall (2B.8) | `ideas`, `probe_choice` |
| 3 | **SEARCH** | 3 | 3–5 ranked leads + 1 wildcard, all **To verify** (2B.6; 2A.3) | **Optional** ("Want to look anything up?"), off by default; required only if the rubric requires sources | `research_leads`, `chosen_lead_ids`, `chosen_style`, `search_status` |
| 4 | **SUMMARIZE** | 4 | Source cards: claim, quotable excerpt, why it fits the rubric (+ lesson link) (2B.7) | **Memory card** from the student's own words only (2B.8) | `sources.beats`, `source_card_ids` / `memory_card` |
| 5 | **CONFIRM** | 4 | "Are you comfortable moving forward with {leader} and {style}?" (Colton's text) | "Are you comfortable moving forward with this moment?" | `confirm_snapshot` |
| 6 | **LOGIC CHECKPOINT** | 4 | Opener + pass / light feedback / red-alert strong, never blocking (2B.9) | Light only: pass or a gentle prompt-fit note, never strong (2B.8) | `logic_*` |
| 7 | **ADVANCE** | 2–4 | Next section | Next section | `loop_step` |

**Saved decisions feed everything downstream.** The lesson, each section's teach aspect, ideas, chosen leader(s), style, source cards (or memory card) and confirmation prefill the Stage 3 outline card, the outline export, the Stage 5 draft view and the Stage 6 checks. The student never re-explains anything. Stage 5's per-section line becomes: "Here are the {n} ideas we captured for this section based on what you told me. **You're showing {concept}.** We chose {leader}, we chose {style}…" (memory sections: "Your moment: {student phrase}. The details you remembered: {phrases}…").

**Gating (unchanged in spirit).** `assertSectionStepUnlocked` step order is now `teach → probe → search → summarize → confirm`. TEACH never blocks: it's done when the student picks an aspect, taps **I know this one**, taps **Skip**, or answers the MIRROR question (or skips it). In memory mode SEARCH is auto-completed as `not_needed` unless the student opens it or the rubric requires sources. Skip-section and browse-ahead rules (2A.1) apply unchanged.

### 2B.4 TEACH and the teach-then-ask pattern

**TEACH card (start of each lesson-mode section).** Shown when the section has a concept (`section_plans.concept`, set by DISSECT from `requiredStyles` / `lesson.concepts`; null for most intros and conclusions, which skip TEACH as `not_applicable`). The card is **study material** (like a source summary), labeled **"Quick lesson: {concept}"**:
- **What it is** — one plain definition, ≤ 35 words.
- **Key qualities** — 3–5 bullets, each ≤ 10 words, noun phrases (not sentences).
- **How it shows up** — 2–3 bullets of observable behaviors, ≤ 12 words each.
- **Where it gets debated** — optional, 1 bullet ≤ 15 words (only if the rubric asks for evaluation or critique).
- Footer: "This is for learning. In your paper, define it in your own words and cite a real source."
- Then the ask: **"Which part of {concept} interests you most?"** with each quality as a tappable chip, plus **Something else** (free text, paste allowed) and **I know this one** (skips to PROBE, logged `teach_skipped_known`).
- The chosen aspect is saved (`teach_aspect`, verbatim or chip id) and seeds PROBE and SEARCH ("leaders who show {aspect}").

**Teach-then-ask on a vague answer (anywhere in TEACH or PROBE).** When `MentionTag.vague = true` and the answer names a concept (e.g. "I like servant leadership"), the coach responds in three beats, in one message:
1. **Affirm warmly** — one short line, ≤ 15 words, specific to what they said, no gushing ("Servant leadership is a great pick for this paper.").
2. **Teach** — the compact breakdown: definition (≤ 35 words) + 3–5 quality chips (same shape as the TEACH card; reuses it if one exists for this concept).
3. **Ask** — "Which part of {concept} do you find most interesting?" (chips + **Something else**).

This replaces the generic thin-answer probe for concept answers. Vague answers that name no concept still get the existing thin-answer probe (max 2, then "I'm stuck — flag for help").

**Schema (`TeachCard`, `MODEL_FAST` for the ask, `MODEL_STRONG` for the card, cached per paper + concept in `section_decisions.teach_card`):**
```ts
// SOP: coaching only, never generate submission text
export const TeachCard = z.object({
  concept: z.string().max(60), rubricRef: z.string(),
  affirm: z.string().max(100).nullable(),          // only for teach-then-ask; <= 15 words
  definition: z.string().max(240),                 // <= 35 words
  qualities: z.array(z.string().max(70)).min(3).max(5),   // noun phrases, <= 10 words
  showsUpAs: z.array(z.string().max(90)).min(2).max(3),
  debate: z.string().max(110).nullable(),
  ask: z.string().max(140),                        // must end with "?"
});
```
**Guard (in addition to the shared rules):** `qualities` and `showsUpAs` items must not end in sentence punctuation or contain a subject + verb clause; no example sentences, no thesis-like claims, no named people in the definition; `ask` ends with "?"; no citation text. Definitions are generic textbook knowledge; the card never says "according to {author}". Card copy-to-clipboard is not offered.

### 2B.5 Concept vs. instance (the style vs. leader split, generalized)

**Generalization.** "Leadership style vs. specific leader" is one case of **concept vs. instance**:

| Concept (textbook treatment) | Instance (highlight reel) |
|---|---|
| Leadership style, theory, framework, model | A named leader, person, organization |
| Literary device, theme, genre | A specific novel, poem, scene |
| Economic principle, policy type | A company, a market event, a specific law |
| Historical force or pattern | A specific event, movement, figure |
| Scientific concept | A specific experiment, study, species |

**`MentionTag` (`MODEL_FAST`, `reasoning_effort: "none"`, every TEACH/PROBE answer in lesson mode):** `{ concepts: {text (verbatim from the answer), matchedLessonTerm|null}[], instances: {text (verbatim), kind: 'person'|'org'|'case'|'work'|'event'|'other'}[], vague: boolean }`. Mentions must be verbatim substrings of the student's answer (code check); unverified mentions are dropped.

**Instance → highlight reel, then the search offer.** When the student names an instance:
1. **Affirm + highlight reel** — one or two **concrete moves** the instance made that match the section's chosen (or most likely) style/concept, each tied to the concept by name. Colton's example: "John Legere really was a servant leader. He had many people work with him." Shape: `{ instance, concept, moves: [{ move ≤ 20 words, showsQuality (one of the TEACH qualities) }] (1–2), confidence }`.
   - It's a factual claim about a real person or entity, so it carries the **To verify** badge, never includes quotes, dates, numbers or titles unless phrased as "reportedly", and is dropped (with "I don't know enough about {name} to say. Want me to look?") when `confidence < 0.6` or the model doesn't recognize the name. Never invent a move.
   - When the instance doesn't fit the style, say so gently as a question: "From what's known, {name} is usually described as more of a {other style}. Want to look into how they fit {style}, or try someone else?"
2. **The search offer** — always ends with: **"Want me to search for references on how {instance} was a {concept}?"** (e.g. "Want me to search for references on how Legere was a servant leader?"). Buttons **Yes, search** / **Not now**.
   - **Yes** → SEARCH opens for this section seeded with the instance (`research_leads.origin = 'student_added'`, does not count toward the cap), and the coach looks for verifiable sources about that instance + concept. If the section's SEARCH step isn't unlocked yet (PROBE still open), the request is queued and runs when SEARCH opens; the student isn't forced forward.
   - **Not now** → saved as an idea note (the student's verbatim mention) and the flow continues.
3. Saved to `section_decisions.highlight_reels` (`[{instance, concept, moves, offeredSearch, accepted}]`). Highlight reels are **not** source cards and never appear in the outline export or draft view (unverified).

**Guard:** the reel's `moves[]` must be ≤ 20 words, no quotation marks, no citation text, `showsQuality` must match a TEACH quality for the concept; ≤ 2 moves; the concept must be named (lesson-first).

### 2B.6 Research leads: ranked by rubric match, plus one wildcard

Applies to every AI-suggested lead set (Stage 3 SEARCH and Stage 1 coaching leads) in lesson-mode sections.

**Each batch = 3–5 ranked leads + exactly 1 wildcard.**
- **Ranked leads.** `MODEL_STRONG` returns candidates with `rubricMatch` (0–1): how directly the lead satisfies the section's `rubricRefs`, required styles/sources, and **illustrates the lesson concept** (and the student's teach aspect, when picked). Code sorts by `rubricMatch` (ties: interest-steered leads first, then the student's own named instances) and shows them in that order with a small "Best fit" tag on the top one. Each keeps the one-line why-it-fits-the-rubric, a `rubricRef`, a `lessonLink` (which concept it shows) and **To verify**. These dominate, because most students just want the paper done.
- **The wildcard.** One extra card, visually separate below the ranked list, labeled **Outside the box**, with a one-line why (≤ 30 words) that names the pattern it shares with the lesson. Framing line above it: "These above are the ones usually cited. Here's one outside the box that shows the same pattern." Colton's illustration of the tone: "These are traditionally cited, but in music, Marilyn Manson, although controversial, was quite the leader in his personal endeavors." The wildcard trains pattern recognition without risking the grade: it's never ranked above, never preselected, and the card says "A stretch pick. The ones above are the safer fit for your rubric." It still needs a `rubricRef` (the concept it illustrates) and is **To verify**.
- **Wildcard content rules (prompt + guard):**
  - Must illustrate the same concept from a different field (music, sports, film, gaming, history, science, local business, etc.).
  - Never offensive for its own sake, never shock value. Controversial figures are fine with a short neutral note ("although controversial"); the note never endorses or condemns.
  - Excluded: people notable mainly for violence, hate, or crimes against people; anyone where the "leadership" would require praising harm; sexual content.
  - Under-18 students (from `profiles.birth_date`): family-friendly wildcards only. ~~No figures with credible public allegations of abuse or sexual misconduct.~~ **(t58, LOCKED)** Allegations aren't confirmations, so they don't block a wildcard for any age.
  - **Controversy flag (t58, LOCKED).** When a wildcard figure has publicly reported but unconfirmed allegations or a significant controversy, the card shows a neutral note, **"Reported, not confirmed."**, with a short neutral label of the topic area (≤ 8 words, no details, no judgment), and a **Pick a different one** link. It's never preselected. **The student can override:** they may pick it, keep it, or swap it; the choice is logged (`lead_wildcard_flag_shown`, `lead_wildcard_flag_override`). The "although controversial" note above covers broader controversy; the "Reported, not confirmed" note is used for allegations specifically. Notability-based exclusions in the previous bullet still apply (open question Q23 in the Drafting spec asks whether any absolute exclusion should remain for under-18).
  - Respects the interest profile when one fits; never uses sensitive categories (health, religion, politics, sexuality).
  - If no safe wildcard fits, omit it for that batch (logged `lead_wildcard_omitted`). Never pad.

**Cap (unchanged number, wildcard counted).** `RESEARCH_LEADS_MAX_PER_PAPER = 20` counts every AI-suggested lead **including wildcards** (`origin = 'ai_suggested'`, `is_wildcard` true or false). A 4-section paper with one batch of 4 + 1 per section uses the full 20. When a batch would pass the cap, ranked leads are kept first and the wildcard is dropped; the final batch can be fewer than 3. At the cap, the existing search-it-yourself handoff applies unchanged: the code-built Google query (≤ 32 words; Scholar line when scholarly sources are required), Copy / Open in Google, and brought-back names (uncapped, `to_verify`) (2A.3).

**"Show me 3–5 more"** returns a new ranked batch plus a new wildcard (never repeats a lead), within the cap. **(t58, LOCKED: every batch, including every refresh, carries a wildcard unless the cap trims it or no safe one fits.)**

**Memory-mode sections** get no leads or wildcard unless the student opens the optional search (2B.8).

**Schema additions (`LeadBatch` item):** `rank` (int, 1 = best), `rubricMatch` (0–1), `lessonLink` (≤ 80 chars), `isWildcard` (bool), `wildcardWhy` (≤ 200 chars, wildcard only), `controversyNote` (≤ 60 chars, nullable; e.g. "although controversial"). Guard: exactly 0 or 1 wildcard per batch; a wildcard must have `wildcardWhy`; `controversyNote` from an allow-list of neutral phrasings ("although controversial", "a debated figure", "with a mixed record").

### 2B.7 Source cards

Unchanged from 2A.4 (verified sources only), now explicitly digestible: **the claim it supports** (tied to a sentence-plan row the student chose), **a short quotable excerpt** (≤ 2 sentences, verbatim, page/location), **why it fits your rubric** (one line, `rubricRef`), plus **lessonLink** (≤ 12 words: which concept the excerpt shows, e.g. "Shows servant leadership: putting the team's growth first"). Stored in `sources.beats[]` JSON (Zod-validated; no SQL change). The outline export still excludes AI "why it fits" and `lessonLink` lines (2A.7 allow-list unchanged).

### 2B.8 Memory-forward path (personal-experience prompts)

For `mode = 'memory'` sections. It's memory-forward, not research-forward.

**MIRROR (TEACH step in memory mode).** The coach mirrors the prompt's own emotional language back: **"Your prompt says “{emotional term}.” What does {term} mean to you?"** (e.g. "What does magical mean to you?"). `{term}` comes only from `lesson.emotionalTerms` (verbatim from the assignment); if none, the slot-free fallback is "What feeling is this prompt asking you to capture?" The answer (paste allowed, **Skip** available) is saved as an idea note and counts toward the voice sample if Stage 1 still needs words (it doesn't change Stage 1's gate after Stage 1 is complete).

**PROBE in memory mode.** Opener: **"Do you already have a moment in mind for this section, or do you want me to ask a few questions to jog your memory?"** Buttons **I have a moment** / **Help me remember**. Follow-ups ask for sensory, concrete detail (who was there, where, what you saw/heard, what you felt), one at a time, ≤ 25 words, never more than 2 per moment.

**Memory triggers on stall.** On freeze ("I don't know", empty twice, or 2 thin answers), show **memory trigger chips**: 4 at a time from a scripted bank (`lib/coaching/memoryTriggers.ts`), not model-generated, chosen by the prompt's theme (vacation, school year, family, a challenge, a change, a first time). The t47 yes/no examples ("Did you lose a tooth?" etc.) are retired by t52.

**Trigger sensitivity guideline (Colton, Nov 20, 2026, t52; applies to every memory-trigger line).** Write like a caring coach gently opening a door, never interrogating. Be mindful that hardship can sit behind any memory, and soften anything harsh or abrupt. Every trigger line must:
1. offer the memory softly as a possibility ("Maybe…"), never as a yes/no question ("Did you…?");
2. invite reflection with an opt-in ("Would you like to…", "Do you want to…", "Want to…", "If you're comfortable…");
3. connect back to the assignment ("…so we can explore how it might help your paper", or the prompt's own feeling word: "…see if it was part of what made it {term}?", with `{term}` only from verbatim `lesson.emotionalTerms`);
4. be ≤ 35 words, warm, with no pressure words ("must", "have to", "need to", "exactly", "everything", "why didn't").

The chip shows a short label; tapping it shows the full invitation line. Colton's model line: “A family member started or lost a job. Do you want to expand on it so we can explore how it might help your paper?”

**Trigger bank (`lib/coaching/memoryTriggers.ts`, scripted, not model-generated; lighter first):**

| id | Chip label | Invitation line | Sensitivity |
|---|---|---|---|
| `first_time` | A first time | Maybe you tried something for the first time. Would you like to tell me about it so we can see how it might fit your paper? | light |
| `best_day` | A day you didn't want to end | Maybe there was a day you didn't want to end. Would you like to share a little about it so we can explore how it might shape your paper? | light |
| `someone_new` | Someone new | Maybe you met someone who stuck with you. Want to tell me about them so we can see where they might fit in your paper? | light |
| `plan_sideways` | A plan that went sideways | Maybe a plan went sideways and turned into a story. Would you like to walk me through it so we can see how it might help your paper? | light |
| `small_milestone` | A little milestone | Maybe you had a little milestone, like losing a tooth. Would you like to share it so we can see how it might add to your paper? | light |
| `new_place` | A new place | Maybe you visited somewhere new, even close to home. Would you like to describe it so we can explore how it fits your paper? | light |
| `new_skill` | Something you learned | Maybe you learned something new or got better at something. Want to tell me about it so we can see how it might help your paper? | light |
| `small_moment` | A small moment | Maybe there's a small moment that still makes you smile. Would you like to share it so we can see if it belongs in your paper? | light |
| `moved` | A move or a new school | Maybe you moved houses or changed schools. Would you like to share what that was like so we can explore how it might fit your paper? | light |
| `got_hurt` | Getting hurt | Maybe you got hurt, like breaking a bone, and it changed your plans. If you're comfortable, would you like to share it so we can explore how it might shape your paper? | medium |
| `family_job` | A family job change | A family member started or lost a job. Do you want to expand on it so we can explore how it might help your paper? *(Colton's model line, verbatim)* | medium |

**Guard and CI test (`memoryTriggers.test.ts`, run in CI over the whole bank; the same checks run on any model-written memory-mode follow-up, which retries once and then falls back to the scripted follow-up):**
- the line doesn't start with an interrogative auxiliary (`/^(did|do|does|have|has|had|were|was|is|are|can|could|will|would)\b/i`), so no yes/no interrogation opens it; model follow-ups in memory mode are rejected if they start with an auxiliary + "you";
- it contains an allow-listed invitation phrase ("Would you like", "Do you want to", "Want to", "If you're comfortable");
- it contains an assignment link ("your paper" or the `{term}` slot);
- it ends with "?", is ≤ 35 words, and has no pressure words;
- it matches nothing on the banned-topic list (death, abuse, illness, violence, divorce, self-harm);
- `sensitivity: 'medium'` items never appear in the first set and are hidden for under-18 students.

Rules:
- Above the chips: "Just ideas to jog your memory. Pick one, or skip any that don't fit. Only share what you're comfortable sharing."
- Every chip has **Not this one** (hides it, shows another); the set has **Skip these** and **More ideas** (max 3 refreshes per section).
- Tapping a chip shows its full invitation line (above). If the student starts sharing, the one follow-up is gentle too: “Thank you. Whenever you're ready, tell me what you remember most, and we'll look at how it fits your paper.” It never asks for painful details (t52).
- The bank orders lighter triggers first; `family_job` and `got_hurt` are `sensitivity: 'medium'` and appear only after the first set. The bank never includes death, abuse, illness, violence, divorce, or anything that asks the student to disclose trauma.
- If the student brings up something heavy on their own, the coach responds kindly in one line, doesn't dig ("Thank you for sharing that. You can write about it or pick a different moment; both are okay."), and offers **Pick a different moment**. If the answer shows signs the student may be at risk (self-harm or abuse language, `MODEL_FAST` safety tag), the coach shows a short supportive note with a trusted-adult suggestion and the 988 Suicide & Crisis Lifeline (US) and pauses coaching on that section; logged as `memory_safety_note_shown` (no text stored in the event).
- Under-18 students get the same bank minus any `sensitivity: 'medium'` item.

**SEARCH in memory mode.** Off by default (`search_status = 'not_needed'`, auto-completed). A small **Want to look anything up?** link opens normal SEARCH (e.g. a place's history), and SEARCH is `required` when the rubric requires sources. No wildcard in memory mode.

**SUMMARIZE in memory mode: the memory card.** Built in code from the student's own words only (verbatim phrases, substring-checked, ≤ 30 words each): **The moment** (their phrase), **Details you remembered** (up to 4 phrases), **Why it mattered / why it felt {term}** (their phrase, or an empty slot with the question "Why did it feel {term}?" for them to answer). No AI-written content on the card. Saved as `section_decisions.memory_card`.

**CONFIRM in memory mode:** "Are you comfortable moving forward with this moment?" (the moment phrase shown). Same buttons and snapshot as 2A.4.

**Light logic checkpoint.** Memory sections run the checkpoint with `mode: 'memory'`: the model may only return `pass` or `moderate`, and only for prompt fit (e.g. the moment is from winter when the prompt asks about summer, or the section repeats a moment already used). It never judges whether a personal experience is true, important enough, or "logical". `strong` is impossible in code (clamped to `moderate`, logged `logic_memory_clamped`). The moderate card copy: "A thought before you move on: {reason}. Your call."

**Open research item — TODO for Paper Coach Research (do not invent statistics).** How common vague/personal-experience prompts are (e.g. "tell us about your summer vacation") relative to lesson/rubric prompts, and at which grade levels (elementary, middle, high school, college composition, graduate). Method to be decided by Paper Coach Research (public assignment banks, state standards, college composition syllabi, our own anonymized `prompt_type` counts once live). Until then, no stats in copy or specs; routing defaults are not tuned to any assumed share. Tracked as Stage 1 spec section 16 item 6.

### 2B.9 Logic checkpoint (t47 alignment with 2A.4a)

All of 2A.4a stays (tiers, 80/60 downgrade rules, fail-open to pass, guard, logging, `logic_strong_continued` SOP review, no gate reads `logic_*`). Colton's t47 adds or confirms:
- **Opener.** After **Yes, lock it in**, the coach says: **"I want to do a logic check. Do you feel good about this?"** with **Yes, check it** / **Let me tweak it first**. The check starts running in the background as soon as CONFIRM saves, so **Yes** reveals the result with no wait. **Let me tweak it first** opens the section's idea notes and claim notes; saving re-confirms and re-runs. The opener never blocks: both buttons lead forward.
- **Three outcomes.** **No flag** (pass: "Logic check ✓ Looks solid." then ADVANCE), **light constructive feedback** (moderate: the existing "A thought before you move on" card, Keep my angle / Adjust it), **strong pushback** with a **red alert** card: red border and a ⚠ icon plus the text label "Logic alert" (not color-only), headline **"We would not recommend moving forward."**, then "This claim doesn't hold up as written," the reason, "Your assignment asks: ‘{verbatim term}’", angle questions, and **Pick a new angle** / **Revise my claim** / **Reframe it** / **Continue anyway** (same size, always visible). No hard stops: **Continue anyway** always advances with no extra dialog.
- **Moderate for debatable takes, strong for indefensible ones** (e.g. claiming Hitler was objectively moral in a leadership paper). **When unclear, let it through** rather than overruling the student (pass; enforced by the downgrade rules).
- **Counterargument only when the rubric asks for one (confirmed, decision 43).** The checkpoint never flags a section for missing a counterargument unless the assignment requires one, and `alternativeAngles` never suggest adding one unless required.
- Memory sections: light only (2B.8).

### 2B.10 Voice capture (t47; voice-note rule revised t51)

- **Minimum:** 200 words total across the answers given. Colton wrote "across skipped answers"; we read that as **across all answers, with skipped answers allowed** (t40), not "only skipped answers." The 2 × 40-word rule stays. (Stage 1 spec 8.2.)
- **Quiet safeguard:** mostly-pasted answers are down-weighted in the baseline (`w = 1 − 0.8 × paste_ratio`; a fully pasted answer weighs 0.2), and typed or spoken answers are favored (Stage 1 spec 8.1a). No warnings, notes, or prompts during the flow, anywhere.
- **End-of-results notes (one at most, very bottom of the Stage 6 comparison and of any checker report using these answers).** ~~t47: > 60% pasted → lighter-read note; ≥ 95% pasted → all-pasted note~~ (superseded by t51):

**Hybrid voice-note rule (Colton, Nov 20, 2026, t51; replaces the paste-percentage-only rule). All numbers are [PROVISIONAL] for Colton to tune.**

Principle: if there's enough natural voice to form a reliable baseline, show no note, whatever the paste %. If very little natural voice was captured, show a note even at a moderate paste %.

- **`naturalWords`** = typed + dictated/spoken words in the counted text. **Pasted words are excluded** (they count 0 here). Per answer: `round(wordCount × (1 − paste_ratio))`; missing meta counts as all natural. The 0.2 paste weight still applies to the baseline *metrics* (`w = 1 − 0.8 × paste_ratio`); it doesn't add to `naturalWords`.
- **Counted text, in app ("across the whole paper"):** Stage 1 voice answers plus every Stage 2–4 conversational answer: Stage 2 move replies and refined thesis, TEACH **Something else**, MIRROR, PROBE ideas, memory answers, highlight-reel follow-ups, and logic-checkpoint revise/new-angle/reframe answers. **Not counted:** Stage 3 outline notes and sentence-plan fragments, brought-back names, assignment paste and links, and Stage 5–6 draft text (that's what gets compared). The Stage 6 baseline metrics use the same counted answers, typed-weighted (t51; before, Stage 1 answers only).
- **`pastedShare`** = pasted chars / (pasted + typed chars) over the same counted text.

| Tier | `naturalWords` [PROVISIONAL] | Note |
|---|---|---|
| `plenty` | ≥ 600 | **No note**, at any paste % |
| `enough` | 200–599 | Lighter-read note **only if `pastedShare > 0.60`**; otherwise none |
| `thin` | 80–199 | Lighter-read note **regardless of paste %** |
| `low` | < 80 | Stronger note **regardless of paste %** |

- **Which lighter-read wording:** if `pastedShare > 0.60`, the paste wording (`VOICE_NOTE_ANSWERS` / `VOICE_NOTE_SAMPLE`); otherwise the short wording (`…_SHORT`), so the note never says "mostly pasted" when it wasn't.
- At most one note, at the very bottom (placement and style unchanged). **No baseline at all → no note** (N/A unchanged). Never during intake or any writing step.
- Constants (`lib/config.ts`): `VOICE_NATURAL_WORDS_PLENTY = 600`, `VOICE_NATURAL_WORDS_ENOUGH = 200`, `VOICE_NATURAL_WORDS_LOW = 80` [PROVISIONAL], plus `VOICE_PASTED_SHARE_NOTE = 0.60` (kept; now only used in the `enough` tier). `VOICE_ALL_PASTED_SHARE` and `VOICE_NOTE_ANSWERS_ALL` (t47) are retired. One pure function, `voiceNoteFor({ naturalWords, pastedShare, hasBaseline, surface: 'answers' | 'sample' }) → { tier, note }`, in `lib/style/voiceBaseline.ts`, is used on every surface.
- The short-sample downgrade (no strong mismatch levels when fewer than 150 natural words) is unchanged and uses the same `naturalWords`.

| Key (`lib/copy/voiceNotes.ts`) | When | Exact text |
|---|---|---|
| `VOICE_NOTE_ANSWERS` (t46, kept) | Answers; lighter read, paste cause (`enough` or `thin` tier with `pastedShare > 0.60`) | “Your voice answers were mostly pasted in, which is totally fine. Typed or spoken answers help us understand your voice better, so treat the voice comparison as a lighter read.” |
| `VOICE_NOTE_ANSWERS_SHORT` (t51, new) | Answers; lighter read, short cause (`thin` tier, `pastedShare ≤ 0.60`) | “We only had a little of your typed or spoken voice to go on, which is totally fine. More typed or spoken answers help us understand your voice better, so treat the voice comparison as a lighter read.” |
| `VOICE_NOTE_ANSWERS_LOW` (t51; replaces t47's `VOICE_NOTE_ANSWERS_ALL`) | Answers; `low` tier | “Most of your voice came in pasted, or there wasn't much of it, which is totally fine. We couldn't reliably read your voice from it, so treat the voice comparison with lower confidence.” |
| `VOICE_NOTE_SAMPLE` (t46, kept) | Public writing sample; lighter read, paste cause | “Your writing sample was pasted in, which is totally fine. A typed or spoken sample helps us understand your voice better, so treat the voice comparison as a lighter read.” |
| `VOICE_NOTE_SAMPLE_SHORT` (t51, new) | Public writing sample; lighter read, short cause | “Your writing sample was on the short side, which is totally fine. A longer typed or spoken sample helps us understand your voice better, so treat the voice comparison as a lighter read.” |
| `VOICE_NOTE_SAMPLE_LOW` (t51, new) | Public writing sample; `low` tier | “Most of your sample came in pasted, or it was short, which is totally fine. We couldn't reliably read your voice from it, so treat the voice comparison with lower confidence.” |

### 2B.11 Data model (fold into `0008_section_loop.sql`; else `0009`)

0008 is still spec-only (not applied), so these lines are folded into it. **If 0008 has already been applied anywhere, ship the t40/t41/t44 lines and these t47/t48 lines together as `supabase/migrations/0009_section_loop_followups.sql`** (all `add column if not exists`). RLS unchanged (`auth.uid() = user_id`).

```sql
-- t47: lesson-first + prompt-type routing
alter table papers add column if not exists lesson jsonb;                         -- Lesson (2B.1); null until Stage 1 parse
alter table papers add column if not exists lesson_source text;                   -- ai | student_edited | fallback
alter table papers add column if not exists prompt_type text not null default 'lesson'
  check (prompt_type in ('lesson','personal_experience','mixed'));
alter table papers add column if not exists prompt_type_confidence numeric(3,2);
alter table papers add column if not exists prompt_type_source text;              -- ai | student | fallback

alter table section_plans add column if not exists mode text not null default 'lesson'
  check (mode in ('lesson','memory'));
alter table section_plans add column if not exists concept text;                  -- the section's lesson concept for TEACH; null = not_applicable

-- section_decisions.loop_step values now: teach | probe | search | summarize | confirm | logic_check | confirmed (default becomes 'teach')
alter table section_decisions alter column loop_step set default 'teach';
alter table section_decisions add column if not exists teach_status text;         -- explored | skipped_known | skipped | not_applicable | mirrored
alter table section_decisions add column if not exists teach_card jsonb;          -- cached TeachCard (study material, never exported)
alter table section_decisions add column if not exists teach_aspect text;         -- student's chosen aspect (chip id or verbatim text)
alter table section_decisions add column if not exists highlight_reels jsonb not null default '[]'; -- [{instance, concept, moves, offeredSearch, accepted}]
alter table section_decisions add column if not exists memory_triggers jsonb not null default '[]'; -- [{triggerId, action: picked|not_this_one|skipped_set}]
alter table section_decisions add column if not exists memory_card jsonb;         -- student-verbatim moment/details/why (memory mode)
alter table section_decisions add column if not exists search_status text not null default 'required'; -- required | optional | not_needed

alter table research_leads add column if not exists is_wildcard boolean not null default false;
alter table research_leads add column if not exists wildcard_why text;
alter table research_leads add column if not exists controversy_note text;
alter table research_leads add column if not exists rubric_match numeric(3,2);
alter table research_leads add column if not exists rank int;
alter table research_leads add column if not exists lesson_link text;
create index if not exists research_leads_paper_wildcard on research_leads (paper_id, is_wildcard);

-- t51: hybrid voice-note rule (cached counts; recomputed on every counted answer save)
alter table papers add column if not exists natural_voice_words int not null default 0;  -- typed + spoken words across Stage 1-4 counted answers (pasted excluded)
alter table papers add column if not exists voice_pasted_share numeric(4,3);             -- pasted chars / all chars over the same answers
alter table voice_profiles add column if not exists natural_words int;                    -- same count for the profile's answers (checker)
```
- t51: per-answer `inputMeta { pastedChars, typedChars, spokenChars }` (server-clamped) is added to every Stage 2–4 counted answer in JSON (`stage_progress.data` moves/thesis, `section_decisions.ideas[]`, teach/mirror/memory answers). Zod only, no SQL.
- The lead cap stays a count query: `count(*) where paper_id = $1 and origin = 'ai_suggested'` (wildcards included).
- Source-card `lessonLink` lives in `sources.beats[]` JSON (Zod), like the other card fields. No SQL.
- Existing rows: `prompt_type = 'lesson'`, `mode = 'lesson'`, `loop_step` unchanged; sections already past PROBE get `teach_status = 'not_applicable'`.
- t48 adds no columns (`drafts.mismatch` keeps its shape; only events and copy change).

### 2B.12 New `session_events` (no student prose in `detail`)

`lesson_extracted {confidence_bucket, source}`, `lesson_edited`, `prompt_type_classified {type, confidence_bucket}`, `prompt_type_changed {from, to}`, `section_mode_changed`, `teach_shown {concept}`, `teach_aspect_picked`, `teach_skipped_known`, `teach_skipped`, `teach_then_ask_shown`, `lesson_ratio_retry`, `mention_tagged {concepts, instances, vague}` (counts only), `highlight_reel_shown {moves}`, `highlight_reel_dropped {reason}`, `highlight_search_offered`, `highlight_search_accepted`, `highlight_search_declined`, `lead_batch_shown {ranked, wildcard}`, `lead_wildcard_shown`, `lead_wildcard_picked`, `lead_wildcard_omitted {reason}`, `mirror_shown`, `mirror_answered`, `mirror_skipped`, `memory_triggers_shown {set}`, `memory_trigger_picked {triggerId}`, `memory_trigger_hidden {triggerId}`, `memory_triggers_skipped`, `memory_safety_note_shown`, `memory_card_saved`, `memory_search_opened`, `logic_opener_shown`, `logic_opener_tweak`, `logic_memory_clamped`.

### 2B.13 Tests (Vitest + evals)

1. **Lesson extraction:** the leadership prompt ("connect leadership styles to leaders you admire, give three examples") → `lesson.concepts` includes "leadership styles", `examplesServe` mentions the examples serving the styles; `evidence.quote` is a verbatim substring; a `statement` that is a full claim sentence is rejected; fallback fills from the prompt when the model fails.
2. **Routing:** the summer-vacation prompt → `personal_experience`, `emotionalTerms` includes "magical", every section `mode = 'memory'`; the leadership prompt → `lesson`; a "connect a style to a time you led" prompt → `mixed` with at least one memory section; confidence < 0.6 → `lesson`; the student's override wins.
3. **TEACH:** a lesson section with a concept shows the card before PROBE; **I know this one** advances to PROBE; `qualities` with sentence punctuation or a subject + verb are rejected; intros without a concept are `not_applicable`; `assertSectionStepUnlocked` enforces teach → probe; TEACH never blocks.
4. **Teach-then-ask:** "I like servant leadership" → one response with affirm (≤ 15 words), definition, 3–5 chips and a question ending in "?"; "I don't know" (no concept) → the existing thin probe instead.
5. **Highlight reel:** "John Legere" in a servant-leadership section → 1–2 moves (≤ 20 words, no quotes) naming the concept, a **To verify** badge, and the exact search offer "Want me to search for references on how Legere was a servant leader?"-pattern; Yes seeds SEARCH with a `student_added` lead not counted toward the cap; an unknown name → the "I don't know enough" line and no invented moves.
6. **Leads:** each batch has 3–5 ranked leads sorted by `rubric_match` desc plus 0–1 wildcard (`is_wildcard = true`, `wildcard_why` present, labeled Outside the box, never preselected); the 20th AI lead may be a wildcard and the 21st (of any kind) is rejected server-side; when trimming at the cap the wildcard goes first; memory sections get no leads by default; guard rejects a batch with 2 wildcards or a non-allow-listed `controversy_note`; an under-18 profile never receives a wildcard flagged by the safety filter.
7. **Memory path:** MIRROR uses only verbatim `emotionalTerms`; stall → 4 scripted trigger chips with Not this one / Skip these; no trigger in the bank matches the banned-topic list (CI test over `memoryTriggers.ts`); **(t52) every trigger line passes the gentle-invitation test** (doesn't open with an interrogative auxiliary, has an allow-listed invitation phrase and an assignment link, ends with “?”, ≤ 35 words, no pressure words) and a model follow-up opening with "Did you…" / "Were you…" is rejected; under-18 sees no `medium` triggers; the memory card contains only verbatim student phrases; SEARCH auto-completes as `not_needed`; the memory checkpoint never returns `strong` (clamped and logged).
8. **Logic checkpoint (t47):** the opener appears after CONFIRM with both buttons leading forward; the strong card shows "We would not recommend moving forward." with a text label (not color-only) and a working **Continue anyway**; existing golden cases (2A.4a / section 12 t41) still pass; no checkpoint result suggests a counterargument when the rubric doesn't require one.
9. **Voice:** 200 words across answers with skips completes; **hybrid note rule (t51):** the **58-page paper** (4,200 counted answer words, pastedShare 0.70 → naturalWords 1,260) → **no note**; a **short session with moderate paste** (260 words, pastedShare 0.45 → naturalWords 143) → `VOICE_NOTE_ANSWERS_SHORT`; 300 words at 0.70 → 90 → `VOICE_NOTE_ANSWERS`; 400 words at 0.50 → 200 → no note; 700 words at 0.65 → 245 → `VOICE_NOTE_ANSWERS`; 210 words at 0.65 → 74 → `VOICE_NOTE_ANSWERS_LOW`; 250 words fully pasted → 0 → `VOICE_NOTE_ANSWERS_LOW`; 210 words fully typed (Stage 1 minimum only) → 210 at 0.0 → no note; boundaries 600 vs. 599 and 200 vs. 199 at pastedShare 0.61 (none vs. note; note vs. note), 80 vs. 79 (lighter vs. stronger), 0.60 vs. 0.61 in the `enough` tier (none vs. note); dictated words count as natural; Stage 5 draft text and Stage 3 notes don't change `naturalWords`; no baseline → no note; no voice note or warning renders on any Stage 1–5 screen.
10. **Downstream:** Stage 3 card, outline export and Stage 5 view render the lesson concept, teach aspect and memory card from saved data with no re-asked questions; the export allow-list still excludes teach cards, highlight reels and wildcard whys (canary test).
Golden cases 1, 2, 4, 5 and the memory clamp also live in `evals/stage2-lesson-loop.jsonl`, run nightly against the live model.

---

## 2C. Interaction design layer (Stages 1–5) and hidden-draft scaffold (Colton, Nov 20, 2026, t57; updated with Colton's t58 decisions)

> **Status (t58).** Colton's t58 decisions are folded in (decisions 61–72 statuses updated; Drafting specifics in the Drafting spec, decisions 73–81). Implementation details remain **[PROVISIONAL]**. **Build item S3-t57 is ✅ BUILD-READY (Colton, t67).** The former blockers (hidden-draft disclosure Q16 and retention Q17; stage numbering after Drafting Q20) now carry [PROVISIONAL] build defaults in the Drafting spec section 15; the Q16 privacy wording still needs Colton's OK and legal review but doesn't block the build. Drafting's eight required behaviors and its screen-state machine: Drafting spec section 0A. It ships behind two code constants in `lib/config.ts` that are built `false` and switched to `true` for production once the acceptance tests pass: `FEATURES.interactionLayer` (rhythm, ghost, milestone pop-ups, jump-to-edit, payoff) and `FEATURES.hiddenDraft` (the hidden-draft scaffold). Either can ship without the other. Open questions: Drafting spec section 15.

**Stage numbers in 2C are the code's six-stage numbers** (1 intake, 2 stance interview, 3 outline, 4 sources and audio beats, 5 **Drafting**, 6 revise). **t58:** Colton's "Stage 3" is **Drafting** (code Stage 5; student-facing label exactly "Drafting"). The big payoff therefore comes at the **end of Drafting** (2C.4), not at outline approval.

### 2C.1 Core rhythm: one beat at a time
- **One question or frame on screen at a time**, about a single section or beat (a "beat" = one PROBE question, one TEACH card, one lead batch, one source card, one outline card field or sentence-plan row, one paragraph). The rest of the paper is out of focus.
- Each beat screen has a **beat address** `{stage, sectionKey, step, beatId}` (e.g. `{3, 'body-2', 'sentence_plan', 'row-3'}`), used for jump-to-edit and resume.
- This formalizes what Stage 1 (one question per screen) and 2A/2B already do. It changes layout, not the order of steps: DISSECT → TEACH → PROBE → SEARCH → SUMMARIZE → CONFIRM → LOGIC CHECKPOINT → ADVANCE is unchanged.

### 2C.2 The progress ghost
A lightweight paper skeleton that floats in the background as information builds up. It's a progress cue, not the main focus.
- **What it shows:** Intro → Body 1…N → (Counterargument, only when the rubric asks) → Conclusion, from `section_plans`. Each block fills in as the student's captured words arrive: section label + a fill level (empty, started, has ideas, has sources, confirmed, drafted). Text inside the ghost is **only** the section's short label (the roadmap title) and, on hover/expand, the student's own captured words (verbatim, truncated to 12 words with "…"). Never AI text, never hidden-draft text.
- **When it appears:** from the end of Stage 1 (once DISSECT's roadmap is confirmed, as an empty skeleton of labels) through Stage 5. **Stage 1 has no ghost before DISSECT and no zoom-out at all** (Colton: Stage 1 collects its components without zoom-out).
- **Look and feel:** low contrast, no motion beyond a soft fill transition (none under `prefers-reduced-motion`), never pulses for attention, never covers the beat. Clicking it opens the zoom-out view (2C.3) on demand.
- **Built in code** from saved rows (`section_plans`, `section_decisions`, outline cards, `draft_paragraphs`); no model call. Pure function `buildSkeleton(paperId) → Skeleton` in `lib/skeleton/build.ts`, shared by the ghost and the zoom-out.

### 2C.3 The zoom-out beat (milestones)
At each major milestone the skeleton pops up as the **full paper outline**: intro, body sections and conclusion, built from the student's captured Q&A.

**Where zoom-outs happen (code stages):**

| Stage | Zoom into | Zoom-out milestone |
|---|---|---|
| 1 Intake | each intake question | **none** (ghost starts empty after DISSECT) |
| 2 Stance + PROBE | one TEACH/PROBE beat | after the whole-paper stance work (thesis saved) — once; then after each section completes its loop (2C.5) |
| 3 Outline (SEARCH, cards) | one outline card field or one sentence-plan row (sentence frame) | full zoom-out after each section completes its loop; the last one, at outline approval, adds the light line "Your outline is complete." (no stats, no reveal; t58) |
| 4 Sources/beats (SUMMARIZE, CONFIRM, LOGIC) | one source card / one citation-flagged sentence row | full zoom-out after each section completes its loop (after the logic checkpoint resolves) |
| 5 **Drafting** | one sentence at a time inside one paragraph frame (Drafting spec 8.2) | milestone pop-up after each section is done (background ghost, **Review all**, **Ready for section {n}?** / **Do you want to review?**; Drafting spec 11A); **end of Drafting → the big payoff (2C.4)** |

Because 2A runs section-first (each section goes PROBE → SEARCH → SUMMARIZE → CONFIRM → LOGIC CHECKPOINT before the next opens), "a section completes" means its loop finished: the logic checkpoint resolved (any tier, including **Continue anyway**) and the section is confirmed. The full zoom-out replaces the plain ADVANCE transition.

**Peeks: off by default (t58).** Colton's t58 direction is zoom-outs after each section only. The t57 per-frame peek (a non-modal inline panel after each finished sentence frame or paragraph in Stages 3–5) is kept only as a disabled option, `SKELETON_PEEKS = false` in `lib/config.ts`; with it off, finished frames just fill the ghost.

**What the zoom-out shows:**
- Every section in order with its label, status (confirmed / in progress / skipped / not started), and the student's own words: idea notes, claims, purpose notes, chosen leader and style names, source titles (verbatim; long items truncated with "…" and expandable). Section counts: ideas, sources, words drafted.
- The just-finished section highlighted, with one line: "{Section label} is done."
- **Readback flags** from the hidden-draft scaffold (2C.7), at most 2, as questions with buttons.
- Two ways forward: **click any section to jump to it and edit** (2C.6), or **Ready for next** (primary button), which performs ADVANCE and opens the next section's first beat.
- Copy is short and clean. Header: "Here's your paper so far."
- No model call to render it.

### 2C.4 The big payoff: end of Drafting (t58; replaces the t57 end-of-outline payoff)
- **Internal design intent (never shown to students):** "holy crap, I just wrote a long paper." The student should feel how much they've written.
- **When:** once, right after the conclusion's last paragraph is saved in **Drafting**, before the revision stage opens (Colton: "before Stage 4"; see Drafting spec Q20 on numbering).
- **Student-facing copy (clean, no cursing):** header **"Look at everything you wrote."** Sub-line: **"This is your whole paper, in your own words."** Then the **full outline: intro, body sections, their support (evidence and explanation sentences under each topic sentence), and conclusion**, all in the student's own drafted sentences, and a stat row built in code: "{n} paragraphs · {k} sources · {w} words you wrote". `w` counts only the student's own drafted words (no excerpts, no AI text, never hidden-draft text).
- Actions: jump to any section to edit (returns to the payoff); **Export outline** (2A.7, unchanged allow-list); **On to revision**.
- Re-openable from the ghost; `papers.payoff_shown_at`. Respects reduced motion (no confetti; a single soft reveal at most, none under reduced motion).
- **Outline stage (code Stage 3):** keeps only a lighter moment, the line **"Your outline is complete."** on its last section zoom-out (no stats, no reveal). The t57 "Look at everything you built." outline payoff is retired.

### 2C.5 Fit with the existing loops
- **Stage 2 DISSECT…ADVANCE:** unchanged order. TEACH, PROBE, SEARCH, SUMMARIZE and CONFIRM each render as single beats. ADVANCE becomes the zoom-out's **Ready for next**. Skipped sections don't get a zoom-out; the ghost marks them "skipped — come back to it" and the existing reminder bar and jump-back link still apply (t40).
- **Logic checkpoint:** runs before the zoom-out and is unchanged (never blocks, defaults to pass). The zoom-out shows the section as confirmed after any checkpoint outcome. A strong flag the student continued past shows only the neutral note "You chose to keep this angle." Hidden-draft signals never change the logic tier, and the checkpoint never reads them.
- **Stage 3 outline approval gate** (4.3) is unchanged; its last zoom-out adds the light line "Your outline is complete." (t58; the big payoff is at the end of Drafting).
- **Drafting (code Stage 5; Drafting spec):** one sentence at a time inside each paragraph frame (finished sentences move up); after each save the ghost fills; after each section is done, the Drafting milestone pop-up (t58). Drafting is strictly in order: a jump edits an earlier section and returns to the current beat; later sections aren't editable early. The intro loop and its per-type variants are unchanged. Readback shaping (2C.7) feeds the read-back step (draft spec 5.2 and section 8 step 2) only through student-verbatim items. draftGuard gains **D9 (hidden-draft leak check)**; D1–D8 still apply.
- **Gates:** `assertSectionStepUnlocked`, Stage 4 completion and Stage 5 entry are unchanged. Jumping never bypasses a gate (2C.6).

### 2C.6 Jump-to-edit and resume
- **Clicking a section** in the zoom-out (or the ghost) opens that section at its most relevant beat: confirmed sections open their CONFIRM summary with an **Edit** control (reopening uses the existing reopen rules: status `reopened`, the logic checkpoint re-runs, outline edits after approval still need the 5-word reason, 4.3); in-progress sections open their current beat; locked future sections open as a **read-only preview** (t40 browse-ahead), never editable early.
- **Resume beat:** before a jump, the current beat address is saved as `stage_progress.data.resumeBeat`. Every jumped-to screen shows a sticky chip **"Back to where you were"** that returns to that exact beat (same step, same row or paragraph, scroll and focus restored). After an edit is saved, the chip stays until used or until the student reaches a new milestone.
- **Deep links:** beats are addressable by URL (`/app/papers/[paperId]/stage/[n]?section=body-2&step=sentence_plan&beat=row-3`), so browser Back and refresh land on the same beat. Invalid or locked addresses fall back to the nearest unlocked beat with a short note.
- Jumps write nothing by themselves (preview routes write nothing, per t40).

### 2C.7 Hidden-draft scaffold
**What it is (t58, DECIDED).** The coach generates its own **full paper**, server-side, from the student's captured Q&A, the same method as the owner's original test run. It's the **invisible answer key**: the coach uses it to check structure and pacing, whether idea three lands where it should, whether sentence six carries too much weight, and to shape the idea-by-idea read-back. The student sees only their own ideas, re-read in that shape. (t57 wording, still true:) The coach privately generates its own version of the paper from the captured ideas (roadmap, lesson, thesis, story angle, each section's student ideas, chosen leaders and style, verified excerpts). It's used **only** to sanity-check structure, pacing, and whether each idea lands in the right section, and to shape the readback of the student's own ideas. **Its text is never shown to the student, verbatim or paraphrased, and never leaves the server.**

**Generation.**
- `MODEL_STRONG`, server-only module `lib/server/hiddenDraft/generate.ts` (file starts with `import 'server-only'`). Call-site comment: `// SOP: hidden scaffold — internal structure check only; never student-facing, never exported`.
- Output (Zod): `HiddenDraft = { text: { sections: [{ sectionKey, paragraphs: [{ text, usesIdeaIds }] }] }, signals: HiddenDraftSignals }`. Only `signals` ever leaves the module.
- `HiddenDraftSignals` holds ids, enums and numbers only, no free text:
  ```ts
  export const HiddenDraftSignals = z.object({
    version: z.number().int(), ledgerHash: z.string(),
    placement: z.array(z.object({ ideaId: z.string(), currentSection: z.string(), bestSection: z.string(), confidence: z.number().min(0).max(1) })),
    pacing: z.array(z.object({ sectionKey: z.string(), ideaCount: z.number().int(), estWords: z.number().int(), targetWords: z.number().int(),
      status: z.enum(['light','ok','heavy']) })),
    gaps: z.array(z.object({ sectionKey: z.string(), kind: z.enum(['no_idea','no_evidence','no_link_to_thesis','no_landing']) })),
    order: z.object({ suggested: z.array(z.string()).nullable(), confidence: z.number().min(0).max(1) }),
    landing: z.array(z.object({ ideaId: z.string(), lands: z.enum(['yes','weak','no']) })),
    sentenceWeight: z.array(z.object({ sectionKey: z.string(), planRowId: z.string(), weight: z.enum(['light','ok','heavy']) })), // t58: "does sentence six carry too much?" (by plan row id, never text)
  }).strict();
  ```
- **When it's regenerated:** per milestone, not per keystroke. Triggers: each section's loop completing (Stages 2–4), outline approval (end of Stage 3), each draft-stage section done (Stage 5). Skipped when the ledger hash hasn't changed since the last version. First generated after the first section completes (never in Stage 1). Runs in the background after the milestone; the zoom-out renders immediately and adds flags when signals arrive (or shows none). Cap: 15 generations per paper [PROVISIONAL].
- **Mode switch:** `HIDDEN_DRAFT_MODE = 'prose' | 'structure'` (`lib/config.ts`). `prose` (Colton's description) generates the invisible paper text; `structure` asks the model for signals only and generates no prose at all (lower risk, lower cost). **Default and planned mode: `prose` (full paper; DECIDED, Colton t58).** `structure` is kept only as an outage/cost fallback switch.
- **Failure:** timeout, guard error or cap reached → no signals, no flags, nothing blocks; log `hidden_draft_failed` or `hidden_draft_skipped {reason}`.

**Storage and retention.**
- **Server-side only**, in a non-exposed Postgres schema: `private.hidden_drafts` (migration `0011_interaction_layer.sql`). `private` is **not** in Supabase's exposed API schemas, so PostgREST and the client SDK can't reach it; RLS is enabled with **no policies** (service role only). Only `lib/server/hiddenDraft/*` reads or writes it.
- **One row per paper (latest only):** each regeneration overwrites the previous text; older versions are not kept (`version` counter and signals history kept, text not).
- **Retention:** text deleted 30 days after the paper's draft stage completes, or 90 days after the row was created, whichever is first; immediately when the paper or account is deleted (cascade) [PROVISIONAL]. A daily cron (`/api/cron/hidden-draft-purge`, `CRON_SECRET`) nulls expired text and logs `hidden_draft_deleted {reason}`.
- Never in backups exported to users, never in data-export downloads, never in logs, Sentry breadcrumbs, `session_events.detail`, emails, TTS scripts or analytics.

**Readback shaping (the only use).** Signals shape how the coach reads the student's **own** ideas back (2C.3 zoom-out, Stage 2–4 CONFIRM summaries, the draft spec's read-back). The readback is built in code from student-verbatim items plus signals; there is **no model prose in a readback**. Allowed changes:
1. **Order:** the student's ideas within a section are listed in the order the scaffold suggests (`placement`/`order` with confidence ≥ 0.7); otherwise saved order.
2. **Flag a misplaced idea** (scripted template): "This idea might land better in {section label}." + the idea in the student's words + **Move it** / **Keep it here**. Move transfers the idea note to that section's `section_decisions.ideas` unchanged (logged `idea_moved`); nothing else changes. Keep logs `idea_kept` and hides the flag for that idea.
3. **Pacing flag** (scripted): "{Section label} has a lot of ideas and {other label} is light. Want to look at them?" + jump buttons.
4. **Gap flag** (scripted): "{Section label} doesn't have an idea yet." / "…doesn't have a source yet." + jump button.
5. **Weight flag (t58)** (scripted): "Your sentence {n} plan carries a lot. Want to split that idea?" (from `sentenceWeight`; names only the student's plan row number).
- At most 2 flags per readback, only at confidence ≥ 0.7; when unsure, show nothing (same default as the logic checkpoint). Flags never block, never gate, and never say or imply "the coach's version" or "the right answer." **The hidden draft never overwrites the student's voice:** it never supplies words, never rephrases an idea, and is never used as a voice baseline, mismatch comparison, Stage 6 check, checker input or grade.

### 2C.8 Hidden-draft leak guard (H1–H8)
1. **H1 Isolation in code.** Hidden-draft text has a branded type (`HiddenDraftText`) that exists only in `lib/server/hiddenDraft/*`. An ESLint rule (`no-restricted-imports`) blocks importing that module anywhere except `lib/server/readback/*` (which may import only `getSignals()`), and blocks it entirely in `app/**/page.tsx`, client components, route-handler response builders, export builders, email templates and TTS code.
2. **H2 Readbacks are code-built.** Every readback, skeleton and zoom-out string comes from student-verbatim saved text, verbatim teacher or verified-source text, short labels, or scripted templates with those slots. No model prose.
3. **H3 Pre-send similarity check against the hidden draft.** Before any student-facing string in Stages 2–5 leaves the server (coach questions, feedback, rubric explainers, readbacks, skeleton, zoom-out, flags, Ask the coach answers), `assertNoHiddenDraftLeak(output, hiddenDraft, studentCorpus)` runs. `studentCorpus` = the student's own saved text + assignment text + verified excerpts (words the hidden draft legitimately shares with the student don't count). Reject if:
   - (a) **n-gram:** any 5-token n-gram (lowercased, punctuation-stripped) appears in the hidden draft and **not** in `studentCorpus`;
   - (b) **near-verbatim:** for any output sentence, the share of its non-student-corpus content tokens found in a single hidden-draft sentence is ≥ 0.5 (token-set containment), or normalized character 4-gram Jaccard with any hidden-draft sentence is ≥ 0.6;
   - (c) **canary:** the output contains the per-paper canary token embedded in the hidden draft (tests only; see H8).
   On a hit, the output is blocked and replaced by the scripted or verbatim-only fallback for that surface; log `hidden_draft_leak_blocked {surface, rule}` (no text). Thresholds [PROVISIONAL]. When `FEATURES.hiddenDraft` is off, H3 is a no-op.
4. **H4 Never exported.** The outline export allow-list (2A.7) is unchanged and contains no hidden-draft field; .docx and PDF builders can't import the module (H1). Same for data-export downloads and emails.
5. **H5 Never in an API response.** Every route handler's response is a strict Zod schema with no hidden-draft fields; `private.hidden_drafts` is unreachable from the client (2C.7); a route-wide integration test asserts the canary never appears in any JSON response, server-rendered HTML, RSC payload or streamed chunk.
6. **H6 Never in other prompts.** Hidden-draft text is never passed into any other model call (coach questions, feedback, logic checkpoint, rubric explainers, TTS scripts). Only `HiddenDraftSignals` may be passed, and only to code (not prompts) [PROVISIONAL].
7. **H7 Never logged.** Logger and Sentry redaction for the `HiddenDraftText` type and the `private.hidden_drafts` table; `session_events.detail` holds counts, ids and enums only.
8. **H8 Canary tests.** Test fixtures inject a unique canary phrase into the hidden draft and assert it never appears in exports, API/RSC responses, emails, TTS scripts, logs, `session_events`, or any rendered page across a full Stage 1–5 run (Playwright).

### 2C.9 UI states
- **Ghost:** `hidden` (Stage 1 before DISSECT) → `empty` (labels only) → `filling` (per-section fill levels) → `complete` (all confirmed / all drafted); per block: `not_started`, `started`, `has_ideas`, `has_sources`, `confirmed`, `skipped`, `drafting`, `drafted`. A block shows a small dot when a readback flag is waiting (no count badge, no red).
- **Peek:** `disabled` by default (`SKELETON_PEEKS = false`, t58). If enabled: `expanded` → `collapsed` on Keep going or the next input.
- **Drafting milestone pop-up (t58):** `ghost_background` (skeleton faded behind "{Section label} is done." with **Ready for section {n}?** / **Do you want to review?**) → `review_all` (skeleton readable and focusable; sections clickable) → exit via `ready_for_next` or `jump`.
- **Zoom-out:** `opening` (from milestone or ghost click) → `shown` (skeleton renders from code instantly) → `flags_loaded` (0–2 flags appear if signals arrive; otherwise none) → exit via `jump` or `ready_for_next` (or **Close** when opened on demand from the ghost). The milestone zoom-out can't be dismissed by an outside click; Esc = Close only for on-demand views (milestone views require Ready for next or a jump, so the student doesn't skip past by accident).
- **Payoff:** `payoff_shown` once per paper at the end of Drafting (t58); re-openable. Outline stage: light "Your outline is complete." line only.
- **Jump:** `preview` (locked future, read-only), `edit` (current or reopened), with the **Back to where you were** chip `active` until used or until the next milestone.

### 2C.10 Mobile
- **Ghost:** a thin segmented progress strip under the header (one segment per section, filling in), 6 px tall with a 44 px tap target; tap → zoom-out bottom sheet. It never sits over the editor or the keyboard.
- **Zoom-out:** a full-screen sheet with a vertical list of sections (collapsed rows; tap to expand the student's words; second tap or **Edit** to jump). **Ready for next** is a sticky bottom button above the safe-area inset.
- **Peek (off by default, t58):** if enabled, the strip expands into a compact card (max 40% of the viewport) between the header and the beat, with **Keep going**; it never opens while the keyboard is up (it waits until the field blurs).
- **Jump chip:** **Back to where you were** as a sticky pill above the keyboard area; the editor scroll position is restored on return.
- **Payoff:** same content, single column, stat row first.

### 2C.11 Accessibility
- The ghost is a labeled region (`<nav aria-label="Paper progress">`) with a text summary ("4 of 6 sections confirmed"); it's not a live region (no announcement on every fill). Each block is a button with an accessible name (label + status).
- The zoom-out and payoff are `role="dialog"` with `aria-modal="true"` on desktop (full screen on mobile), focus moves to the heading on open and back to the triggering element (or the next beat's first field after Ready for next) on close; focus is trapped while open. A milestone opening is announced once via `aria-live="polite"`: "{Section label} is done. Here's your paper so far."
- Status is never color-only (text labels + icons). Contrast ≥ 4.5:1, including the low-contrast ghost text (it's de-emphasized by size and weight, not contrast).
- Fully keyboard operable: Tab through sections, Enter to jump, a visible **Ready for next** button. `prefers-reduced-motion`: no fill animations, no reveal.
- Readback flags are plain text with real buttons; the **Move it** action announces the result ("Moved to Body 2.").

### 2C.12 Data model — migration `supabase/migrations/0011_interaction_layer.sql` (spec-only, PROVISIONAL)
0009 stays reserved (section-loop fallback) and 0010 is the drafting muscle (draft spec section 12), so this is **0011**. Do not apply until Colton approves.
```sql
-- 0011_interaction_layer.sql  (PROVISIONAL, t57)
create schema if not exists private;          -- NOT added to the exposed API schemas
revoke all on schema private from anon, authenticated;

create table private.hidden_drafts (
  paper_id uuid primary key references public.papers on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  version int not null default 1,
  mode text not null check (mode in ('prose','structure')),
  ledger_hash text not null,
  text jsonb,                                 -- HiddenDraft.text; null in 'structure' mode or after purge
  signals jsonb not null,                     -- HiddenDraftSignals (ids/enums/numbers only)
  generated_at timestamptz not null default now(),
  trigger text not null,                      -- section_complete | outline_approved | draft_section_done
  generations int not null default 1,         -- per-paper cap check
  purge_after timestamptz not null,           -- min(created + 90d, draft_completed + 30d)
  created_at timestamptz not null default now()
);
alter table private.hidden_drafts enable row level security;   -- no policies: service role only

alter table public.papers add column if not exists payoff_shown_at timestamptz;   -- end-of-Drafting payoff shown once (t58)
```
- `stage_progress.data.resumeBeat` (`{stage, sectionKey, step, beatId}`) and the skeleton shape are Zod-only (no SQL). The skeleton is computed, not stored.
- `/api/cron/hidden-draft-purge` (daily, `CRON_SECRET`).

### 2C.13 Events (`session_events`; counts, ids and enums only)
`skeleton_ghost_opened {stage}`, `skeleton_peek_shown {stage, sectionKey}`, `skeleton_peek_disabled`, `skeleton_zoomout_shown {stage, milestone, sectionKey}`, `skeleton_zoomout_closed {via}`, `section_jump {fromStage, toSection, toStep, mode: edit|preview}`, `jump_returned`, `ready_for_next {stage, milestone}`, `outline_complete_shown`, `draft_payoff_shown {paragraphs, sources, studentWords}`, `review_all_opened {stage}`, `lead_wildcard_flag_shown`, `lead_wildcard_flag_override`, `intro_revisit_shown`, `intro_revisit_edited`, `readback_flag_shown {kind}`, `idea_moved {fromSection, toSection}`, `idea_kept`, `hidden_draft_generated {version, trigger, mode, ms}`, `hidden_draft_skipped {reason}`, `hidden_draft_failed {reason}`, `hidden_draft_leak_blocked {surface, rule}`, `hidden_draft_deleted {reason}`.

### 2C.14 Tests (Vitest + Playwright; PROVISIONAL)
1. **Rhythm:** every Stage 2–5 beat screen renders exactly one question or frame; each has a valid beat address; step order is unchanged (2A/2B tests still pass).
2. **Ghost:** absent in Stage 1 before DISSECT; empty labels after DISSECT; fill levels track saved data; contains only labels and student-verbatim text (string-origin test); no model call.
3. **Zoom-out placement (t58):** none in Stage 1; one after the thesis is saved; one after each section's loop completes (after any logic tier, including Continue anyway); none after a skip; **no peeks** with the default `SKELETON_PEEKS = false`; Drafting shows the milestone pop-up after each section (ghost background, readable only after **Review all**, **Ready for section {n}?** / **Do you want to review?**).
4. **Payoff (t58):** shown once at the **end of Drafting** with "Look at everything you wrote." and the full outline (intro, body, support, conclusion) in the student's own sentences; the outline stage's last zoom-out shows only "Your outline is complete."; the internal phrase and any profanity appear nowhere in app code or copy files (CI grep, pattern built from parts); `studentWords` counts only the student's own words.
5. **Jump/resume:** clicking a confirmed section opens CONFIRM with Edit and reopens per existing rules; a locked section opens read-only and writes nothing; **Back to where you were** restores the exact beat, scroll and focus; deep links survive refresh and Back; gates are never bypassed.
6. **Readback shaping:** flags appear only at confidence ≥ 0.7, max 2; every flag string is a scripted template with label or student-verbatim slots; Move transfers the idea unchanged; Keep hides it; logic tier unaffected by signals.
7. **Leak guard:** (a) a readback containing a 5-gram from the hidden draft that's not in the student corpus is blocked and logged; (b) a paraphrase with ≥ 0.5 novel-token containment is blocked; (c) a 5-gram the student wrote themselves (also in the hidden draft) passes; (d) canary absent from .docx/PDF, every API/RSC response, emails, TTS scripts, logs and `session_events` across a full run; (e) ESLint fails on importing `lib/server/hiddenDraft` from a client component or export builder; (f) `private.hidden_drafts` is unreachable with the anon or authenticated key.
8. **Regeneration and retention:** regenerated only at milestones and only when the ledger hash changed; cap enforced; overwrite keeps one row; purge nulls text after `purge_after`; paper deletion cascades; `structure` mode stores no text.
9. **Accessibility:** axe passes on ghost, zoom-out and payoff; focus moves and returns correctly; reduced motion disables animation; the milestone announcement fires once.
10. **Flags off:** with `FEATURES.interactionLayer = false` the classic transitions render and no skeleton events fire; with `FEATURES.hiddenDraft = false` no generation runs, no row is written and H3 is a no-op.

---

## 3. STAGE 2 — Stance interview

**t47:** Stage 2 has two parts: **2a** (below: cluster, 3 moves, refined thesis, unchanged) and **2b**, the per-section TEACH + PROBE inside the loop, specified in sections 2B and 2A.2. The lesson (`papers.lesson`) and `prompt_type` are passed to every Stage 2 call. For `personal_experience` papers, the cluster defaults to `personal_reflective` (the student can change it) and the moves use personal-detail phrasings.

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

6. **Per-section TEACH + PROBE pass** (sections 2B.4 and 2A.2; memory mode 2B.8), after the refined thesis.

**Stage 2 complete when:** cluster set, 3 moves answered (or flagged stuck), a refined thesis saved (passed or flagged-advance), and every roadmap section has a TEACH status (t47; explored, skipped, mirrored or not applicable) and a PROBE result (ideas saved). Skipped sections block completion until finished. With the section-first loop, Stages 3–4 work on section 1 can happen before Stage 2 is complete (section 2A.1).

---

## 4. STAGE 3 — Outline

### 4.1 Structure
Target length: prefer the confirmed Stage 1 assignment card (`assignments.requirements.length` — explicit words if present, otherwise the page-derived estimate at 275 words per double-spaced page; ranges use the midpoint). If the card is missing or marked "Not specified," fall back to parsing `papers.required_length` (`/(\d[\d,]*)\s*(words?|pages?)/i`; same 275 and midpoint rules). If still unparseable, ask the student for a number of words or pages in a small inline field; default 1,000 words.

| Target words | Body sections (N) |
|---|---|
| < 1,500 | 3 |
| 1,500–3,000 | 4 |
| > 3,000 | 5 |

**Roadmap first (Nov 20, 2026):** the cards are the confirmed Stage 1 roadmap sections (`section_plans`), in that order, with the teacher's names. The default below applies only when the rubric/prompt names no sections; the Counterargument & Rebuttal card is included **only when the rubric/assignment asks for one** (confirmed by Colton, t47, decision 43). Each card runs the SEARCH step (section 2A.3) and is prefilled from that section's saved decisions.

Default outline = **Intro** + **Body 1…N** + **Conclusion** (N + 2 cards), plus **Counterargument & Rebuttal** only when the assignment requires one (decision 43). Intro is fixed first, Conclusion fixed last; Body cards and the Counterargument card can be reordered between them. The student may remove one body card only if N > 3 (floor of 3 body cards).

### 4.2 What each card contains (all student-written; AI writes none of it)
- **Intro:** hook idea note (≥ 5 words, a note on *how* they'll open, not the sentence); **thesis** (read-only copy of Stage 2 `refinedThesis`; "Revise thesis" link opens an edit that logs `outline_edited` and re-runs the thesis rubric as advisory).
- **Body (each):** `claim` (one sentence, 8–40 words, student-typed); `evidenceNotes[]` (≥ 1, up to 4; each ≥ 5 words, e.g. "Chapter 3 stats on turnout"; optional `sourceId` linkable later in Stage 4/5); `explanationNote` (≥ 10 words: "why this evidence proves the claim").
- **Counterargument & Rebuttal** (only when the assignment requires it, decision 43): shows the student's three Stage 2 move responses as a read-only reference; student chooses which counterargument they'll address (select) and writes `counterNote` (≥ 10 words: what the objection is, in their words) and `rebuttalNote` (≥ 15 words: how they'll respond).
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

## 5. STAGE 5 — Drafting (student-facing label: exactly "Drafting"; t58)

> **t53/t56/t58:** Colton calls this stage **Drafting** (his Stage 3); that's the student-facing label everywhere. Internal ids stay stage 5 / `draft`. The per-paragraph drafting muscle is specified in `retainwrite-stage3-draft-spec.md` (pointer in section 5B). Until its flag is on, 5.1–5.3 below are the shipping behavior.

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
   Show as a card: "What's working", "Questions to think about", "Evidence you planned vs. used", style note (if tripped, t48: the gentle voice nudge from section 7, not an amber warning).
7. **Student marks done.** Enabled when: (hard) section ≥ minimum words, the locked topic sentence is still the first sentence of the text, and feedback was viewed. (Soft; never blocking) anything feedback flagged; flagged items are copied into `stage_progress.data.carryFlags` for Stage 6. If `evidenceUsed` shows 0 present on a body section, the student must write a ≥ 15-word "Why I haven't used evidence yet" note (saved, carried to Stage 6) before marking done.
8. **Unlock next section.**

On section submit, the light-cleanup flags (section 6.1 item 12) may also appear for that section, as flags only; the full pass runs in Stage 6.

**Stage 5 complete when:** every section is done and the assembled draft is ≥ 300 words. On completion: assemble sections in order (blank line between; no generated connective text), compute metrics, run mismatch on the whole draft, save `drafts` version 1, log `stage_completed`.

Side panel (all sections): outline (collapsible), Stage 4 source cards, the story angle and thesis pinned, and each section's confirmed decision (leader, style, ideas). No "write this for me" control anywhere.

---

## 5B. Drafting muscle (Colton's Stage 3, label "Drafting") — moved to its own spec (t56; updated t58)

> **Status (t58):** Colton's t58 decisions are folded in; remaining open items are listed in that spec's section 15. The drafting muscle drafted here in t53 now lives in **`retainwrite-stage3-draft-spec.md`** ("Stage 3 — draft stage" per Colton; it's this doc's Stage 5 route). That doc holds the locked ledger, the framework, intro-first teach-then-draft with per-type intro variants, one paragraph per major point, rubric intro explainers, tightening with generic arc language, the drafting guard, migration `0010_drafting_muscle.sql`, events, acceptance tests and open questions, plus decisions 48–60. Until Colton approves it, sections 5.1–5.3 above remain the shipping draft behavior (build item S3-t56 ships behind `FEATURES.draftingMuscle = false`).

---

## 6. STAGE 6 — Revise & professor feedback

### 6.1 Revision checklist (student-facing)

> **t58 [PROVISIONAL, pending research validation]: intro revisit first.** When the Drafting muscle is on, the revision checklist opens with an **intro revisit** before item 1: the coach shows the student's own intro next to their own body topic sentences and conclusion and asks questions only ("Does your intro promise what your body paragraphs deliver?", "Is your main point in the intro still the point you ended on?"). The student edits; nothing is rewritten. Drafting deliberately produced a rough intro for direction (Drafting spec 5.6, decision 81). Logged `intro_revisit_shown`, `intro_revisit_edited`.

Header: "Revise it in your own words. Each item is checked by you, by the app, or both." This is the final assembly and **light** quality check (INTD600 Phase 7): items point out what's missing or unclear and never coach the student to polish away their natural voice (slight imperfection is fine; the reason is authenticity, never AI detectors). Items:

| # | Item | Check type | How it works | Resolved when |
|---|---|---|---|---|
| 1 | Thesis is present in the intro | Auto | Content-word overlap (≥ 60% of refined thesis stems) in the intro section | Pass, or student note ≥ 10 words |
| 2 | Every outline section appears | Auto | Section keys preserved in the assembled draft, each ≥ its minimum words | Pass |
| 3 | Planned evidence appears | Auto | Each outline evidence note has stem overlap ≥ 2 content words somewhere in its section | Pass, or note ≥ 10 words for misses |
| 4 | Citation integrity (INTD600 Phase 6): present, formatted for {citation_style}, tied to claims, disambiguated | Auto + self | Regex check: in-text pattern count (APA `(Author, 2020)`, MLA `(Author 12)`, Chicago footnote markers or author-date), and a "References/Works Cited/Bibliography" heading exists. Plus: (a) **tied to claims** — each Stage 3 `needsCitation` row's section contains an in-text citation, and citations are not clustered only in the final paragraph/sentences of the draft (flag if > 50% of in-text citations fall in the last 10% of the text); (b) **a/b/c suffixes** — in author-date styles (APA, Harvard, Chicago author-date), if the reference list has two or more works by the same author(s) in the same year, in-text citations and references must use matching suffixes (2020a, 2020b); in MLA, same-author works must use short titles. Shown as questions ("Which claim does this citation support?"); the app never inserts or rewrites citations. Student confirms formatting by hand | Auto pass (or a ≥ 10-word note per miss) + self tick |
| 5 | Sounds like you | Auto | Mismatch check on the whole draft (section 7); shows the gentle voice nudge (t48) with the specific tells under **What we noticed** and the per-section hot spots | No nudge, or for each nudged part the student either opens **Make it sound like me** and saves a revision, or taps **Keep it as is** (no note required, no penalty, logged neutrally) |
| 6 | Length meets the assignment | Auto | Word count vs. parsed target (±15%) | Pass or note |
| 7 | Thesis is clear and arguable | AI (`MODEL_STRONG`, on demand) | Re-runs the rubric C1–C3 as questions | Student marks "reviewed"; required self-check with note if Stage 2 thesis was flag-advanced |
| 8 | Each paragraph ties back to the thesis | AI (`MODEL_STRONG`) | Per-section `supportsThesis` on the full draft; lists weak sections as questions | Student marks reviewed |
| 9 | The counterargument is addressed (only when the assignment requires a counterargument, decision 43; otherwise the item is hidden and counts as resolved) | AI (`MODEL_STRONG`) | Detects whether the counterargument section engages the chosen Stage 2 objection | Student marks reviewed |
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
- **Trigger rule:** warn when **≥ 2 tells** (from different signals; sentence length and reading grade count as separate signals) **or ≥ 1 strong signal**. If the sample is under 200 words, the sentence-length signal's "strong" level is treated as a plain tell (so it needs a second signal), to reduce noise from short samples. **Paste-weighted baseline (Colton, Nov 20, 2026, t44/t45):** baseline metrics are typed-weighted (`w = 1 − 0.8 × paste_ratio`). If fewer than 150 baseline words were typed or spoken, apply the short-sample downgrade (no strong levels). **Bottom-of-panel voice note (t51 hybrid rule, replaces the t45 > 60% and t47 ≥ 95% rules):** the Stage 6 comparison shows at most one note, chosen by `voiceNoteFor()` from the natural (typed/spoken) words captured across the paper and the pasted share: ≥ 600 natural words → none; 200–599 → `VOICE_NOTE_ANSWERS` only if > 60% pasted; 80–199 → a lighter-read note (`VOICE_NOTE_ANSWERS`, or `VOICE_NOTE_ANSWERS_SHORT` when ≤ 60% pasted); < 80 → `VOICE_NOTE_ANSWERS_LOW` [PROVISIONAL numbers; section 2B.10]. It is never shown when there is no baseline (N/A behavior unchanged).
- **Direction:** only upward jumps are evaluated; a draft simpler than the sample never warns.
- **Output** (saved to `drafts.mismatch` / section state / event): `{triggered, tells: [{signal, sampleValue, draftValue, level}], examples: string[]}`.
- **Voice nudge copy (Colton, t48; replaces the amber warning, the “This reads differently from your sample” headline, and the “I've reworked it” / “This is my writing” buttons).** Non-blocking, warm, never a check-in or an accusation. Shown inline on the nudged part (Stage 5 section feedback and Stage 6 item 5), in a soft neutral style (no amber, no ⚠):
  > **This part sounds a little different from your usual voice. Want to read it aloud and make it sound more like you?**

  Under it, a collapsed **What we noticed** line names the specific tells in plain words (e.g. “sentences here average 32 words; yours usually run about 14”, “a reading level about 5 grades above your usual”, “words you don't usually use: X, Y, Z”). Short-sample downgrade wording stays softer (“might sound a little different”).

  Buttons:
  - **Make it sound like me** (primary) → opens the voice-tips/rework panel for that part: highlights the longest sentences and unusual words, a **Read it aloud** button (`speechSynthesis`) for just that part, and up to 3 coaching tips from the tells (“Try splitting the longest sentence”, “Swap a word you wouldn't say out loud for one you would”). Coaching only: no rewritten text, no example sentences. Saving a revision re-runs the check. Logs `voice_nudge_rework_opened`.
  - **Keep it as is** → dismisses the nudge for that part of this version; logged neutrally as `voice_nudge_kept`; no note, no penalty, no follow-up question, and the wording never implies the student didn't write it. It resolves checklist item 5 for that part.
  - Showing the nudge logs `voice_nudge_shown {level, tells, section}`.
  - Retired strings (CI grep over app code; patterns built from parts): the old headline, “I've reworked it”, “This is my writing”, “I reworked these”, “it's my writing”.
- **Tuning plan:** after ~50 completed papers, review `/admin/sop`: target a nudge rate of ~10–20% of drafts; if > 30% loosen tells (e.g. +70% / +5 grades); if < 5% tighten. Also track how often students choose **Make it sound like me** vs. **Keep it as is** (t48).

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
Nov 20, 2026 (t58): Drafting tests 22–28 in `retainwrite-stage3-draft-spec.md` section 14; 2C.14 items 3–4 updated (section-only zoom-outs, peeks off, payoff at end of Drafting); wildcard flag: an allegation-flagged wildcard shows "Reported, not confirmed.", is never preselected, can be picked by the student (override logged), and every refresh batch carries a wildcard.
Nov 20, 2026 (t57) PROVISIONAL, INTERACTION LAYER + HIDDEN DRAFT: see section 2C.14 (rhythm, ghost, zoom-out placement and peeks, payoff copy and CI grep, jump/resume, readback shaping, leak guard H1–H8 with canary and similarity tests, regeneration/retention, accessibility, flags off). Not built until Colton approves.
Nov 20, 2026 (t53/t56) PROVISIONAL, DRAFTING MUSCLE: see `retainwrite-stage3-draft-spec.md` section 14 (ledger lock, framework, intro first, per-type intro variants, rubric intro requirements, rough intro OK, tightening and arc frames (t58: replaced by connector example language), drafting-guard topic-leak set and nightly 0-leak eval, stall, paste, gates unchanged, feature flag). Not built until Colton approves.
Nov 20, 2026 (t51/t52) additions: **hybrid voice note** via `voiceNoteFor()`: the **58-page paper** (4,200 counted answer words, pastedShare 0.70 → naturalWords 1,260) → **no note**; a **short session with moderate paste** (260 words, pastedShare 0.45 → naturalWords 143) → `VOICE_NOTE_ANSWERS_SHORT`; 300 words at 0.70 → 90 → `VOICE_NOTE_ANSWERS`; 400 words at 0.50 → 200 → no note; 700 words at 0.65 → 245 → `VOICE_NOTE_ANSWERS`; 210 words at 0.65 → 74 → `VOICE_NOTE_ANSWERS_LOW`; 250 words fully pasted → 0 → `VOICE_NOTE_ANSWERS_LOW`; 210 words fully typed (Stage 1 minimum only) → 210 at 0.0 → no note; boundaries 600 vs. 599 and 200 vs. 199 at pastedShare 0.61 (none vs. note; note vs. note), 80 vs. 79 (lighter vs. stronger), 0.60 vs. 0.61 in the `enough` tier (none vs. note); dictated words count as natural; Stage 5 draft text and Stage 3 notes don't change `naturalWords`; no baseline → no note; public sample: 150 typed words → `VOICE_NOTE_SAMPLE_SHORT`, 650 typed → none, 650 pasted → `VOICE_NOTE_SAMPLE_LOW`; `VOICE_NOTE_ANSWERS_ALL` and `VOICE_ALL_PASTED_SHARE` appear nowhere in app code. **Memory triggers:** the gentle-invitation test passes for every bank line (section 2B.8); a line like "Did you lose a tooth?" fails it.
Nov 20, 2026 (t48) additions, VOICE NUDGE: a triggered mismatch shows the exact t48 copy with **What we noticed** naming each tell; **Make it sound like me** opens the rework panel (highlights, read-aloud for that part, ≤ 3 tips, no rewritten text) and logs `voice_nudge_rework_opened`; **Keep it as is** dismisses, logs `voice_nudge_kept`, requires no note and resolves item 5; no amber/⚠ styling; CI grep: the retired headline and button strings (patterns built from parts) and the events `mismatch_warned` / `mismatch_response` appear nowhere in app code.
Nov 20, 2026 (t47) additions, LESSON-FIRST LOOP: see section 2B.13 (lesson extraction, three-path routing, TEACH and teach-then-ask, highlight reel + search offer, ranked leads + one wildcard counted toward the cap, memory-forward path with scripted gentle triggers and a clamped light checkpoint, logic-checkpoint opener and red alert, counterargument only when required, `VOICE_NOTE_ANSWERS_ALL` at ≥ 0.95).
Nov 20, 2026 (t46) additions: a ≥ 80-word paste in the Stage 5/6 editors shows the suggestion once per session per paper (a second big paste in another section → not shown again; a new browser session → shown again); it is inline, not a modal, has no answer controls, and writes no choice; .docx/.txt import doesn't show it; < 80 words doesn't show it; `drafts.section_paste_meta` is saved on submit; Stage 6 shows `VOICE_NOTE_ANSWERS` above 0.60 pasted share; CI grep: the retired Stage 5 question string (pattern built from parts) appears nowhere in app code or in the build specs outside changelog lines and `.bak` files; `paste_confirm` appears nowhere in app code.
Nov 20, 2026 (t43–t45) additions, PASTE: no `preventDefault` in any paste/drop/copy/cut/beforeinput/contextmenu handler anywhere in `app/` or `components/` (CI grep, no exceptions); Stage 2 moves, thesis, PROBE ideas, and logic-checkpoint answers accept paste on desktop and iOS long-press; `paste_ratio` is clamped and computed server-side; a typed-weighted baseline (fully pasted answer weight 0.2); < 150 typed baseline words → short-sample downgrade; Stage 6 shows the (t46: soft) bottom note only when the baseline pasted share is > 0.60, not at 0.60, and never when there is no baseline; dictated text counts as typed.
Nov 20, 2026 (t41/t42) additions, LOGIC CHECKPOINT: (a) **Hitler example** (assignment “Analyze a historical leader's leadership style and evaluate it against the ethical leadership principles from Unit 3”; student note “Hitler was an objectively moral leader”) → `tier = 'strong'`, `basis = 'contradicts_assignment'`, `citedTerm.quote` a verbatim substring of the assignment, 1–3 question angles, `reframeAvailable = true`; **and the student can still proceed:** **Continue anyway** advances, sets `logic_student_choice = 'continued'`, logs `logic_strong_continued`, the next section opens, and Stage 4 completes with the flag present. (b) **Debatable interpretation** (same assignment; “Steve Jobs's demanding style was ethical because it pushed people to do their best work”) → `moderate`; Keep my angle advances. (c) **Critical-analysis reframe** (“Hitler's leadership is a cautionary example of how charisma without ethics leads to catastrophe”) → `pass`. (d) An evidence-supportable unpopular opinion that fits the assignment never returns `strong`. (e) Downgrades: a `strong` with confidence < 0.80 or a non-verbatim `citedTerm` becomes `moderate`; a `moderate` with confidence < 0.60 becomes `pass`. (f) Model error, timeout, guard reject or rate limit → `pass` + `logic_check_failed_open`, and no card shown. (g) The guard rejects a `reason` or `question` with rewrite cues, a pasteable quoted sentence, > 12 copied words, or a question not ending in “?”. (h) **No gating anywhere:** `assertSectionStepUnlocked`, Stage 4 completion and Stage 5 entry never read `logic_tier`; a search of the gate code finds no `logic_` reference. (i) The check re-runs after Revise / New angle / Reframe and doesn't run for skipped sections. Golden cases (a)–(d) also live in `evals/logic-checkpoint.jsonl`, run nightly against the live model; unit tests mock the model.
Nov 20, 2026 (t40) additions: `assertSectionStepUnlocked` blocks section k+1 writes until every earlier section is confirmed or skipped, and blocks out-of-order steps; preview routes write nothing; skip sets `status='skipped'` and shows the reminder bar with a working jump-back link on every Stage 2–4 screen; Stage 5 stays locked while any section is skipped; lead batches have 3–5 items (fewer only for the final capped batch); “Show me 3–5 more” never repeats a lead; the 21st AI-suggested lead per paper is rejected server-side and the search-prompt card appears; the query builder output is ≤ 32 words, uses only section/rubric/story terms and escapes quotes; brought-back names don't count toward the cap and are `to_verify`; .docx and PDF exports contain the allow-listed fields only (canary test), are stamped In progress when sections are unfinished, and are not stored.
Nov 20, 2026 (t39) additions: roadmap drives Stage 3 cards; Stage 2 completes only with every section probed; warm-up shown before any lead when the student freezes; leads/cards/probes without a valid `rubricRef` are rejected; idea notes pass the no-finished-sentence rule; transition suggestions contain only bank phrases; CONFIRM writes `confirm_snapshot` and Stage 4 completes only when every section is confirmed; Stage 5 draft view renders from `section_decisions` with no re-asked questions; light-cleanup `fix` rejected unless single-word or citation-format; guard rejects "% AI"-style phrasing.
Nov 20, 2026 additions: sentence-plan gate (≥ 2 rows per body card, evidence rows flagged), guard rejects AI-written `purposeNote`, `rawMaterial` phrases must be verbatim substrings, citation clustering flag, a/b/c suffix detection (same author + year without matching suffixes flagged in APA; short titles in MLA), Stage 2 receives `storyAngle`.
Cluster/slot verification (non-substring slot rejected), `pickMoves` determinism and absolute-word rule, thesis deterministic checks, thesis max-attempt flag-advance, outline section count by length, approval gating, section minimum formula, paste threshold, mismatch table (each tell, strong, two-tell, exclusions, min length, short-sample downgrade), checklist completion logic, feedback auto-grant conditions and rate limit, dedupe hash, `grant_feedback_credit` idempotency, guardian gating, AI output guard (rewrite phrases rejected), AI fallback paths.

---

## 13. Changelog

- **Nov 20, 2026 (t67):** Section 2C status → **BUILD-READY** (build item S3-t57); former blockers carry [PROVISIONAL] build defaults (Drafting spec section 15); flags switched on for production after acceptance tests pass.
- **Nov 20, 2026 (t58):** Colton's t58 decisions. The draft stage's student-facing label is exactly **Drafting** (section 5 heading; internal ids unchanged). 2C updated: zoom-outs after each section only, peeks off by default (`SKELETON_PEEKS = false`), the Drafting milestone pop-up (background ghost, Review all, "Ready for section {n}?" / "Do you want to review?"), the big payoff moved to the end of Drafting ("Look at everything you wrote."; the outline stage keeps a light "Your outline is complete." line), hidden draft described as the server-side full-paper answer key with a sentence-weight signal (full prose default). Decisions 37, 40, 41, 46, 47 marked LOCKED; 61–70 statuses updated; new decision 82. 2B.6 wildcard safety: allegations get a neutral "Reported, not confirmed" note instead of a block, student can override; every refresh carries a wildcard. 6.1 gains the intro revisit (provisional, pending research). Drafting decisions 73–81 are in the Drafting spec.
- **Nov 20, 2026 (t57):** Added section 2C (PROVISIONAL, first draft for Colton): the interaction design layer across Stages 1–5 (one beat at a time, progress ghost, zoom-out milestones from Stage 2 on with peeks in Stages 3–5, the end-of-Stage-3 "Look at everything you built" payoff, jump-to-edit with a resume beat, mobile and accessibility) and the hidden-draft scaffold (server-only generation per milestone, `private.hidden_drafts` storage and retention, leak guard H1–H8, readback shaping limited to reordering/flagging the student's own ideas). Decisions 61–72; spec-only migration `0011_interaction_layer.sql`; events; tests. Build item S3-t57 (pending). Sections 2A/2B and decisions 1–60 unchanged.
- **Nov 20, 2026 (t56):** Moved the section 5B drafting-muscle draft into the standalone `retainwrite-stage3-draft-spec.md` (Colton's "Stage 3 — draft stage"), which adds per-type intro variants (decision 60). Section 5B is now a pointer; decisions 48–59 moved to that doc (pointer in section 0); section 5 and section 12 pointers updated. Sections 2A/2B and decisions 1–47 unchanged.
- **Nov 20, 2026 (t53):** Added section 5B, a **first draft for Colton's review** of the drafting muscle he calls "Stage 3" (our Stage 5; numbering question open). Locked read-only ledger handoff with the topic-sentence/second-sentence skeleton, one paragraph per major point, intro-format teach-then-ask with the opening-summarizes-the-assignment rule, plain-words rubric explainer, per-paragraph loop where the student always writes first, tighten/reorder as questions, scripted topic-free arc frames, a drafting guard (`lib/ai/draftGuard.ts`) with topic-leak tests, stall handling that reuses TEACH/MIRROR/gentle triggers, unchanged paste and voice rules, spec-only migration `0010_drafting_muscle.sql`, events and acceptance tests. Provisional decisions 48–59; open questions in 5B.14. Build prompt not changed. Section 2A/2B and decisions 1–47 not changed.
- **Nov 20, 2026 (t51, t52):** Per Colton: replaced the paste-percentage-only voice-note rules with a hybrid threshold on natural (typed/spoken) words across the paper plus paste share (tiers 600 / 200 / 80, all [PROVISIONAL]), with new short and low strings (`VOICE_NOTE_ANSWERS_ALL` retired), cached counts on `papers` and `voice_profiles.natural_words` (folded into 0008, else 0009), and tests including the 58-page example (decision 46; 2B.10, section 7). Rewrote every memory trigger as a gentle invitation that connects back to the paper, with a CI/guard phrasing test (decision 47; 2B.8).
- **Nov 20, 2026 (t48):** Per Colton, softened the Stage 6 (and Stage 5) voice-mismatch warning into a gentle voice nudge: “This part sounds a little different from your usual voice. Want to read it aloud and make it sound more like you?” with **Make it sound like me** / **Keep it as is**; tells still named under **What we noticed**; no note required to keep. Events renamed to `voice_nudge_*`. Decision 45; sections 6.1 item 5, 7, 12.
- **Nov 20, 2026 (t47):** Folded in Colton's Stage 2 brainstorm as section 2B (the dedicated Stage 2 section-loop and research spec): THE LESSON per paper, three routing paths (`prompt_type`, section `mode`), a TEACH step before PROBE with teach-then-ask, concept vs. instance (highlight reel + search offer), ranked leads plus one Outside the box wildcard (counted toward the 20 cap), digestible source cards with a lesson link, the memory-forward path for personal prompts (MIRROR, gentle scripted triggers, optional search, memory card, light checkpoint), the logic-checkpoint opener and red alert, counterargument only when the rubric asks (confirmed), and the all-pasted voice note. Revised 2A.1–2A.6, sections 3 and 4.1/4.2. New columns folded into 0008 (else 0009). Decisions 36–44. Open research TODO on vague-prompt prevalence.
- **Nov 20, 2026 (t46):** Per Colton, replaced the Stage 5 ≥ 80-word paste modal question with a supportive, dismissible inline suggestion (once per session per paper; no answer, no buttons, no recorded choice; quiet paste metadata only; `paste_confirm` removed). Decision 9 updated, decision 35 added, section 5.2 rewritten. The Stage 6 voice note now uses the soft `VOICE_NOTE_ANSWERS` wording.
- **Nov 20, 2026 (t43/t44/t45):** Paste is now allowed in every text input across Stages 1–6 (Colton t44 removed the voice-answer exception from t43). Decision 5 is superseded, and the section 2 paste policy, Stage 2 boxes, PROBE, the logic-checkpoint inputs and 5.2 are updated. Decision 34 adds the paste-ratio mitigation, a typed-weighted baseline, and (t45) the bottom-of-panel “Voice was not reliably determined” note in Stage 6 when the baseline is more than 60% pasted.
- **Nov 20, 2026 (t41/t42):** Added Colton's mandatory per-section LOGIC CHECKPOINT after CONFIRM, before ADVANCE (decision 33, section 2A.4a). Tiers: pass / moderate / strong. Per t42 it never blocks: strong is a firm flag with alternative angles as questions and a **Continue anyway** button, logged for SOP review. Defaults to pass when unsure. Adds a Grok schema, guard rules, `logic_*` columns on `section_decisions` (folded into spec-only 0008), events and tests. t41's hard-stop tier was dropped before shipping.

- **Nov 20, 2026 (t40):** Applied Colton's answers. Section-first loop with read-only browse-ahead, a skip flag, a persistent bottom reminder and a jump-back link, and loop-span gate reconciliation (decision 25, section 2A.1). Lead sets are 3–5 with “more” / “someone specific” options, a 20-per-paper cap and a Google search-prompt handoff (decision 30, section 2A.3). Final outline exports as .docx and PDF (decision 31, section 2A.7). Voice minimum is now 200 words (decision 32). Counterargument and light-cleanup defaults marked unconfirmed by Colton. 0008 gained `section_decisions.skipped_at`, the `skipped` status, and `research_leads.origin` / `batch_no`.
- **Nov 20, 2026 (t39):** Coaching philosophy folded in: per-section loop in Stages 2–4, philosophy hard limits in the guard, Stage 5 draft feedback pattern, narrow light cleanup, `0008_section_loop.sql`.
