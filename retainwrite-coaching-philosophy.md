# RetainWrite — Coaching Philosophy (governing document)

**Version:** v1.3 · Nov 20, 2026 (adds Colton's LOGIC CHECKPOINT, t41/t42, and paste-everywhere, t44/t45; his earlier text is unchanged) · Author: Colton Simmons (owner)

**Status:** This is THE governing document for every stage, probe, summary, and interaction in RetainWrite. Where any spec or prompt conflicts with it **on philosophy**, this doc wins. The specs (`retainwrite-stage1-intake-spec.md`, `retainwrite-stage-specs.md`, `retainwrite-ai-checker-spec.md`) still hold the implementation details. Sections 1–4 are Colton's text, kept in his wording and only lightly organized. The appendix is ours.

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
| **PROBE** | **Stage 2**, per section, after the whole-paper stance work (3 moves + refined thesis) | For each section, the exact yes/no choice. "I have an idea" → the student types their idea notes. "Ask me" → 2–4 probing questions. Freeze or nothing → warm-up questions first. Never sources cold. Answers are saved verbatim as that section's ideas. |
| **SEARCH** | **Stage 3**, per section, while the outline card is built | Search terms plus **3–5** leads at a time (people, examples, sources; “none appeal” → 3–5 more or “someone specific?”; after 20 AI-researched leads per paper, a ready-to-paste Google search prompt and the student brings names back) cross-referenced against the rubric's required styles/themes, each marked **to verify**. The student picks leaders and a style; the outline card and sentence plan are prefilled from that section's saved ideas, in the student's words. |
| **SUMMARIZE** | **Stage 4**, per section | Source cards from **verified** sources only: the claim it supports, a short verbatim excerpt (≤ 2 sentences), one line on why it fits the rubric. Audio optional (pricing unchanged). Leads that can't be verified are dropped, with a note to the student. |
| **CONFIRM** | **Stage 4**, end of each section | "Are you comfortable moving forward with [leader] and [style]?" Yes → the section decision is saved and locked into the skeleton. Not yet → back to SEARCH for that section. |
| **LOGIC CHECKPOINT** *(Colton's addition)* | **Stage 4**, right after each section's CONFIRM is saved, before ADVANCE; mandatory, **never blocking** | **Pass** shows a quiet ✓ and moves on. **Moderate**: light feedback, angle questions, “Your call. You're the writer,” and **Keep my angle** / **Adjust it**. **Strong**: a firm flag that the claim doesn't hold up, the assignment's own words, angle questions, and **Pick a new angle** / **Revise my claim** / **Reframe it** / **Continue anyway**. When unsure, it passes. Continuing past a strong flag is logged for SOP review. |
| **ADVANCE** | Within Stages 2–4, **section-first** | The next section opens only when this one is confirmed or skipped. Later sections and the rest of the workflow can be **browsed read-only**. A skipped section is flagged, with a persistent reminder bar at the bottom and a link that jumps straight back to it. Drafting (Stage 5) waits until every section is confirmed. |
| **Draft feedback** | **Stage 5**, per section | The captured ideas as short notes (never finished sentences), the chosen leader and style, the source excerpts, and transition suggestions (relationship + connective words only). The student writes every sentence. |
| **Light cleanup** | **Stage 6** (also on Stage 5 section submit) | Flags only: spelling, grammar, and citation format. The student accepts a mechanical fix or fixes it themselves. Never a rephrase. |

The **story angle** (INTD600 Phase 2, "Pick your story") stays early in Stage 1. The roadmap and every per-section loop sit under it: each section's PROBE and CONFIRM show the chosen story so the sections stay on one spine.

### A.2 The loop and the INTD600 phases

| INTD600 phase | Loop step(s) | Stage |
|---|---|---|
| 1. Capture the real assignment first | (input to DISSECT) | Stage 1 |
| 2. Generate story options and pick early | (spine above the loop) | End of Stage 1 |
| — | DISSECT | End of Stage 1 |
| 3. Structured interview for raw material | PROBE | Stage 2 |
| 4. Sentence-level outline with flagged citations and short excerpts | SEARCH (Stage 3) + SUMMARIZE + CONFIRM + LOGIC CHECKPOINT (Stage 4) | Stages 3–4 |
| 5. Student writes every sentence | Draft feedback | Stage 5 |
| 6. Citation integrity with a/b/c suffixes | (hard limit: citations tied to claims) | Stage 6 |
| 7. Final assembly and light quality check | Light cleanup | Stage 6 |

### A.3 Definitions used across the specs

- **Leader** — a person, organization, case, or example the student chose for a section (from SEARCH). Generic name for "leaders/examples/sources."
- **Style** — the rubric's required style, theme, framework, or lens that the section uses (e.g. a named leadership style or theory). If the rubric names none, CONFIRM uses the section's angle instead.
- **Section decision** — the saved result of a section's loop: idea notes (student's words), chosen leaders, chosen style, verified sources/excerpts, and the confirmation. It's the skeleton for the outline and the draft.
- **Light cleanup** — flags for spelling, grammar, and citation format that the student accepts or fixes. One-click accept is allowed only for a single-word spelling fix, a single-word grammatical form (e.g. "was" → "were"), or a citation-format fix (punctuation, order, capitalization, a/b/c suffix). Never synonyms, reordering, sentence merges or splits, or any rephrase.
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
| Paste allowed everywhere (Colton t44) | No paste blocks on any text input, voice answers included. A quiet paste ratio weights the voice baseline toward typed or spoken answers. When a baseline is more than 60% pasted, the voice comparison and checker report show one kind note at the very bottom (t46 soft wording, e.g. “Your writing sample was pasted in, which is totally fine. A typed or spoken sample helps us understand your voice better, so treat the voice comparison as a lighter read.”). A big paste while drafting gets at most one supportive suggestion per session: “We suggest using your own writing so your tone is better understood and we can serve you better.” It is never a question. No note without a baseline, and the student is never blocked or warned while writing (Stage 1 spec 0A.1 and 8.1a; checker spec 5.9) |
| No made-up quotes; names to verify | Lead sets of 3–5, capped at 20 AI-researched leads per paper; student-brought names are researched the same way and stay `to_verify`. Leads default to `to_verify`; excerpts must be verbatim substrings of verified source text; Stage 4 drops what it can't verify |
| Logic checkpoint coaches, never ghostwrites, never blocks (Colton's addition) | Structured result with questions only (no sentences to copy); reasons cite the assignment's verbatim words; code downgrades low-confidence flags and fails open to pass; no gate reads the checkpoint result; Continue anyway always works (stage specs 2A.4a) |

### A.5 Owner decisions (Colton, Nov 20, 2026, t40)

1. **Voice capture:** 200 words total across the answers given; skipped answers are allowed. The 2 × 40-word rule is kept because it fits (two fuller answers from any questions). The personal question is still asked, but it is no longer separately required.
2. **Loop order is section-first.** One section at a time through PROBE → SEARCH → SUMMARIZE → CONFIRM. The student can skip a section and browse ahead read-only, but can only work on a later section once the earlier ones are finished or skipped. Skipped sections stay flagged, with a bottom reminder and a jump-back link, until they're done. The stage gates relax only inside Stages 2–4 for this (stage specs 2A.1).
3. **Research leads:** 3–5 at a time. If none appeal: 3–5 more, or “someone specific to look into?” The cap is about 20 AI-researched leads **per paper**; after that the student gets a ready-to-paste Google search prompt built from the section, rubric terms and story angle, and brings names back. Brought-back names go through the same 3–5 pattern and are still to verify (stage specs 2A.3).
4. **Final outline export:** Word (.docx) and PDF, built in code from the student's saved work: structure, idea notes, verbatim source excerpts and citation flags only, with no AI prose (stage specs 2A.7).
5. **Defaults kept, unconfirmed by Colton:** the Counterargument section appears only when the assignment requires it or the paper is argumentative; light cleanup allows one-click fixes only for single-word and citation-format fixes.

### A.6 LOGIC CHECKPOINT (Colton's addition, Nov 20, 2026, t41; revised t42)

- **Where:** Stage 4, after each section's CONFIRM is saved and before ADVANCE. It runs for every section, and again only if the student changes that section's claim, ideas, leader or style.
- **Tiers:** `pass | moderate | strong`. Colton's t42 change removed the earlier “hard stop,” so nothing blocks. Strong pushback is firm and clear, and **Continue anyway** is always there. The student can finish the paper even if it's weaker for it.
- **What it judges:** logic and fit with the assignment's own terms, never whether the coach agrees with an opinion. A supportable unpopular view is pass, or moderate at most. A critical or cautionary analysis of a bad actor (e.g. Hitler's leadership as a warning) is a legitimate reframe and passes.
- **Default:** pass when unsure. Low-confidence flags are downgraded in code, and errors fail open to pass.
- **Never ghostwrites:** feedback is a short reason plus alternative angles phrased as questions. It never offers a sentence for the student to use.
- **SOP:** every result and the student's choice are logged. Continuing past a strong flag (`logic_strong_continued`) goes to the admin SOP review list to check whether the coach was right or overreached.
- Spec detail: `retainwrite-stage-specs.md` section 2A.4a and decision 33; build prompt Stage 4.

### Changelog

- **v1.3 (t46 note) — Nov 20, 2026** — A.4 paste row: the softer voice-note wording and the Stage 5 supportive suggestion replace t45's wording and the old paste question. Colton's text is unchanged.
- **v1.3 — Nov 20, 2026 (t43–t45)** — Appendix A.4: paste is allowed in every text input (Colton t44 removed the voice-answer exception), with paste-ratio baseline weighting and (t45) the bottom-of-report “Voice was not reliably determined” note. Colton's own text is unchanged (“Paste is optional backup, never the gate” still holds).
- **v1.2 — Nov 20, 2026 (t41/t42)** — Added Colton's LOGIC CHECKPOINT as loop step 5a (marked as his addition) and appendix A.1, A.2, A.4 and A.6. Per t42 the tiers are pass / moderate / strong, and strong never blocks (t41's hard stop was removed).
- **v1.1 — Nov 20, 2026 (t40)** — Appendix updated with Colton's answers (A.5): 200-word voice minimum, section-first loop with skip/browse-ahead, 3–5 leads with a 20-per-paper cap and Google search-prompt handoff, .docx/PDF outline export. Two defaults are marked unconfirmed. Colton's own text (sections 1–4) is unchanged.
- **v1.0 — Nov 20, 2026** — First version from Colton's core-philosophy text, plus this implementation appendix.
