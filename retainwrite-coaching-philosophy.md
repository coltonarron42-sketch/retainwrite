# RetainWrite — Coaching Philosophy (governing document)

**Version:** v1.7 · Nov 20, 2026 (adds a pointer to project operating rules, including the no-idle bot rule, t69; earlier: appendix interaction design layer and hidden-draft scaffold across the pipeline, t57, updated with Colton's t58 decisions; earlier: hybrid voice-note threshold, t51, and gentle memory-trigger guideline, t52; earlier: Stage 2 brainstorm t47, gentle Stage 6 voice nudge t48; earlier: LOGIC CHECKPOINT t41/t42, paste-everywhere t44/t45; his text in sections 1–4 is unchanged) · Author: Colton Simmons (owner)

**Status:** This is THE governing document for every stage, probe, summary, and interaction in RetainWrite. Where any spec or prompt conflicts with it **on philosophy**, this doc wins. The specs (`retainwrite-stage1-intake-spec.md`, `retainwrite-stage-specs.md`, `retainwrite-ai-checker-spec.md`) still hold the implementation details. Sections 1–4 are Colton's text, kept in his wording and only lightly organized. The appendix is ours.

**Project operating rules:** Standing operating rules for every bot and session (Paper Coach, RetainWrite QA, Paper Coach Marketing, Paper Coach Research, and any Cursor agent) live in `retainwrite-project-rules.md`. That file is the source of truth for those rules, including the owner's no-idle standing rule (t69). This document remains the source of truth for coaching philosophy.

---

## 1. Core philosophy

RetainWrite is not a writing tool. It is a learning system that teaches students to research, think, and write the way a strong researcher does — with AI as the guide, not the ghostwriter. The compounding skill is the real product: every session teaches the student to search sharper, question better, and turn overwhelm into a checklist. Those skills outlast any single paper.

## 2. The section-by-section loop (the engine)

1. **DISSECT** — After assignment upload and parsing, summarize what the paper needs section by section. Give the student the roadmap up front: section one is X, section two is Y, etc. This is the playbook.
2. **PROBE** — For each section, open with a yes-no choice: "Do you already have an idea of how you want this section to go, or do you want me to ask some probing questions so we can start finding research?" Respect both the student who knows and the one who needs a nudge. If they freeze or have nothing, ask warm-up questions to build a framework — never dump sources cold.
3. **SEARCH** — Run the research the student would naturally run: search terms, cross-reference against the rubric's required styles or themes, surface a list of real leaders/examples/sources. Every suggested name is flagged to verify before it counts as a citable source. Never hand a student a made-up quote.
4. **SUMMARIZE** — Give digestible source cards: the claim it supports, a short quotable excerpt, a one-line "why this fits your rubric" note. Boil down a ten-page op-ed into the exact nugget the student needs. Offer audio versions where helpful.
5. **CONFIRM** — End each section with a confirmation: "Are you comfortable moving forward with [leader] and [style]?" Save the decision. Each section's saved decisions — the ideas chosen, sources picked, leaders connected — become the skeleton the draft is built from later. The student never re-explains anything.
5a. **LOGIC CHECKPOINT** *(Colton's addition, Nov 20, 2026)* — After each section is confirmed and saved, before moving on, check the logic of the student's claim. Mandatory for every section. Two levels of pushback:
   - **Moderate pushback** — when the student's interpretation is debatable, share light feedback and let the student decide. The student is always the writer.
   - **Strong pushback** — when a claim defies logic or contradicts the assignment's own terms (e.g. calling Hitler an objectively moral leader in a leadership paper), strongly and clearly suggest edits and a different angle because it fails the logic test, but **never block the student**. The student can always continue, even with a weak paper.
6. **ADVANCE** — Move to the next section and repeat.

## 3. Hard limits (what the AI must NOT do)

- Never write the paper's sentences for the student. AI supplies structure, source excerpts, summaries, and light cleanup only. The student owns every sentence.
- Never explore outside the assignment's rubric and prompt. Stay systematic: stick to the required sections, required styles, required sources. Imagination is allowed inside those bounds — suggest angles, reframe questions, offer alternative framings — but never wander into content the rubric didn't ask for.
- Never add citations at the end as decoration. Every citation ties to a specific claim the student chose.
- Never promise to beat Turnitin or any detector. Use signal-strength framing (how strongly a pattern shows up), never "X% AI."
- Never fake clean results. If the threshold is set so normal student writing passes, say so honestly.
- Paste is optional backup, never the gate. File upload (PDF, photos, camera, screenshots) is the primary path.
- Voice capture should feel like conversation, not a chore. Short, natural, skippable.

## 4. Draft stage feedback

When the student reaches drafting, feed them back section by section, sentence by sentence. "Here are the three ideas we captured in this paragraph based on what you told me. We chose [leader], we chose [style]. Idea one: [topic sentence idea]. Write those ideas in your own words." Give transition suggestions but let them mix freely. The outline is the map; the student's voice is the road.

---

## Appendix A — How this applies (implementation map; not Colton's text)

### A.1 The loop on the six stages

The six stages are unchanged. The loop runs inside them like this:

| Loop step | Where it lives | What the student sees |
|---|---|---|
| **DISSECT** | **End of Stage 1** (after Pick your story and the early stance) | A section-by-section **roadmap** built only from the parsed rubric/prompt: each section's job, the rubric criteria it serves, required sources/styles, and a target length. The student confirms it (rename or reorder within the rubric; nothing out of scope). Saved as `section_plans`. |
| **TEACH** *(from Colton's t47 brainstorm)* | **Stage 2**, start of each section, right before PROBE | Lesson sections: a short concept card (definition, 3–5 qualities, how it shows up) for the section's concept, then “Which part interests you most?” Skippable (**I know this one**); never blocks. Personal-experience sections: **MIRROR** the prompt's own feeling word (“What does magical mean to you?”). See A.7. |
| **PROBE** | **Stage 2**, per section, after the whole-paper stance work (3 moves + refined thesis) | For each section, the exact yes/no choice. "I have an idea" → the student types their idea notes. "Ask me" → 2–4 probing questions. Freeze or nothing → warm-up questions first. Never sources cold. Answers are saved verbatim as that section's ideas. |
| **SEARCH** | **Stage 3**, per section, while the outline card is built | Search terms plus **3–5** leads at a time (people, examples, sources; “none appeal” → 3–5 more or “someone specific?”; after 20 AI-researched leads per paper, a ready-to-paste Google search prompt and the student brings names back) cross-referenced against the rubric's required styles/themes, each marked **to verify**. The student picks leaders and a style; the outline card and sentence plan are prefilled from that section's saved ideas, in the student's words. |
| **SUMMARIZE** | **Stage 4**, per section | Source cards from **verified** sources only: the claim it supports, a short verbatim excerpt (≤ 2 sentences), one line on why it fits the rubric. Audio optional (pricing unchanged). Leads that can't be verified are dropped, with a note to the student. |
| **CONFIRM** | **Stage 4**, end of each section | "Are you comfortable moving forward with [leader] and [style]?" Yes → the section decision is saved and locked into the skeleton. Not yet → back to SEARCH for that section. |
| **LOGIC CHECKPOINT** *(Colton's addition)* | **Stage 4**, right after each section's CONFIRM is saved, before ADVANCE; mandatory, **never blocking** | **Pass** shows a quiet ✓ and moves on. **Moderate**: light feedback, angle questions, “Your call. You're the writer,” and **Keep my angle** / **Adjust it**. **Strong**: a firm flag that the claim doesn't hold up, the assignment's own words, angle questions, and **Pick a new angle** / **Revise my claim** / **Reframe it** / **Continue anyway**. When unsure, it passes. Continuing past a strong flag is logged for SOP review. |
| **ADVANCE** | Within Stages 2–4, **section-first** | The next section opens only when this one is confirmed or skipped. Later sections and the rest of the workflow can be **browsed read-only**. A skipped section is flagged, with a persistent reminder bar at the bottom and a link that jumps straight back to it. Drafting (Stage 5) waits until every section is confirmed. |
| **Draft feedback** | **Stage 5 (student-facing name: Drafting, t58)**, per section | The captured ideas as short notes (never finished sentences), the chosen leader and style, the source excerpts, and transition suggestions (relationship + connective words only). The student writes every sentence. |
| **Light cleanup** | **Stage 6** (also on Stage 5 section submit) | Flags only: spelling, grammar, and citation format. The student accepts a mechanical fix or fixes it themselves. Never a rephrase. |

**THE LESSON** (t47) sits above everything: extracted from the assignment in Stage 1, shown on the roadmap, and used to weight every later step toward teaching the concept rather than the examples (A.7).

The **story angle** (INTD600 Phase 2, "Pick your story") stays early in Stage 1. The roadmap and every per-section loop sit under it: each section's PROBE and CONFIRM show the chosen story so the sections stay on one spine.

### A.2 The loop and the INTD600 phases

| INTD600 phase | Loop step(s) | Stage |
|---|---|---|
| 1. Capture the real assignment first | (input to DISSECT) | Stage 1 |
| 2. Generate story options and pick early | (spine above the loop) | End of Stage 1 |
| — | DISSECT | End of Stage 1 |
| 3. Structured interview for raw material | TEACH (t47) + PROBE | Stage 2 |
| 4. Sentence-level outline with flagged citations and short excerpts | SEARCH (Stage 3) + SUMMARIZE + CONFIRM + LOGIC CHECKPOINT (Stage 4) | Stages 3–4 |
| 5. Student writes every sentence | Draft feedback | Stage 5 |
| 6. Citation integrity with a/b/c suffixes | (hard limit: citations tied to claims) | Stage 6 |
| 7. Final assembly and light quality check | Light cleanup | Stage 6 |

### A.3 Definitions used across the specs

- **Leader** — a person, organization, case, or example the student chose for a section (from SEARCH). Generic name for "leaders/examples/sources."
- **Style** — the rubric's required style, theme, framework, or lens that the section uses (e.g. a named leadership style or theory). If the rubric names none, CONFIRM uses the section's angle instead.
- **Section decision** — the saved result of a section's loop: idea notes (student's words), chosen leaders, chosen style, verified sources/excerpts, and the confirmation. It's the skeleton for the outline and the draft.
- **Light cleanup** — flags for spelling, grammar, and citation format that the student accepts or fixes. One-click accept is allowed only for a single-word spelling fix, a single-word grammatical form (e.g. "was" → "were"), or a citation-format fix (punctuation, order, capitalization, a/b/c suffix). Never synonyms, reordering, sentence merges or splits, or any rephrase.
- **THE LESSON** (t47) — what the assignment is trying to teach, why the paper is assigned, and what the student should learn. Stored per paper. Examples serve the lesson.
- **Concept vs. instance** (t47) — a concept is a style, theory, framework, or device (textbook treatment); an instance is a named person, organization, case, work, or event (a 1–2 move highlight reel, then an offer to search).
- **Wildcard lead** (t47) — the one **Outside the box** lead per batch: same pattern as the lesson, from a different field, labeled as a stretch, never preselected.
- **Prompt type** (t47) — `lesson`, `personal_experience`, or `mixed`; personal-experience sections run memory-forward.
- **Rubric scope** — every probe, lead, source card, and suggestion must point to a requirement in the confirmed assignment or roadmap (`rubricRef`). No `rubricRef`, no output.

### A.4 Hard limits → enforcement (summary)

| Hard limit | Enforced by |
|---|---|
| Never write the paper's sentences | `lib/ai/guard.ts` rewrite/prose rules; idea notes must be verbatim student phrases or ≤ 12-word fragments with no sentence-ending punctuation; transitions are relationship labels + connective words only |
| Stay inside the rubric and prompt | Required `rubricRef` on every lead, source card, probe, and angle; the guard rejects outputs without one; the roadmap can't add out-of-scope sections |
| No decorative citations | Citations only through claim-linked citation flags (Stage 3) and verified source cards (Stage 4); Stage 6 checks citation-to-claim ties and end-clustering |
| No detector promises; signal strength only | Banned-phrase list in copy and model output; regex reject on "% AI"-style phrasing |
| Never fake clean results | Honest calibration and a monitored clean rate (checker spec 9.1); no padding; determinism tests |
| Paste never a gate | Stage 1 section 0A tests (photos-only path; banned string) |
| Voice capture conversational, short, skippable | Per-question **Skip**; minimum **200 words across the answers given** (skips allowed) and 2 answers ≥ 40 words; no separate personal-question requirement (Stage 1 spec section 8) |
| Paste allowed everywhere (Colton t44) | No paste blocks on any text input, voice answers included. A quiet paste ratio weights the voice baseline toward typed or spoken answers. When a baseline is more than 60% pasted, the voice comparison and checker report show one kind note at the very bottom (t46 soft wording, e.g. “Your writing sample was pasted in, which is totally fine. A typed or spoken sample helps us understand your voice better, so treat the voice comparison as a lighter read.”). A big paste while drafting gets at most one supportive suggestion per session: “We suggest using your own writing so your tone is better understood and we can serve you better.” It is never a question. **(t51, replaces the > 60% and t47 ≥ 95% paste-only rules)** Which note shows, if any, depends on how much natural (typed or spoken) voice was captured across the paper as well as the paste share: ≥ 600 natural words → no note; 200–599 → the lighter-read note only if > 60% pasted; 80–199 → a lighter-read note; < 80 → “Most of your voice came in pasted, or there wasn't much of it, which is totally fine. We couldn't reliably read your voice from it, so treat the voice comparison with lower confidence.” (numbers provisional; checker spec 5.9). No note without a baseline, and the student is never blocked or warned while writing (Stage 1 spec 0A.1 and 8.1a; checker spec 5.9) |
| No made-up quotes; names to verify (t47 additions) | Highlight reels about named people are **To verify**, carry no quotes, and are dropped when the coach isn't confident; the wildcard is **To verify** like every lead and counts toward the cap |
| Teach without ghostwriting (t47) | Teach cards are study material: a ≤ 35-word definition and bullet fragments (no sentences to paste), no citations, never exported or offered for copying; the student defines the concept in their own words with a real source |
| No pushing for trauma (t47); triggers are gentle invitations (Colton t52) | Memory triggers are a scripted, gentle bank with **Not this one** / **Skip these**; no topics like death, abuse or illness; the coach never digs into painful details; a supportive safety note shows if risk language appears. **t52 guideline:** a caring coach gently opening a door, never interrogating, mindful of hardship behind any memory. Every line offers the memory softly ("Maybe…"), invites reflection, and connects back to the assignment; a CI test rejects yes/no openers ("Did you…?") and lines without an invitation or a link to the paper (stage specs 2B.8) |
| No made-up quotes; names to verify | Lead sets of 3–5, capped at 20 AI-researched leads per paper; student-brought names are researched the same way and stay `to_verify`. Leads default to `to_verify`; excerpts must be verbatim substrings of verified source text; Stage 4 drops what it can't verify |
| Logic checkpoint coaches, never ghostwrites, never blocks (Colton's addition) | Structured result with questions only (no sentences to copy); reasons cite the assignment's verbatim words; code downgrades low-confidence flags and fails open to pass; no gate reads the checkpoint result; Continue anyway always works (stage specs 2A.4a) |
| Hidden-draft scaffold never leaks, never replaces the student's words (t57; rule locked t58) | The coach's private full-paper answer key is server-only, short-lived, and used only to reorder or flag the student's own ideas. A pre-send n-gram and similarity check against it runs on every student-facing string; it's never exported, never in an API response, never fed into other prompts, never logged; canary tests prove it (stage specs 2C.7–2C.8) |

### A.5 Owner decisions (Colton, Nov 20, 2026, t40)

1. **Voice capture:** 200 words total across the answers given; skipped answers are allowed. The 2 × 40-word rule is kept because it fits (two fuller answers from any questions). The personal question is still asked, but it is no longer separately required.
2. **Loop order is section-first.** One section at a time through PROBE → SEARCH → SUMMARIZE → CONFIRM. The student can skip a section and browse ahead read-only, but can only work on a later section once the earlier ones are finished or skipped. Skipped sections stay flagged, with a bottom reminder and a jump-back link, until they're done. The stage gates relax only inside Stages 2–4 for this (stage specs 2A.1).
3. **Research leads:** 3–5 at a time. If none appeal: 3–5 more, or “someone specific to look into?” The cap is about 20 AI-researched leads **per paper**; after that the student gets a ready-to-paste Google search prompt built from the section, rubric terms and story angle, and brings names back. Brought-back names go through the same 3–5 pattern and are still to verify (stage specs 2A.3).
4. **Final outline export:** Word (.docx) and PDF, built in code from the student's saved work: structure, idea notes, verbatim source excerpts and citation flags only, with no AI prose (stage specs 2A.7).
5. **Defaults kept, unconfirmed by Colton:** ~~the Counterargument section appears only when the assignment requires it or the paper is argumentative~~ (**confirmed and tightened by Colton in t47: only when the rubric asks for one**, A.7); light cleanup allows one-click fixes only for single-word and citation-format fixes (still unconfirmed).

### A.6 LOGIC CHECKPOINT (Colton's addition, Nov 20, 2026, t41; revised t42)

- **Where:** Stage 4, after each section's CONFIRM is saved and before ADVANCE. It runs for every section, and again only if the student changes that section's claim, ideas, leader or style.
- **Tiers:** `pass | moderate | strong`. Colton's t42 change removed the earlier “hard stop,” so nothing blocks. Strong pushback is firm and clear, and **Continue anyway** is always there. The student can finish the paper even if it's weaker for it.
- **What it judges:** logic and fit with the assignment's own terms, never whether the coach agrees with an opinion. A supportable unpopular view is pass, or moderate at most. A critical or cautionary analysis of a bad actor (e.g. Hitler's leadership as a warning) is a legitimate reframe and passes.
- **Default:** pass when unsure. Low-confidence flags are downgraded in code, and errors fail open to pass.
- **Never ghostwrites:** feedback is a short reason plus alternative angles phrased as questions. It never offers a sentence for the student to use.
- **SOP:** every result and the student's choice are logged. Continuing past a strong flag (`logic_strong_continued`) goes to the admin SOP review list to check whether the coach was right or overreached.
- Spec detail: `retainwrite-stage-specs.md` section 2A.4a and decision 33; build prompt Stage 4.

### A.7 Stage 2 brainstorm (Colton, Nov 20, 2026, t47) — the core coaching muscle

Colton's decisions, summarized; full spec in `retainwrite-stage-specs.md` section 2B (decisions 36–44) and Stage 1 spec 4.6.

1. **Teach-then-ask.** On a vague answer (“I like servant leadership”), affirm warmly, give a concise definition and breakdown (the educational piece), then ask which aspect interests the student most.
2. **Style vs. leader (concept vs. instance).** Styles and other concepts get the textbook treatment (definition, qualities, breakdown). Specific leaders and other instances get a highlight reel of one or two concrete moves that match the style, then “Want me to search for references on how {leader} was a {style}?”
3. **Research leads.** 3–5 options ranked by rubric match, plus exactly one wildcard labeled **Outside the box** with a one-line why. Rubric-aligned leads dominate; the wildcard trains pattern recognition without risking the grade. It counts toward the 20-per-paper cap, and the 32-word Google/Scholar search prompt still follows the cap. It's never offensive for its own sake; controversial picks get a neutral note like “although controversial.”
4. **Lesson-first hierarchy.** Every prompt is analyzed for THE LESSON (what it teaches, why the paper is assigned, what to learn), stored per paper, and coaching elaborates the lesson more than any example.
5. **Vague / personal-experience prompts (third routing path).** Mirror the prompt's emotional language (“What does magical mean to you?”); on a stall, offer gentle memory triggers (a little milestone like losing a tooth, getting hurt, a family member starting or losing a job, moving houses) with an easy skip, never pushing for trauma. **(t52)** Each trigger is a gentle invitation that connects back to the paper, e.g. “A family member started or lost a job. Do you want to expand on it so we can explore how it might help your paper?” (A.4). Memory-forward, not research-forward: research is optional, and the logic check is light. **Open research item (TODO, Paper Coach Research):** how common these prompts are and at which grade levels. No statistics assumed.
6. **Per-section logic checkpoint.** “I want to do a logic check. Do you feel good about this?” Three outcomes: no flag, light constructive feedback, or strong pushback with a red alert, “We would not recommend moving forward,” plus **Continue anyway**. No hard stops. Moderate for debatable takes, strong for indefensible ones (e.g. Hitler as objectively moral in a leadership paper). When unclear, let it through. Counterargument only when the rubric asks for one (confirmed).
7. **Section flow.** Dissect the assignment → summarize the sections → roadmap up front → per section: **teach** the concept → **probe** → 3–5 leads + wildcard → source cards (claim, quotable excerpt, why it fits the rubric) → confirm and save → logic checkpoint → next section. Saved decisions feed the outline and draft, so the student never re-explains. On the loop: DISSECT → **TEACH** → PROBE → SEARCH → SUMMARIZE → CONFIRM → LOGIC CHECKPOINT → ADVANCE.
8. **Voice capture.** 200 words total across the answers given (Colton wrote “across skipped answers”; read as across all answers with skips allowed, per t40). A quiet safeguard down-weights mostly-pasted answers and favors typed or spoken ones. No warnings during the flow. At the end of results: ~~more than 60% pasted → the lighter-read note; all pasted → the lower-confidence note~~ **(t51) the hybrid rule:** enough natural voice → no note at any paste %; very little natural voice → a note even at moderate paste % (A.4).

### A.8 Gentle voice nudge in revision (Colton, Nov 20, 2026, t48)

The Stage 6 (and Stage 5) voice-mismatch warning is no longer a check-in. It reads: **“This part sounds a little different from your usual voice. Want to read it aloud and make it sound more like you?”** The specific tells are still named under **What we noticed** (the hard limit on naming tells holds). Buttons: **Make it sound like me** (voice tips, read-aloud and highlights, never rewrites) and **Keep it as is** (dismissed, logged neutrally, no note, no penalty). The old “I've reworked it” / “This is my writing” buttons are retired. Stage specs decision 45, section 7.

### A.9 Interaction design layer — applies to the whole pipeline (Colton, Nov 20, 2026, t57; updated t58)

**Principle:** the student works on one thing at a time, and regularly gets to see the whole paper growing out of their own words. Every stage from intake to Drafting follows the same rhythm: one question or frame on screen, focused on a single section or beat; a quiet "progress ghost" of the paper in the background; and after each finished section, a zoom-out to the full outline (intro, body, conclusion) built only from what the student said, where they can jump to any section to edit or move on ("Ready for section four?" / "Do you want to review?"). Stage 1 collects its pieces without zoom-outs; from Stage 2 on, every finished section gets one. In **Drafting** (Colton's Stage 3; that's the student-facing name), every section is taught then drafted ("Where are you at on this? Want to give it a shot, or want me to break it down?"), sentences are written one at a time and move up the screen, drafting goes strictly in order, transitions get example words rather than templates, and the end of Drafting lands as a moment of pride: the student sees the full paper they wrote. (The internal design intent is Colton's "holy crap, I just wrote a long paper"; student copy stays clean: "Look at everything you wrote.") Over a few papers the scaffolding fades so the student can run this workflow alone.

**The hidden draft is the coach's private answer key, not the student's paper.** The coach generates its own full paper on the server from the captured ideas (t58) to check structure, pacing, where each idea lands and whether any sentence carries too much weight. It is never shown, quoted, paraphrased, exported or sent to the student's browser; it is deleted on a short schedule; and it can only reorder or flag the student's own ideas ("This idea might land better in section 2"). It never supplies words and never overrides the student's voice. The hard limits in section 3 apply unchanged: the student owns every sentence. Spec: `retainwrite-stage-specs.md` section 2C (decisions 61–72, 82) and `retainwrite-stage3-draft-spec.md` (Drafting; decisions 73–81, section 11A).

### Changelog

- **v1.7 — Nov 20, 2026 (t69)** — Added a short pointer near the top to `retainwrite-project-rules.md` (project operating rules for all bots, including the owner's no-idle standing rule). Colton's text in sections 1–4 is unchanged.
- **v1.6 (t58 update) — Nov 20, 2026** — Appendix only: A.9 updated with Colton's t58 decisions (the stage is called **Drafting**; teach-then-draft for every section; one sentence at a time; strict order; example language, not templates; section-only zoom-outs; the big payoff at the end of Drafting with "Look at everything you wrote."; the hidden draft as a server-side full-paper answer key; scaffolding that fades over papers). The pipeline-wide principle is unchanged. Colton's text in sections 1–4 is unchanged.
- **v1.6 — Nov 20, 2026 (t57)** — Appendix only, PROVISIONAL: new A.9 (the interaction design layer applies to the whole pipeline: one beat at a time, progress ghost, milestone zoom-outs with jump-to-edit, the end-of-outline payoff, and the hidden-draft scaffold as a private, never-shown sketch that only reorders or flags the student's own ideas) and a matching A.4 enforcement row. Colton's text in sections 1–4 is unchanged.
- **v1.5 — Nov 20, 2026 (t51, t52)** — Appendix only: the A.4 paste row and A.7 item 8 now state the hybrid voice-note rule (natural voice words + paste share); the A.4 trauma row and A.7 item 5 add Colton's gentle-invitation guideline for memory triggers. Colton's text in sections 1–4 is unchanged.
- **v1.4 — Nov 20, 2026 (t47, t48)** — Appendix only: TEACH added to A.1/A.2, THE LESSON note, new definitions (A.3), three new enforcement rows and the all-pasted voice note (A.4), the counterargument default marked confirmed (A.5), new A.7 (Colton's Stage 2 brainstorm) and A.8 (the gentle voice nudge). Colton's text in sections 1–4 is unchanged.
- **v1.3 (t46 note) — Nov 20, 2026** — A.4 paste row: the softer voice-note wording and the Stage 5 supportive suggestion replace t45's wording and the old paste question. Colton's text is unchanged.
- **v1.3 — Nov 20, 2026 (t43–t45)** — Appendix A.4: paste is allowed in every text input (Colton t44 removed the voice-answer exception), with paste-ratio baseline weighting and (t45) the bottom-of-report “Voice was not reliably determined” note. Colton's own text is unchanged (“Paste is optional backup, never the gate” still holds).
- **v1.2 — Nov 20, 2026 (t41/t42)** — Added Colton's LOGIC CHECKPOINT as loop step 5a (marked as his addition) and appendix A.1, A.2, A.4 and A.6. Per t42 the tiers are pass / moderate / strong, and strong never blocks (t41's hard stop was removed).
- **v1.1 — Nov 20, 2026 (t40)** — Appendix updated with Colton's answers (A.5): 200-word voice minimum, section-first loop with skip/browse-ahead, 3–5 leads with a 20-per-paper cap and Google search-prompt handoff, .docx/PDF outline export. Two defaults are marked unconfirmed. Colton's own text (sections 1–4) is unchanged.
- **v1.0 — Nov 20, 2026** — First version from Colton's core-philosophy text, plus this implementation appendix.
