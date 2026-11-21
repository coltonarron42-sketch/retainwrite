# RetainWrite — Drafting Spec (Colton's Stage 3; file id `stage3-draft`) — v2, Colton's t58 decisions folded in

Companion to `retainwrite-cursor-build-prompt.md` (build items **S3-t56** and **S3-t57**) and `retainwrite-stage-specs.md`. **Status (Nov 20, 2026, t67): ✅ BUILD-READY.** Colton (t67) ordered Drafting built now; the DO NOT BUILD YET flag is removed from this spec and from build items **S3-t56** and **S3-t57**. Colton's t58 decisions stay marked **DECIDED (Colton t58)**; implementation details we filled in stay **[PROVISIONAL]**; the remaining open questions in section 15 now each carry a **build default** (section 15, "Build defaults applied (t67)") so none of them blocks building. Section **0A** is the build-ready checklist of the eight required behaviors. Build behind the code constants `FEATURES.draftingMuscle`, `FEATURES.interactionLayer` and `FEATURES.hiddenDraft` (`lib/config.ts`; not env vars) so each piece can be switched off, and **turn them to `true` for production** once the section 14 acceptance tests pass, because QA must verify Stages 1–3 (Colton's numbering) end to end on the live site with a fresh demo account. The classic draft flow in stage specs 5.1–5.3 remains only as the flag-off fallback.

**Governing document:** `retainwrite-coaching-philosophy.md` (v1.6, Nov 20, 2026; A.9 adds the pipeline-wide interaction design layer, t57) governs everything here, especially section 3 (hard limits) and section 4 (draft feedback: "Here are the three ideas we captured… Write those ideas in your own words… The outline is the map; the student's voice is the road."). It wins over this doc on philosophy. This doc wins on drafting-stage implementation. Stage specs win on everything else (Stages 2–4 loop, section 7 mismatch, paste policy 5.2).

**Naming (DECIDED, Colton t58): the student-facing name is exactly "Drafting."** Use "Drafting" in every student-facing place (stage rail, headers, buttons, emails, help text). Never "Stage 3," "Draft stage" or "Draft" as the stage name in UI copy.

| Thing | Value |
|---|---|
| Student-facing label | **Drafting** (exact) |
| Colton's numbering | Stage 3 |
| Code stage number / route | Stage 5 · `/app/papers/[paperId]/stage/5` (unchanged) |
| Internal ids that keep old names (note only; not student-facing) | file `retainwrite-stage3-draft-spec.md`, build items `S3-t56` / `S3-t57`, `stage_progress.stage = 5`, `FEATURES.draftingMuscle`, tables `draft_ledgers` / `draft_paragraphs`, events `draft_*`, `drafts` table, `lib/drafting/*` |

Colton's count groups the code's Stages 2–4 (stance interview, outline, sources) as his research stage, which makes Drafting his Stage 3. He also refers to a "Stage 4" that starts after Drafting and to "Stage 5 (revision)". In the code, the stage after Drafting is **Revise & feedback** (route 6). This doc reads both as that revision stage; the numbering gap is flagged in section 15 (Q20).

LOCKED RULES (restated, because drafting is where they're most at risk): **coaching only. The app NEVER writes submission text** — no paragraphs, no thesis, no intro sentence, no topic sentence, no rewrites, no "you could say…". **The student writes first, every time; the coach teaches structure around what the student wrote.** Nothing is framed around AI detectors. Voice feedback uses only the gentle t48 voice nudge (stage specs section 7). Paste is allowed in every editor, with the t46 once-per-session supportive note (stage specs 5.2) and the t51 hybrid voice-note rules (stage specs 2B.10; drafting text never counts toward `naturalWords`). Add `// SOP: coaching only, never generate submission text` at every AI call site. The one exception is the hidden-draft scaffold (stage specs 2C.7): it's a server-side, never-shown answer key, guarded by H1–H8 and D9; its call site carries its own SOP comment.

---

## 0A. BUILD-READY (t67): the eight required behaviors

Colton (t67) listed these as the core of Drafting. Each must work end to end on the live site. Where the detail below is our fill-in rather than Colton's words, it's marked **[PROVISIONAL]**. Hard rules on every one: **coaching only; the app never writes submission text for the student** (no sentences, thesis, topic sentence, rewrite or "you could say…"); **no detector-evasion framing** anywhere in code, copy or prompts.

1. **Hidden-draft scaffold** (stage specs 2C.7–2C.8; section 11A; guard D9). The coach generates, server-side only, a full-paper "answer key" from the locked ledger (`HIDDEN_DRAFT_MODE = 'prose'`). It is **never shown, never sent to the client, never exported, never logged**, and never compared to the student's draft to grade it. Its only use is shaping the read-back: the order in which the student's **own** ideas are read back, plus at most 2 scripted flags ("This idea might land better in {section}.", "Your sentence {n} plan carries a lot; want to split that idea?"). Stored in `private.hidden_drafts` (one row per paper, latest only, service role only). H1–H8 and D9 (leak guard with canary) apply. Regenerated only at milestones with a changed ledger hash, cap 15 per paper. Failure never blocks: no signals → plain ledger-order read-back. Disclosure and retention use the Q16/Q17 build defaults (section 15).
2. **Teach-then-draft for EVERY section, including the conclusion** (decision 74; sections 5.1, 8.1, 8.3, 8.4). Intro, each body section, any counter section and the **conclusion** each open with the opener **"Where are you at on this? Want to give it a shot, or want me to break it down?"** **Break it down for me** → full shape card (teach) → read-back → the student drafts. **I'll give it a shot** → **[PROVISIONAL, t67]** a one-line shape summary always shows above the read-back (e.g. conclusion: "What you covered → what you figured out → how it finishes"), with the full card one tap away (**Show me the shape**) → read-back → the student drafts. So teaching always comes before the first sentence in every section. Conclusion teach = "A conclusion can look back" card + reflective prompts one at a time (8.3).
3. **Zoom-in / zoom-out screen states** (stage specs 2C.1, 2C.3, 2C.12; section 11A). Drafting has exactly these screen states **[PROVISIONAL names]**:
   - `zoomed_in` (default): one beat fills the screen — the opener, the shape card, the read-back, or the single sentence input with the current paragraph's own sentences growing above it. The rest of the paper is out of focus (only the faint ghost, behavior 7).
   - `milestone` (zoom-out, automatic): after a **section** is saved — never after each sentence or paragraph (`SKELETON_PEEKS = false`). The milestone pop-up (behavior 8) opens over the frame with the whole-paper skeleton behind it.
   - `review_all` (zoom-out, full): the skeleton comes forward and becomes readable; drafted sections are clickable.
   - `jump_edit`: an earlier, drafted section open in edit (tightening view) with a persistent **Back to where you were** control.
   - `payoff`: once, after the conclusion's last paragraph is saved (section 11A).
   Transitions: `zoomed_in → milestone` (section saved) · `milestone → zoomed_in` (**Ready for section {n}?** → next section's opener) · `milestone → review_all` (**Do you want to review?**) · `review_all → jump_edit` (click a drafted section) · `jump_edit → zoomed_in` (save or Back; returns to the exact beat, scroll and focus) · `review_all → zoomed_in` (**Ready for section {n}?**) · `zoomed_in → payoff` (conclusion saved) · `payoff → jump_edit | revision`. Tapping the ghost from `zoomed_in` opens `review_all` on demand. The current state and beat address `{5, sectionKey, step, paragraphKey|sentenceN}` persist in `stage_progress.data` so a reload resumes the same state. Motion: a short zoom/scale transition, none under `prefers-reduced-motion`.
4. **Example language, not templates** (decision 80; section 9; guard D6). At transitions the coach shows connector chips (≤ 4 words each, from `lib/coaching/connectors.ts`, display only, insert nothing). **Never** fill-in-the-blank starters, frames, slots, `[ ]`, `___` or "We started with…" patterns; never topic words. Do not create `arcFrames.ts`.
5. **Rough intro first, revisit later** (decision 81; sections 5.5–5.6). The intro is drafted first and is allowed to be rough ("That's a real intro. Now we can make it flow."). There is **no intro revisit inside Drafting**; the revision stage (code Stage 6) opens its checklist with the intro revisit, questions only.
6. **Strict in-order section sequencing** (decision 78; sections 8.2, 11A). Sections open in roadmap order (intro → body sections → counter if required → conclusion); paragraphs and sentences in order within each. No skip control and no opening a later section early, enforced on the **server** too (a write to a later section/paragraph is rejected), not just hidden in the UI. Editing an earlier, drafted section is allowed only via jump-and-return.
7. **Background ghost skeleton** (section 11A; stage specs 2C.2). The framework floats behind the current beat as a faded skeleton, one block per paragraph, filling as the student drafts. Decorative and unreadable at rest (screen readers get "Paragraph {n} of {m} in progress"); never covers the beat, never pulses. Built in code by `buildSkeleton(paperId)` from saved rows only (labels, the student's captured-idea notes, the student's drafted sentences) — never hidden-draft or coach text. Mobile: a thin segmented strip under the header.
8. **Milestone pop-ups with clickable sections** (decision 77; section 11A). After each section is saved: "{Section label} is done." with **Ready for section {four}?** (primary; "Ready for your conclusion?" when the conclusion is next) and **Do you want to review?** → **Review all**. In Review all, drafted sections show the student's own sentences and are **clickable** to jump in and edit (then return); not-yet-drafted sections show the roadmap title and the student's idea notes (≤ 12 words) and are not clickable. Not dismissed by clicking outside (Q19 default); the student must pick one of the two buttons. Esc in Review all returns to the pop-up. `role="dialog"`, focus to heading, one polite announcement.

**Feature-flag plan (t67).** `FEATURES.draftingMuscle` (behaviors 2, 4, 5, 6 and the loop), `FEATURES.interactionLayer` (3, 7, 8 and the payoff), `FEATURES.hiddenDraft` (1). Build each behind its flag, then set all three to `true` in a final commit once acceptance tests pass. Papers that already started Drafting in classic mode stay classic (`stage_progress.data.draftingMode`).

---

## 0. Decisions in this doc (numbered after stage-specs decision 47; moved here from stage specs section 0 in t56; statuses updated t58)

Status key: **DECIDED (Colton t58)** = Colton's call, not open; **LOCKED** = locked by Colton; **[PROVISIONAL]** = our fill-in, open to tuning; ~~struck~~ = superseded (kept for history).

48. **[DECIDED, t58] Drafting muscle.** Colton's Stage 3, student-facing name **Drafting** (decision 73), is the code's draft stage (Stage 5 route). It layers on stage specs 5.1–5.3 behind `FEATURES.draftingMuscle = false`. Section 1.
49. **[DECIDED, t58] Locked ledger handoff.** Entering Drafting snapshots a read-only `draft_ledgers` version from saved data only: lesson, story angle, thesis, and per-section big ideas in the student's words (leader, style, key points, teach aspect, memory card, verified excerpts), plus the skeleton (topic sentence = the outline `claim`; second sentence = the second sentence-plan row). It changes only through the existing outline/section reopen routes, which create a new version and softly flag the affected paragraphs. The student never re-explains. Section 3.
50. **[DECIDED, t58; default PROVISIONAL, Q4] One paragraph per major point.** Each body section's claim is one major point and one paragraph by default; the student can promote other ideas to their own paragraph (max 3 per section); the section minimum splits across paragraphs (floor 50 words). Section 4.
51. **[DECIDED, t58] Per-paragraph loop: OPENER → TEACH (if asked) → RE-READ → STUDENT DRAFTS (sentence by sentence) → CHECK → STRUCTURE FEEDBACK → TIGHTEN/REORDER → STUDENT REVISES → SAVE.** (t58: opener added, decision 74.) The student always writes first; no feedback, tighten list or arc frame appears before they've written the paragraph minimum. The 5.3 hard rules apply per paragraph. Section 8.
52. **[DECIDED, t58] Intro first, teach-then-draft.** The intro is built first: the opener, a brief intro-format lesson (scripted, structure only), the captured ideas read back, then the student drafts their own first summary of the assignment (or thesis) as the intro's starting point. Every opening summarizes the assignment (Colton's rule). A rough intro is fine. ~~A one-time "revisit your intro" prompt follows the last body paragraph.~~ (t58: the revisit moves to the revision stage, decision 81.) Section 5.
53. **[DECIDED, t58] Rubric intro requirements explained.** Every rubric criterion the intro (or a paragraph) must meet shows the teacher's words verbatim, a ≤ 30-word plain-words explanation of the job, and a self-check question. Section 7.
54. **[DECIDED, t58] Tighten and reorder are questions and checklists.** They point at sentence numbers and the student's exact words; the student makes every change (sentence drag in a Reorder view; no one-click apply). Section 9.
55. ~~Generic arc language is scripted and topic-free (bracket-slot arc frames).~~ **Superseded t58 by decision 80: example language (connector words and phrases), never fill-in-the-blank frames.**
56. **[DECIDED, t58] Drafting guard (`lib/ai/draftGuard.ts`).** Rejects any Drafting coach output that could be pasted into the paper (rules D1–D9; D9 = hidden-draft leak check). Retry once, then scripted fallback. Nightly eval bar: 0 leaks. Section 10.
57. **[PROVISIONAL] Stalls reuse existing muscles.** Lesson sections reuse TEACH / teach-then-ask; memory sections reuse MIRROR and the t52 gentle triggers; plus **Say it out loud**; after 2 nudges, flag for help. "Write it for me" gets a fixed, kind decline. Never a sentence written for the student. Section 11.
58. **[LOCKED rules, t58] Paste and voice in Drafting are unchanged.** Paste is allowed in every paragraph editor; the 5.2 supportive note shows at most once per session per paper (shared key); per-paragraph paste metadata rolls into `drafts.section_paste_meta`; drafting text never changes `naturalWords`; the t48 voice nudge is the only voice feedback. Section 11.
59. **[PROVISIONAL] Data and events.** Spec-only migration `0010_drafting_muscle.sql` (`draft_ledgers`, `draft_paragraphs`, plus `papers.paper_genre`; 0009 stays reserved for the section-loop fallback). Section text is derived from paragraphs, so 5.3, `drafts` v1 and section 7 are unchanged. New `draft_*` / `paragraph_*` / `intro_*` events (counts and ids only). Sections 12–13.
60. **[DECIDED loop, t58; variants PROVISIONAL] (t56) The intro teach-then-draft loop applies to every paper type; only the intro's landing line changes.** (t58: Colton confirmed teach-then-draft for every section; the per-type variants below stay provisional as routing additions.) Same loop shape everywhere (teach formats → read back → student drafts → rough is fine → tighten with arc language). Four intro variants [PROVISIONAL], chosen from the paper type: **thesis intro** (argumentative, expository, research, literary/rhetorical analysis, critique, compare-contrast, cause-effect) lands on a thesis; **story intro** (narrative, personal-experience, admissions) opens with a hook or scene and lands on a "so what" line about what the story will show, not a thesis; **reflective intro** opens with context and lands on the insight; **case intro** opens with the situation and lands on the question the analysis answers. The student can switch variants; their pick wins. Section 6.

**t58 decisions (Colton, Nov 20, 2026):**

73. **[DECIDED, t58] Name: "Drafting."** The student-facing label is exactly **Drafting** everywhere (UI, specs, build prompt, emails). Internal ids keep their names (route 5, `stage3-draft` file, `S3-*` build items, `draft_*` tables/events, `FEATURES.draftingMuscle`); the mapping table sits at the top of this doc.
74. **[DECIDED, t58] Teach-then-draft for every section.** Intro, every body section, any counter section and the conclusion all open with **"Where are you at on this? Want to give it a shot, or want me to break it down?"** (**I'll give it a shot** / **Break it down for me**). Break it down → teach the shape → read the captured ideas back → the student drafts. Give it a shot → read-back → the student drafts (the shape card stays one tap away). Either way the student writes first and the coach teaches structure around what they wrote. Section 8.
75. **[DECIDED, t58] Conclusion: more than a recap.** The conclusion's shape lesson teaches that a conclusion can be an introspective look at what the paper covered, what conclusions were drawn, and how the paper finished, not just a summary. The coach surfaces this with reflective questions and a soft checklist. Section 8.3.
76. **[DECIDED, t58; layout PROVISIONAL] One frame per beat; drafted sentences move up.** In Drafting the student writes one sentence at a time in a single input; each finished sentence moves up the screen into the growing paragraph above it. Section 8.2.
77. **[DECIDED, t58] Milestone pop-up after each section only.** After each section is done, a pop-up shows the whole paper skeleton as a faded background ghost, readable only after the student taps **Review all**; sections there are clickable to jump in and edit. Then: **"Ready for section {four}?"** / **"Do you want to review?"** Per-sentence/per-paragraph peeks are **off by default** (`SKELETON_PEEKS = false`). Section 11A; stage specs 2C.3.
78. **[DECIDED, t58] Strict in-order drafting.** Paragraphs and sentences are drafted in order inside each section, and sections in order; no hopping ahead and no skipping in Drafting. A jump from the milestone pop-up edits an earlier section and then returns the student to the current beat. Section 11A.
79. **[DECIDED, t58] Payoff at the end of Drafting.** The big moment moves to the end of Drafting, before the next stage: the full outline (intro, body, support, conclusion) built from the student's own drafted sentences, "Look at everything you wrote." The internal design intent ("holy crap, I just wrote a long paper") never appears in student copy. The outline stage keeps only a lighter "Your outline is complete." line on its last milestone pop-up (no stats, no reveal). Section 11A; stage specs 2C.4.
80. **[DECIDED, t58] Example language, not templates.** At transitions the coach offers connector words and short phrases ("at this time," "in the beginning," "where…") as prompts for organizing the thought, never fill-in-the-blank sentence starters or frames. Replaces decision 55. Support fades over papers so that after a few papers the student can run the workflow alone [fade thresholds PROVISIONAL]. Section 9.
81. **[PROVISIONAL, pending research validation, t58] Rough intro first, revisit in revision.** Drafting produces a rough intro first for direction; the real tightening pass happens in the revision stage once the whole paper is visible. Common writing guidance describes this pattern (a working introduction early, revised once the body exists); our research team still has to validate it, and no citation is claimed here. Section 5.6; stage specs 6.1.

61–72, 82. **Interaction design layer, hidden-draft scaffold (t57) and the locked prior-batch statuses (t58):** decisions 61–72 and 82 live in `retainwrite-stage-specs.md` section 0 (they span Stages 1–5; spec in stage specs section 2C). How they apply in Drafting is section 11A below. Not duplicated here.

---

## 1. Scope and where it sits

- **Inputs:** every roadmap section confirmed in the research loop (code Stage 4 complete; gate unchanged), the approved outline (code Stage 3), verified source cards and excerpts (code Stage 4), THE LESSON and prompt type (Stage 1 / stage specs 2B.1–2B.2).
- **Output:** the student's own draft. Section text = its paragraphs joined by blank lines (no generated connective text). On completion, `drafts` version 1 is assembled exactly as in stage specs 5.3, then the end-of-Drafting payoff shows (section 11A) and the revision stage (code Stage 6) opens.
- **What it changes vs. stage specs 5.1–5.3:**

| Classic draft stage (5.1–5.3) | Drafting muscle (this doc) |
|---|---|
| One textarea per outline section | One editor per **paragraph**; each major point gets its own paragraph (section 4) |
| Draft feedback read-back per section | Same read-back, built from a **locked ledger** and repeated on every paragraph (sections 3, 8) |
| Intro is just the first section | **Intro first**: intro-format lesson, ideas read back, student drafts the first summary, rubric intro requirements explained; per-type intro variants (sections 5–7) |
| Feedback on section submit | Feedback per paragraph, then **tightening** (flow, reorder) with connector example language, never frames (sections 8–9) |
| Free textarea | **One sentence at a time**; finished sentences move up into the paragraph (section 8.2) |
| Every section starts the same | Every section opens with **"Where are you at on this?"** and teach-then-draft (section 8.1) |
| Shared guard | Adds the drafting guard (section 10) |

Kept unchanged: 5.1 coaching timing (no keystroke coaching; Ask the coach max 3 per section, questions only), 5.2 paste policy, 5.3 topic-sentence-first and minimum-length hard rules, section 7 voice nudge, Stage 5 completion (every section done, draft ≥ 300 words).

---

## 2. Colton's flow, step by step (t56, updated t58)

| # | Colton said | What the app does | Section |
|---|---|---|---|
| 1 | The coach has collected and stored all section decisions: the locked ledger of big ideas (e.g. leader, leadership style, five key points). | Snapshot `draft_ledgers` from saved decisions; read-only. | 3 |
| 2 | The coach knows the paper will talk about this leader, this style and these ideas. It builds a framework. | Paragraph plan built in code from the ledger: intro, one paragraph per key point, counter (only if the rubric asks), conclusion. | 4 |
| 3 | It starts with the introduction. | The intro is always the first paragraph to open. | 5 |
| 4 | Teach intro formats briefly (several ways it can be structured). | Scripted intro-format card for the paper's intro variant, 1–2 lines each, then "Which one feels most like how you'd start?" | 5.1, 6 |
| 5 | Re-read the student's captured ideas back to them. | Read-back of story angle, main point/thesis, lesson concept and the key points, all verbatim saved text. | 5.2 |
| 6 | Ask them to draft a first summary of the assignment or thesis point themselves. | **First summary** prompt; the student writes it in the intro editor. Nothing is prefilled. | 5.3 |
| 7 | Each major point gets its own paragraph. | One paragraph per major point (default one per body section; promotable). | 4 |
| 8 | The beginning summarizes the assignment or what the paper is about; if the rubric specifies intro requirements, explain those. | Opening checklist ("says what the assignment is about") plus rubric explainer rows for intro criteria. | 5.4, 7 |
| 9 | Even if the draft doesn't flow perfectly, that's fine; now you have an introduction. | A rough intro passes the gate at the minimum length; nothing about flow blocks. Copy says so. | 5.5 |
| 10 | Then offer tightening: make it flow, switch points around, with generic example language. (t58: example language, not templates: "at this time," "in the beginning," "where…") | Tighten checklist, reorder questions by sentence number, and connector words/phrases as prompts; never fill-in-the-blank starters. | 9 |
| 11 | Student writes first, coach teaches structure around what they wrote. | Enforced by UI order (section 8) and the drafting guard (section 10). | 8, 10 |
| 12 | (t58) Every section gets teach-then-draft: "Where are you at on this? Want to give it a shot, or want me to break it down?" | Opener on every section (intro, body, counter, conclusion). | 8.1 |
| 13 | (t58) A conclusion isn't just a recap; it can look back at what was covered, what conclusions were drawn and how the paper finished. | Conclusion shape lesson, reflective questions and soft checklist. | 8.3 |
| 14 | (t58) One question at a time; drafted sentences move up the screen. | Sentence-by-sentence input; finished sentences rise into the paragraph. | 8.2 |
| 15 | (t58) After each section, a milestone pop-up with the skeleton as a background ghost, readable on "Review all"; clickable sections; "Ready for section four?" / "Do you want to review?"; strict in-order drafting. | Section-only milestone pop-ups; jump-and-return; no hopping ahead. | 11A |
| 16 | (t58) End of Drafting: the full outline (intro, body, support, conclusion), the "I just wrote a long paper" moment, before the next stage. | End-of-Drafting payoff from the student's own sentences. | 11A |
| 17 | (t58) The coach builds its own full paper from the captured ideas as an invisible answer key and reads the student's ideas back in that shape. | Hidden-draft scaffold (server only, never shown) shapes the read-back order and flags; guarded by H1–H8 and D9. | 8 step 2, 11A; stage specs 2C.7–2C.8 |
| 18 | (t58) Rough intro during Drafting; revisit and tighten in revision once the whole paper is visible. | No intro revisit inside Drafting; the revision checklist opens with an intro revisit. [PROVISIONAL, pending research validation] | 5.6 |

---

## 3. Handoff: the locked ledger (read-only input)

When Drafting opens, the server builds one **draft ledger** snapshot in code (no model call) and locks it. The student never re-explains anything (stage-specs decision 26). The ledger is read-only here.

**Contents (all already saved; nothing new is generated):**
- **Paper level:** THE LESSON (`papers.lesson`), `prompt_type`, `paper_genre` (section 6), story angle, refined thesis (the student's words), target length, and the assignment card's key fields with the teacher's own wording quoted verbatim ("Your teacher's words").
- **Big ideas, per section** (`section_decisions`): idea notes / key points (student verbatim), chosen leader(s) and style, `teach_aspect`, memory card (memory mode), verified source excerpts (≤ 2 sentences, cited by location), and a neutral note if the student chose **Continue anyway** at the logic checkpoint ("You chose to keep this angle.").
- **Section skeleton, per section** (approved outline card, stage specs 4.2):
  - **Topic sentence** = the card's `claim` (one student-typed sentence, 8–40 words). It's the student's own sentence, so reusing it verbatim is fine.
  - **Second sentence** = the card's second sentence-plan row (`role` + the student's `purposeNote`). Today that's a note, not a sentence (Q6).
  - The rest of the sentence plan (roles, purpose notes, citation flags with linked excerpts or "needs a source").

**Locking and versions.** Saved as `draft_ledgers` v1 with a hash of its source rows. It changes only through the existing routes: the outline "Edit outline" drawer (reason required, logged) or reopening a section in the research loop. Either creates a new version; paragraphs that used a changed item show a soft banner, **"Your plan changed for this point — take a look"** (never blocking; the student's text is never changed).

```ts
// lib/drafting/ledger.ts
// SOP: coaching only, never generate submission text — built in code from saved student data
export const LedgerItem = z.object({
  id: z.string(), sectionKey: z.string(),
  kind: z.enum(['idea','memory','leader','style','teach_aspect','excerpt','topic_sentence','second_sentence_plan','plan_row']),
  text: z.string().max(600),            // verbatim student text, or verbatim verified source excerpt
  origin: z.enum(['student','source']), // never 'ai'
  sourceId: z.string().optional(), location: z.string().optional(),
  major: z.boolean().default(false),    // one paragraph per major point (section 4)
});
export const DraftLedger = z.object({
  paperId: z.string().uuid(), version: z.number().int().min(1),
  lesson: Lesson.nullable(),
  promptType: z.enum(['lesson','personal_experience','mixed']),
  paperGenre: PaperGenre,               // section 6
  storyAngle: z.string(), thesis: z.string(), targetWords: z.number().int(),
  teacherWords: z.array(z.object({ rubricRef: z.string(), quote: z.string() })), // verbatim assignment text
  sections: z.array(z.object({ sectionKey: z.string(), title: z.string(), kind: z.string(),
    mode: z.enum(['lesson','memory']), items: z.array(LedgerItem) })),
  sourceHash: z.string(),
});
```
A server test asserts every `student` item is a verbatim substring of a saved student field and every `source` item a verbatim substring of a verified source. No AI-written text can enter the ledger.

---

## 4. The framework: one paragraph per major point

Built in code from the ledger right after locking, shown read-only at the top of the stage as **"Your paper, paragraph by paragraph"** (Colton: "the coach knows the paper will talk about this leader, this style, these ideas, and builds a framework"):
- **Intro** (1 paragraph, always first) → **body paragraphs** → **Counterargument & Rebuttal** (only when the rubric asks; stage-specs decision 43) → **Conclusion** (1 paragraph, always last).
- Each row lists its ledger items in the student's own words and its planned sentence roles.
- **Major points:** each body section's `claim` is a major point, so a body section starts as one paragraph. Other ideas are supporting by default. At handoff the student can tap **"This is its own point"** on any idea to give it its own paragraph, or **"Fold this into the paragraph above"** to merge it back (merges the plan, never the student's text). Max 3 paragraphs per section. The coach suggests a split only as a question, when one paragraph's ledger items cover 2+ chosen leaders or 2+ distinct teach aspects: "These two ideas are pulling in different directions. Do you want to give each one its own paragraph?" A promoted point gets its own topic-sentence input before drafting (5.3 step 1 rule).
- **Length:** the 5.3 section minimum splits evenly across the section's paragraphs, floor 50 words per body paragraph. Intro and conclusion keep `max(60, 0.75 × min)`.
- Body paragraphs can be reordered within a section (drag + ▲/▼), never across the intro/conclusion locks.

---

## 5. The introduction comes first

### 5.1 Teach intro formats briefly (teach-then-ask)
The intro opens with the same opener as every section (section 8.1): **"Where are you at on this? Want to give it a shot, or want me to break it down?"** **Break it down for me** shows the format card below first; **I'll give it a shot** goes straight to the read-back and the first-summary prompt, with the format card one tap away (**Show me ways to open**).

A scripted card, **"Ways to open your paper"**, shows the formats for the paper's intro variant (section 6), 1–2 lines each, **structure only**: no example sentences, no topic words (`lib/coaching/introFormats.ts`, not model-generated). Then the ask (teach-then-ask, stage-specs decision 38): **"Which one feels most like how you'd start?"** with each format as a chip, plus **Not sure, pick for me** (the variant's default) and **I've got my own way**. Collapsible; **I know this** skips. Never blocks. Every card ends with Colton's rule: **"Whichever you pick, your intro should tell the reader what this assignment is about, in your words."**

### 5.2 Read the captured ideas back
Philosophy section 4 pattern, all slots verbatim saved text (no AI phrasing in the slots):
> Here's what we captured for your paper based on what you told me. Your story: {storyAngle}. Your main point: {thesis}. What this assignment is teaching: {lesson concept}. We chose **{leader}**, we chose **{style}**. Your key points: 1. {claim 1} 2. {claim 2} …

Story / reflective / case variants swap "Your main point" for the matching line ("What your story shows", "What you learned", "The question you're answering") when the ledger has it; otherwise the line is omitted rather than invented.

### 5.3 The student drafts the first summary themselves
The intro editor opens **empty** with one prompt above it, by variant:
- Thesis: **"In a sentence or two, in your own words: what is this paper about, and what's your main point?"**
- Story: **"In a sentence or two: what moment are you writing about, and what does it show?"**
- Reflective: **"In a sentence or two: what happened, and what did you learn from it?"**
- Case: **"In a sentence or two: what's the situation, and what question are you answering?"**

Placeholder: "Start here. It doesn't need to be perfect. We'll tighten it together after." Nothing is prefilled, and the coach adds nothing until the student has written. This first summary is the start of the intro, typed in the same editor.

### 5.4 The opening summarizes the assignment, and rubric intro requirements are explained
After the first summary, the intro's checklist and rubric rows appear (section 7): the opening should say what the assignment / paper is about, cover each rubric intro requirement, and land on the variant's landing line (section 6).

### 5.5 A rough intro is fine
**Check my intro** is enabled at the intro minimum. Flow issues never block: the copy after the first check says **"That's a real intro. Now we can make it flow."** and tightening (section 9) opens. The intro is saved like any paragraph (section 8 step 8).

### 5.6 Rough intro now, revisit in revision (t58, [PROVISIONAL] pending research validation)
Drafting deliberately produces a **rough** intro first, for direction. There is **no intro revisit inside Drafting** (the t53/t56 "take one more look" prompt after the body is removed). Instead, the **revision stage** (code Stage 6; Colton's "Stage 5 (revision)") opens its checklist with an **intro revisit** once the whole paper is visible: the coach reads back the student's own intro next to their own body topic sentences and conclusion, and asks questions only ("Does your intro promise what your body paragraphs deliver?", "Is your main point in the intro still the point you ended on?", "Is there a term your intro uses that your body defines differently?"). The student edits; the coach never rewrites. Common writing guidance describes this pattern (write a working introduction early, then revise it after the body exists), but it hasn't been validated by our research team yet; no citation is claimed. Stage specs 6.1 (t58 line).

---

## 6. Intro variants by paper type (t56, [PROVISIONAL])

**Colton's question: does the intro teach-then-draft loop apply to every paper type, or only ones with a clear thesis?**

**Answer: every type.** The loop shape is the same for all papers: teach a few opening formats → read the captured ideas back → the student drafts the first summary → a rough intro is fine → tighten with generic connector example language (t58). Not every paper has a thesis, so what changes per type is the **opening move** and the **landing line** (what the intro ends on), plus the matching checklist and default connector set (t58; frames retired). Forcing a thesis onto a personal story, a reflection or a case would teach the wrong lesson (stage-specs 2B.1, lesson-first). This reuses existing muscles: teach-then-ask for the formats (M2), memory-forward for story openings (M5), lesson-first for what the opening must explain (M1). The only new piece is the variant table itself, marked [PROVISIONAL].

### 6.1 Which variant (routing)
- **`papers.paper_genre`** [PROVISIONAL, new column in 0010]: one of the 13 types in `retainwrite-prompt-type-taxonomy-brief.md` (`narrative`, `personal_experience`, `reflective`, `admissions`, `expository`, `argumentative`, `compare_contrast`, `cause_effect`, `literary_analysis`, `rhetorical_analysis`, `research`, `case_study`, `critique`) or `unknown`. Set in Stage 1 by the brief's routing rules (rubric first, then the prompt verb; the brief's decision order), with the student able to change it. Until that classifier ships, it's derived from Stage 2's `prompt_type`: `personal_experience` → `personal_experience`; `lesson` → `unknown`; `mixed` → the intro section's `mode` (`memory` → `personal_experience`, else `unknown`).
- **`unknown` → thesis intro**, matching the brief's fallback (expository is the most common type at every level).
- **Hybrids:** the primary type picks the variant (brief's tie-breaker).
- The variant shows as a small line above the format card, **"Opening style: thesis intro · Change"**. The student's pick wins (`draft_paragraphs.intro_variant_source = 'student'`).

### 6.2 The four variants

| Variant | Paper types | Opening move | Landing line (what the intro ends on) | Default format | Default connector set |
|---|---|---|---|---|---|
| **Thesis intro** | argumentative, expository, research, literary analysis, rhetorical analysis, critique, compare-contrast, cause-effect, unknown | Say what the paper explores and why, and explain the key terms the rubric needs | **The thesis** (main point / claim / interpretation / verdict / insight from the comparison / causal claim) | `assignment_forward` | `sequence` + `build_on` |
| **Story intro** | narrative, personal-experience, admissions | A hook or a short scene from the real moment | **A "so what" line:** what the story will show or what it meant, **not a thesis** | `scene` | `time_moment` |
| **Reflective intro** | reflective | Context: what the experience or task was, where and when (plus the course framework if the rubric names one) | **The insight:** what you learned or how your thinking changed | `context_insight` | `looking_back` |
| **Case intro** | case study | The situation: who, what, and the problem or decision | **The question** the analysis answers (plus a one-line preview of the recommendation only if the rubric asks for it up front) | `situation_question` | `cause_effect` + `concluding` |

Type notes:
- **Compare-contrast:** landing line = the insight the comparison reveals; the format card adds "Name both things you're comparing." The roadmap format mirrors the student's organization choice (point-by-point or subject-by-subject).
- **Cause-effect:** landing line = the causal claim; the checklist adds "Is your claim about more than one cause, or are you sure it's just one?" (question only).
- **Literary / rhetorical analysis:** the format card adds "Name the work and the author." The checklist adds "Does your main point say *how* or *why*, not just *what happens*?" (the brief's thesis-type check, as a question).
- **Critique:** landing line = the verdict against the criteria.
- **Research:** the question opener is the default format when the rubric names a research question.
- **Admissions:** no "summarize the assignment" line about the prompt mechanics; instead "Does your opening make clear which prompt you're answering, through the story itself?" Word-limit awareness: the intro minimum drops to 40 words for papers ≤ 650 words.
- **Narrative (imagined):** the scene opener is reworded to "Open inside a moment in your story."

### 6.3 Format bank (`lib/coaching/introFormats.ts`, scripted; exact card copy)

| Variant | id | Name | Card copy (structure only) |
|---|---|---|---|
| Thesis | `assignment_forward` | Assignment-forward | Say what this paper explores and why it matters, explain any key term the reader needs, then land on your main point. |
| Thesis | `funnel` | Funnel | Start with the big picture, narrow to your topic step by step, and end on your main point. |
| Thesis | `question` | Question opener | Ask the question your paper answers, then give your answer as your main point. |
| Thesis | `fact` | Surprising fact | Open with one fact from your verified sources (cite it), then connect it to your main point. Hidden when there's no verified excerpt. |
| Thesis | `roadmap` | Roadmap | Give your main point first, then preview your points in the order they come. |
| Story | `scene` | Scene | Drop the reader into one real moment, then say what it shows. |
| Story | `hook_line` | Hook line | Open with one line that makes the reader curious (a feeling, a surprise, something someone said), then set the scene. |
| Story | `then_now` | Then and now | Show how things were before, hint at what changed, and say what the story will show. |
| Reflective | `context_insight` | Context, then insight | Say what the experience was and when, then the main thing you learned. |
| Reflective | `framework_first` | Framework first | Name the framework your class uses, say which experience you'll look at through it, then your insight. (Shown only when the rubric names a framework.) |
| Reflective | `question_reflect` | The question it raised | Name the question the experience made you ask, then where your thinking landed. |
| Case | `situation_question` | Situation, then question | Describe the situation and who's involved, name the problem, then the question your analysis answers. |
| Case | `stakes_first` | Stakes first | Say what's at stake and for whom, then the situation, then your question. |
| Case | `framework_case` | Framework, then case | Name the framework you'll use, describe the case briefly, then your question. (Shown only when the rubric names a framework.) |

### 6.4 Opening checklist by variant (computed in code where possible, model-assisted otherwise; all soft)
- **All variants:** says what the assignment / paper is about (overlap with the assignment card's task terms, or a model yes/no); covers each rubric intro requirement (section 7); matches the chosen format's first move.
- **Thesis:** states the main point (overlap with the student's thesis; model yes/no fallback).
- **Story:** opens in a moment or with a hook; has a "so what" line; connects to the prompt's own feeling word (verbatim `lesson.emotionalTerms`) when there is one. **No thesis check.**
- **Reflective:** names the experience and its context; states an insight (what changed or was learned); names the framework when the rubric requires it.
- **Case:** names the situation and stakeholders; states the problem or decision; poses the question; previews a recommendation only if the rubric asks.

---

## 7. Rubric explainer: "if the rubric specifies intro requirements, explain those"

For each rubric criterion tied to the intro (any criterion mentioning the introduction, thesis, hook, key terms, roadmap, or context) and to each paragraph (`section_plans.rubric_refs`), the coach shows a **"What your teacher is asking for"** row:
- **Your teacher's words:** the criterion quoted verbatim (stage-specs section 2 guard rule 3).
- **In plain words:** ≤ 30 words on what the criterion means and what a reader should be able to find, described as a *job*, not as text ("Your reader should be able to tell which leadership style you're writing about and what it means, before you give examples.").
- **Check yourself:** one question ending in "?" ("Could a classmate find your definition of the style in your intro?").
- Generated once per paper + criterion with `MODEL_FAST`, cached in `draft_paragraphs.rubric_explainers`; scripted fallback per criterion type (define / thesis / hook / context / evidence / citation / counterargument / reflection / length / format). Reuses the TEACH guard (no example sentences, no thesis-like claims, no named people). The plain line may use words from the criterion it explains (the teacher's own words); it never states a claim about the student's topic.
- If the rubric has no intro requirements, the row says "Your teacher didn't list specific intro requirements. The basics: tell the reader what this paper is about and where it's going."

---

## 8. The per-paragraph loop (student always writes first)

Every section and every paragraph in it (intro, body, counter, conclusion) runs the same loop, in strict order (decision 78). Steps 0–3 come before the student types; steps 4–8 respond to what they wrote.

### 8.1 The opener: "Where are you at on this?" (DECIDED, Colton t58)
Each **section** opens with one question, on its own beat:
> **Where are you at on this? Want to give it a shot, or want me to break it down?**

- **I'll give it a shot** → step 2 (read-back) → step 3 (draft). The shape card (step 1) is one tap away (**Show me the shape**).
- **Break it down for me** → step 1 (teach the shape) → step 2 → step 3.
- Either way the student writes first; the coach teaches structure around what they wrote (steps 4–7). The choice is saved per section (`draft_paragraphs.opener_choice`) and logged `draft_opener_choice {kind, choice}`.
- Paragraphs after the first in a multi-paragraph section skip the opener and go straight to the read-back (one question per beat; no repeated asks).
- **Independence fade [PROVISIONAL]:** after the student completes 3 papers with the muscle on, the opener defaults its focus to **I'll give it a shot**, shape cards start collapsed, and connector prompts (section 9) sit behind **Need connector ideas?**, so the student increasingly runs the workflow alone. The student can always ask for the breakdown.

### 8.2 One sentence at a time; finished sentences move up (DECIDED, Colton t58; layout [PROVISIONAL])
- The Drafting editor shows **one input for the current sentence** at the bottom of the frame. **Add sentence** (or Enter) commits it; the finished sentence **moves up the screen** into the growing paragraph above (a short slide-up; none under `prefers-reduced-motion`), and the input clears for the next sentence.
- The paragraph above is the student's own text, in order, with sentence numbers on hover. Earlier sentences **in the current paragraph** can be tapped to edit in place (that's not hopping ahead). Later paragraphs and sections are locked until the current one is saved (decision 78).
- The read-back and the planned sentence role for the next slot (from the sentence plan: e.g. "Next: evidence (needs a source)") sit just above the input as quiet guidance, never as text to copy.
- A paste of several sentences is split at sentence boundaries; each goes up as its own sentence (paste is never blocked; 5.2 note rules unchanged).
- **Accessibility alternative:** **Write as one box** switches the frame to a plain textarea for students who prefer it or use assistive tech; the same checks run on save. Screen readers hear "Sentence {n} added" (polite) on commit.
- Autosave every 5 s and on commit (no AI call).

### 8.3 Conclusion: more than a recap (DECIDED, Colton t58)
The conclusion runs the same loop (opener → shape → read-back → draft). Its shape card teaches that a conclusion is **not just a recap**:
> **A conclusion can look back.** Remind the reader what you covered, then step back: what did you figure out by writing this, what conclusions did you draw, and how does your paper finish? End on why it matters now.

- **Read-back for the conclusion** (verbatim saved text only): the thesis / landing line, each body section's topic sentence, the logic-checkpoint "kept angle" notes if any, and the lesson concept.
- **Reflective prompts** (scripted, one at a time, ≤ 25 words each): "Looking back over your paper, what do you understand now that you didn't at the start?", "Which of your points surprised you most while writing it?", "If a classmate read only your conclusion, what should they walk away thinking?", "How does your paper finish: with an answer, a question, or a call to do something?" Story/reflective variants use the matching wording ("What did this moment change for you?", "What will you do differently now?"); case variant: "What should happen next, and why does your analysis support it?"
- **Conclusion checklist (soft):** recaps the main point in new words (overlap check against the thesis, not a copy: flags if ≥ 80% token overlap with the intro's landing line as "Is this sentence repeating your intro word for word?"); includes at least one look-back or insight sentence (model yes/no); finishes with a closing move (why it matters, a question, or a next step).
- Never writes the reflection for the student; D1–D9 apply.

### 8.4 Loop steps

0. **OPENER** (section 8.1; first paragraph of each section).
1. **TEACH (short; shown on Break it down for me, otherwise one tap away).** Intro: the format card (section 5.1). Others: one scripted structure-tip card (`lib/coaching/paragraphShapes.ts`): body = "Point → proof → explain → link back"; counter = "Fair version of the other side → your response → why yours holds"; conclusion = "What you covered → what you figured out → how it finishes" (full card in 8.3); memory-mode body = "The moment → the detail → what it meant"; reflective body = "What happened → what it meant → what you'll do differently"; case body = "Fact from the case → framework → what it tells you". Plus rubric rows (section 7). Collapsible.
2. **RE-READ the ledger** (philosophy section 4), **in the shape of the hidden draft** when `FEATURES.hiddenDraft` is on (decision 70; stage specs 2C.7): the student's own ideas, read idea by idea in the order the answer key places them, with at most 2 flags ("This idea might land better in {section}.", "Your sentence {n} plan carries a lot; want to split that idea?"). The read-back text is only the student's words and labels: "Here are the {n} ideas we captured for this paragraph based on what you told me. We chose {leader}, we chose {style}. Idea one: … Write those ideas in your own words." Plus the topic sentence (the student's own `claim`), the second-sentence plan row, linked excerpts, and transition suggestions (relationship label + bank connectives only, 5.3).
3. **STUDENT DRAFTS, one sentence at a time** (section 8.2). Topic sentence first (5.3 step 1, unchanged; for the intro, the first summary from 5.3 above), then the rest of the paragraph. Autosave every 5 s (no AI call). Live word count. **Ask the coach** stays available on request (5.1 limits).
4. **CHECK** (**Check my paragraph** / **Check my intro**, enabled at the paragraph minimum). `MODEL_STRONG` returns `ParagraphFeedback`; the style check runs in code (stage specs section 7) and, if tripped, shows the t48 nudge.
5. **STRUCTURE FEEDBACK.** "What's working" (≤ 2, tied to sentence numbers), "Ideas you planned vs. used" (from the ledger), up to 3 questions, and for the intro the variant's opening checklist (6.4).
6. **TIGHTEN AND REORDER** (section 9), shown once a rough version exists.
7. **STUDENT REVISES.** Same editor. **Check again** on request (max 3 per paragraph). Each save stores a version.
8. **SAVE.** **This paragraph is done** is enabled when the paragraph ≥ minimum, its topic sentence (or first summary, for the intro) is still first, and feedback was viewed (the 5.3 step 7 hard rules, per paragraph). Everything else is soft and copies to `carryFlags` for revision. The next paragraph unlocks. A section is done when all its paragraphs are done.

```ts
// SOP: coaching only, never generate submission text
export const ParagraphFeedback = z.object({
  structure: z.object({
    topicSentenceFirst: z.boolean(),
    onePoint: z.enum(['yes','maybe_two','unclear']),
    ledgerCoverage: z.array(z.object({ ledgerItemId: z.string(), present: z.boolean() })),
    explainsEvidence: z.boolean().nullable(),
    linksBack: z.boolean(),
  }),
  conclusionChecklist: z.object({ recapInNewWords: z.boolean(), lookBackPresent: z.boolean(), closingMove: z.boolean() }).nullable(), // conclusion only (8.3)
  introChecklist: z.object({
    variant: z.enum(['thesis','story','reflective','case']),
    assignmentSummarized: z.boolean(),
    rubricIntroRequirements: z.array(z.object({ rubricRef: z.string(), present: z.boolean() })),
    landingLinePresent: z.boolean(),        // thesis | so-what | insight | question, per variant
  }).nullable(),                            // intro only
  praise: z.array(z.object({ sentence: z.number().int().min(1), note: z.string().max(140) })).max(2),
  questions: z.array(z.string().max(220)).max(3),          // each ends with "?"
  tighten: z.array(z.object({ sentence: z.number().int().min(1),
    kind: z.enum(['long','repeat','filler','off_point','unclear_reference','missing_link','flow']),
    question: z.string().max(200) })).max(4),
  reorder: z.object({ order: z.array(z.number().int().min(1)), why: z.string().max(200) }).nullable(), // sentence numbers only
  connectorRelation: z.enum(CONNECTOR_RELATIONS).nullable(), // which connector set to offer (section 9); id only, never free text
  heavySentence: z.number().int().min(1).nullable(),      // a sentence that carries too much (code + model); shown as a question
});
```
Rule-based fallback on timeout/error: sentence count and length, ledger coverage by content-stem overlap, thesis/landing-line overlap for the intro, repeated words, and scripted questions. Logged `ai_fallback`.

---

## 9. Tightening: flow, reorder, and example language (t58: example language, not templates)

**When:** after the first check on a rough version (Colton: "even if it doesn't flow perfectly, now you have an introduction; then offer tightening").

**Flow and tighten checklist** (computed in code first; the model adds questions only):
- "Sentence {n} is {w} words. Your sentences usually run about {avg}. Is there a natural place to split it?" (uses the voice baseline average when one exists).
- "Sentence {n} is carrying a lot. Is it doing two jobs?" (from `heavySentence`: a sentence much longer than the paragraph's average, or one that covers two planned rows / two ledger ideas; hidden-draft pacing may raise it, but the question names only the student's sentence number).
- "'{word}' shows up {k} times. Is each one doing work?" (word quoted verbatim from the student).
- "Does sentence {n} lead into sentence {n+1}, or is there a jump? A connecting word might help." (plus the connector prompts below).
- "Which sentence tells the reader what this paragraph is about? Is it first?"
- Filler/hedge list (scripted): "very", "really", "in today's society", "throughout history", "it is important to note" → "Do you need '{phrase}' here?"

**Reorder ("switch points around"):** sentence numbers only, as a question: "What if sentence 3 came before sentence 2? Read it both ways and see which feels clearer." At the paper level: "Your second key point builds on your third. Want to switch those paragraphs?" (paragraph numbers only; within the current section, or an earlier one via jump-and-return). The student moves things themselves in a **Reorder view** (drag handles or ▲/▼ on whole sentences or paragraphs, byte-identical text). No one-click "apply the coach's order" (Q5).

**Example language, not templates (DECIDED, Colton t58; replaces the t53–t57 arc frames).** At transition points (between sentences that jump, between paragraphs, into the conclusion), the coach offers **connector words and short phrases** as prompts to help the student organize the thought. They are **never** fill-in-the-blank sentence starters, frames, or slot templates, and they never contain topic words.
- Shown as a small row of chips under the input: **"Words that can help connect this:"** followed by 4–6 entries from one relation set, plus **More** (next set) and **Not now**. Chips are **display only** (tapping shows a one-line note on how the connector is used; it inserts nothing). The student types their own sentence.
- **Connector bank** (`lib/coaching/connectors.ts`, scripted; each entry ≤ 4 words, or a single word with "…" to show it leads into the student's thought):

| Relation id | Use it when | Example language |
|---|---|---|
| `time_moment` | placing a moment in time | at this time · in the beginning · at first · by then · later that… · when… |
| `sequence` | moving through steps or points | first · next · after that · from there · finally |
| `place_context` | setting the scene or context | where… · in that setting · at that point · within… |
| `build_on` | adding to the last idea | building on that · in the same way · also · what's more |
| `contrast` | turning to a difference | however · on the other hand · by contrast · even so · yet |
| `cause_effect` | showing why or what followed | because of this · as a result · so · which led to… · this meant… |
| `example` | bringing in evidence or an example | for example · for instance · such as · one case is… · this shows… |
| `zoom_out` | stepping back to the bigger picture | overall · more broadly · this matters because… · stepping back… |
| `looking_back` | reflecting (conclusions, reflective papers) | looking back · in the end · what I learned… · now I see… |
| `concluding` | finishing the paper | in the end · ultimately · to close · going forward… |

- The relation is picked by code from the sentence plan (next row's role) and the paragraph kind; the model may only return a `connectorRelation` id. Every intro variant has a default set (section 6.2).
- **Why this helps independence:** chips are labeled by relation ("contrast", "cause and effect") so students learn the kinds of moves, not stock sentences. The independence fade (8.1) moves them behind **Need connector ideas?** after a few papers.
- Retired: `lib/coaching/arcFrames.ts`, `ARC_FRAME_STYLE`, `arcFrameId`, the "We started with [ ]…" frames and the "shape, not the words" panel. Colton's "we started here, we went to here" is now taught as a structure idea in the shape cards ("Where you started → where you went → where you ended up") with connector chips (`time_moment`, `sequence`), not as a sentence to fill in.

---

## 10. Drafting guard: no pasteable sentences, ever

`lib/ai/draftGuard.ts`, run after the shared `lib/ai/guard.ts` on every Drafting coach output (Ask the coach answers, `ParagraphFeedback`, rubric explainers, split/merge questions, stall prompts). On failure: retry once with the reason appended; if it fails again, use the rule-based fallback and log `draft_guard_rejected {rule, field}` and `draft_guard_fallback` (no text in `detail`).

**Topic lexicon.** Per paper, built in code: content-word stems (lemmatized, stopwords removed) from the ledger, the student's draft, the assignment card, `lesson.concepts`, chosen leader names, story angle, thesis and verified excerpts. **Generic allow-list:** structural and academic words that are never topic content (`paper`, `paragraph`, `sentence`, `point`, `idea`, `reader`, `intro`, `conclusion`, `evidence`, `source`, `example`, `first`, `next`, `main`, `clear`, `split`, `story`, `moment`, `question`, …; `lib/ai/genericWords.ts`).

**Rules (reject when any fails):**
- **D1. No topic declaratives.** Outside quotation marks, a declarative sentence (subject + verb, ends in "." or "!") may contain no topic-lexicon stem. Topic words may appear only inside questions or verbatim student quotes. **One exception:** a rubric explainer's plain line (section 7) may reuse words from the criterion it explains, addressed to the student as a job ("Your reader should be able to…"), never as a claim about the topic.
- **D2. Verbatim quotes only, and short.** Any quoted span must be an exact substring of the student's current draft or ledger, ≤ 8 words.
- **D3. No new topic content in questions.** A question may use topic words only if they already appear in the student's draft or ledger, and it may not be claim-shaped: after removing the question frame ("Does your paragraph say that…", "Would it help to mention…", "What if you said…"), the remainder may not be a declarative clause ≥ 6 words containing a topic stem.
- **D4. No rewrite cues.** Stage-specs section 2 list plus "something like", "you might write", "try saying", "one way to put it", "your intro could read", "here's a version", "consider phrasing", "reworded", "a stronger sentence would be", "your thesis could be", "your so what could be".
- **D5. Paraphrase check.** No output sentence shares ≥ 3 content stems (any order) with any single student sentence unless it's a verbatim quote.
- **D6. Connectors, formats and shapes are code-only; no frames anywhere.** `connectorRelation`, intro formats and paragraph shapes must be bank ids. Any coach output containing a fill-in-the-blank pattern (brackets, underscores, "___", "[your …]") or a sentence starter that ends in an open slot ("It starts with…", "We started with…") is rejected.
- **D7. Field shape.** `praise.note` references its sentence by number and describes what it does (≤ 20 words, no topic stems outside a verbatim quote); `tighten.question` and `questions[]` end with "?"; `reorder.order` is a permutation of the paragraph's sentence numbers.
- **D8. Existing hard limits still apply** (stage-specs section 2): no citations, no "% AI" or detector phrasing, rubric scope, verbatim excerpts.
- **D9. (t57, PROVISIONAL) No hidden-draft leak.** When `FEATURES.hiddenDraft` is on, every Drafting output (and every read-back, peek and zoom-out string) also passes `assertNoHiddenDraftLeak` (stage specs 2C.8 H3): no 5-token n-gram from the hidden draft that isn't in the student corpus, no near-verbatim sentence (≥ 0.5 novel-token containment or ≥ 0.6 char-4-gram Jaccard). On a hit: block, scripted/verbatim fallback, log `hidden_draft_leak_blocked {surface, rule}`. D1–D8 still apply; D9 runs last.

**Bank checks (CI):** every entry in `connectors.ts` is ≤ 4 words and uses only allow-listed words; no entry in `connectors.ts`, `introFormats.ts` or `paragraphShapes.ts` contains brackets, underscores or slot markers; `arcFrames.ts` doesn't exist.

---

## 11. Edge cases

- **Blank page / stall** (empty editor 3 minutes after the read-back, two "I don't know" replies to Ask the coach, or **I'm stuck**): "Totally normal. Let's get a first sentence down together. You write it, I'll ask the questions." Then:
  - **Lesson sections:** reuse TEACH (stage specs 2B.4): reopen the concept card and ask "Which part of {concept} does this paragraph show?", then "What's the one thing this paragraph needs to tell the reader?" ("Type your answer right in the box. That can be your first sentence.")
  - **Memory sections / story intro:** reuse the memory path (2B.8): MIRROR the feeling word, then the scripted gentle trigger chips (t52 wording; **Not this one**, **Skip these**, safety note), then sensory questions one at a time.
  - **Say it out loud:** dictation counts as typed; the transcript lands in the editor as the student's own words.
  - After 2 nudges, "I'm stuck — flag for help" (thin.ts) saves a flag and lets them leave and come back. **Never** a sentence, opener or example written for them.
- **"Just write it for me" / "give me an example sentence":** fixed reply: "I can't write it for you. That's the part that makes it yours, and it's what you'll remember. Let's get your first words down: what's the one thing this paragraph needs to say?" Logged `draft_write_request_declined`.
- **Paste:** allowed in every editor, never blocked. The 5.2 note ("We suggest using your own writing so your tone is better understood and we can serve you better.") shows at most **once per session per paper**, sharing the key `rw_paste_suggestion_{paperId}`. Paste metadata is recorded per paragraph and rolled into `drafts.section_paste_meta` on section save. Pasted text gets the same feedback and style check (section 7 rules, including the ≥ 120-word pasted-span rule). Drafting text never changes `naturalWords` or the bottom voice note. A pasted block with blank-line breaks gets one question: "This looks like it covers more than one point. Want to split it across paragraphs?" (**Split it** moves the student's own text at the breaks / **Keep it together**).
- **Voice nudge:** if the section 7 check trips on a saved paragraph, the t48 nudge shows inline ("This part sounds a little different from your usual voice. Want to read it aloud and make it sound more like you?", **Make it sound like me** / **Keep it as is**). Never a check-in or an accusation.
- **Planned idea missing from the draft:** soft ○ plus a question, carried to revision. A body paragraph using 0 planned evidence keeps the 5.3 rule (≥ 15-word "Why I haven't used evidence yet" note).
- **Student ignores tightening:** fine; items stay optional ○ and copy to `carryFlags`.
- **Paragraph covers two points:** `onePoint = 'maybe_two'` → the split question; never auto-split.
- **Continue-anyway sections** (strong logic flag kept): drafting proceeds normally; no new warning.
- **Very short assignments** (< 400 words or a one-paragraph prompt): one paragraph total; the intro lesson collapses to "Open by saying what you're answering"; connector default `sequence`.
- **Wrong intro variant:** the student taps **Change**; checklist and formats switch; their text is untouched.
- **Ledger updated mid-draft:** section 3 banner; the student's text is never changed.
- **AI outage:** scripted banks and code-only checks keep the loop running; "Coach check unavailable — we'll recheck later."
- **Reopening a done paragraph:** allowed; new version; feedback re-runs on **Check again**.

---

## 11A. Interaction design layer in Drafting (t57; updated with Colton's t58 decisions)

The pipeline-wide layer is in stage specs **section 2C** (decisions 61–72; flags `FEATURES.interactionLayer`, `FEATURES.hiddenDraft`, both default `false`). In Drafting it works like this:

- **One question or frame per beat (DECIDED).** The opener, the shape card, the read-back, the sentence input, feedback and tightening each take the screen one at a time. Beat address `{5, sectionKey, step, paragraphKey | sentenceN}`.
- **Drafted sentences move up (DECIDED; 8.2).** The paragraph grows above the input as sentences are committed.
- **Ghost.** The framework (section 4) floats behind the frame as a faded skeleton, one block per paragraph, filling as the student drafts. It isn't readable at rest (decorative opacity; screen readers get the text summary "Paragraph 3 of 8 in progress"); tapping it or **Review all** opens it readable.
- **Peeks: off by default (t58).** `SKELETON_PEEKS = false` in `lib/config.ts`. No pop-up after each sentence or paragraph; the ghost just fills. (The t57 per-frame peek is kept only as a disabled option.)
- **Milestone pop-up after each section is done (DECIDED).** It opens over the frame with the whole paper skeleton behind it as a **background ghost**, not the focus. Foreground: "{Section label} is done." and two buttons:
  - **Ready for section {four}?** (primary; the next section's number spelled out in roadmap order, counting the intro as section one; "Ready for your conclusion?" when the conclusion is next) → opens the next section's opener.
  - **Do you want to review?** → **Review all**: the skeleton comes forward and becomes readable. Each section shows the **student's own drafted sentences** (drafted sections) or **captured-idea labels** (sections not yet drafted: the roadmap title plus the student's own idea notes, truncated to 12 words). Never hidden-draft text, never coach text. Readback flags (≤ 2) can appear here. Drafted sections are clickable to jump in and edit; not-yet-drafted sections are shown but not editable (strict order).
- **Strict in-order drafting (DECIDED).** Sections, paragraphs and sentences open in order; there's no skip in Drafting and no starting a later section early. **Jump-and-return:** clicking an earlier, drafted section opens it in edit mode (tightening view, section 9); when the student saves, or taps **Back to where you were**, the app returns to the exact current beat (same section, paragraph, sentence slot, scroll and focus). A jumped edit re-runs that paragraph's check on request only; it never resets the current section.
- **End-of-Drafting payoff (DECIDED; stage specs 2C.4).** When the last paragraph of the conclusion is saved, before the revision stage opens: **"Look at everything you wrote."** / **"This is your whole paper, in your own words."** Then the full outline: **intro, body sections, their support (evidence and explanation sentences, shown under each body paragraph's topic sentence), conclusion**, all in the student's own sentences, with a stat row from code ("{n} paragraphs · {k} sources · {w} words you wrote"). Actions: jump to any section to edit (returns here), **Export outline** (2A.7 allow-list), **On to revision**. Internal design intent: "holy crap, I just wrote a long paper"; it never appears in UI copy (CI grep). Shown once (`papers.payoff_shown_at`), re-openable from the ghost. Respects reduced motion.
- **Hidden draft and the read-back (DECIDED, Colton t58).** The coach's hidden full paper (stage specs 2C.7) is the invisible answer key. It shapes the idea-by-idea read-back (8.4 step 2): the student's own ideas, in the order the answer key places them, with ≤ 2 flags ("This idea might land better in {section}.", "Your sentence {n} plan carries a lot; want to split that idea?", "Your idea three may fit better after idea four. Want to move it?"). It never adds words, never suggests phrasing, never feeds `ParagraphFeedback` or any prompt (2C.8 H6), and is never compared with the student's draft to judge it. D9 guards every string.
- **Intro loop:** per-type variants, first-summary prompt and "rough is fine" are unchanged; the intro revisit happens in revision (5.6).

## 12. Data model — migration `supabase/migrations/0010_drafting_muscle.sql` (spec-only, PROVISIONAL)

`0008_section_loop.sql` is still spec-only and `0009_section_loop_followups.sql` is reserved as its fallback (stage specs 2A.6, 2B.11), so drafting takes **0010** either way. Additive; RLS on both new tables (`auth.uid() = user_id`). Don't apply until Colton approves.

```sql
-- 0010_drafting_muscle.sql  (PROVISIONAL, t53/t56 first draft)
alter table papers add column if not exists paper_genre text not null default 'unknown'
  check (paper_genre in ('narrative','personal_experience','reflective','admissions','expository','argumentative',
    'compare_contrast','cause_effect','literary_analysis','rhetorical_analysis','research','case_study','critique','unknown'));
alter table papers add column if not exists paper_genre_source text;   -- ai | student | derived

create table draft_ledgers (
  id uuid primary key default gen_random_uuid(),
  paper_id uuid not null references papers on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  version int not null,
  snapshot jsonb not null,                     -- DraftLedger; student/source verbatim text only
  source_hash text not null,
  locked_at timestamptz not null default now(),
  superseded_at timestamptz,
  unique (paper_id, version)
);

create table draft_paragraphs (
  id uuid primary key default gen_random_uuid(),
  paper_id uuid not null references papers on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  section_plan_id uuid not null references section_plans on delete cascade,
  paragraph_key text not null,
  sort_order int not null,
  kind text not null check (kind in ('intro','body','counter','conclusion')),
  ledger_version int not null,
  ledger_item_ids jsonb not null default '[]',
  loop_step text not null default 'teach'
    check (loop_step in ('teach','reread','drafting','feedback','tighten','revise','saved')),
  status text not null default 'locked'
    check (status in ('locked','open','saved','needs_review')),
  intro_variant text check (intro_variant in ('thesis','story','reflective','case')), -- intro only (t56)
  intro_variant_source text,                   -- derived | student
  intro_format text,                           -- id from introFormats.ts, 'own', or null
  rubric_explainers jsonb not null default '[]', -- [{rubricRef, quote, plain, check, source}]
  text text not null default '',               -- student text only; never AI text
  versions jsonb not null default '[]',        -- [{v, text, words, savedAt}], last 20
  feedback jsonb,                              -- latest ParagraphFeedback (guarded)
  feedback_runs int not null default 0,        -- first check + up to 3 re-checks
  connector_sets_shown text[] not null default '{}', -- t58: relation ids from connectors.ts (replaces arc_frame_ids)
  opener_choice text check (opener_choice in ('shot','breakdown')), -- t58, 8.1
  conclusion_checklist jsonb,                 -- t58, 8.3 (conclusion only)
  stall_count int not null default 0,
  paste_meta jsonb not null default '{}',      -- {pastedChars, typedChars, spokenChars, pasteRatio}; never shown, never gates
  rough_at timestamptz,                        -- first check
  saved_at timestamptz,
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (paper_id, paragraph_key)
);
create index on draft_paragraphs (paper_id, sort_order);
create index on draft_ledgers (paper_id, version);
-- RLS on both tables: auth.uid() = user_id.
```
- `stage_progress.data.sections[id].text` becomes derived (paragraphs joined by blank lines, written on paragraph save), so 5.3 gates, `drafts` v1 assembly and section 7 keep working unchanged.
- `carryFlags` gain `{paragraphKey, kind: 'tighten'|'coverage'|'intro_checklist'|'split'}` (Zod only).
- **t57:** the interaction layer and hidden draft add `0011_interaction_layer.sql` (`private.hidden_drafts`, `papers.payoff_shown_at`; stage specs 2C.12). No new columns here; `resumeBeat` is Zod-only in `stage_progress.data`.
- `FEATURES.draftingMuscle` is read at Drafting entry and stored as `stage_progress.data.draftingMode = 'classic'|'muscle'`; papers already drafting stay classic.

## 13. Session events (counts and ids only; no student prose in `detail`)

`draft_ledger_locked {version, sections, items}`, `draft_ledger_updated {version, changedItems}`, `draft_point_promoted`, `draft_point_folded`, `draft_paragraph_opened {kind}`, `draft_paragraph_reordered`, `intro_variant_set {variant, source}`, `intro_variant_changed {from, to}`, `intro_formats_shown {variant}`, `intro_format_chosen {id}`, `intro_first_summary_written {words}`, `paragraph_shape_shown {id}`, `rubric_term_explained {rubricRef, source}`, `ledger_readback_shown {items}`, `paragraph_check_requested {run}`, `paragraph_feedback_shown {onePoint, coverage}`, `intro_checklist_shown {variant, passed, total}`, `tighten_checklist_shown {items}`, `reorder_suggested`, `reorder_view_opened`, `paragraph_sentences_moved`, `connector_prompts_shown {relation}`, `draft_opener_choice {kind, choice}`, `sentence_committed {n}`, `write_as_one_box_toggled`, `conclusion_reflect_prompt_shown {id}`, `paragraph_split_offered`, `paragraph_split_accepted`, `paragraph_revised {version}`, `paragraph_saved {words}`, `draft_stall_detected {trigger}`, `draft_stall_nudge_shown {kind}`, `draft_write_request_declined`, `draft_guard_rejected {rule, field}`, `draft_guard_fallback`. **t57:** `skeleton_peek_shown`, `skeleton_zoomout_shown`, `section_jump`, `jump_returned`, `ready_for_next`, `draft_payoff_shown`, `readback_flag_shown`, `idea_moved`, `idea_kept`, `hidden_draft_generated`, `hidden_draft_leak_blocked` (stage specs 2C.13). Reused: `paste`, `paste_suggestion_shown`, `paste_suggestion_dismissed`, `voice_nudge_*`, `coach_asked`, `section_done`, `ai_fallback`, `teach_skipped_known`.

---

## 14. Acceptance tests (Vitest + evals; PROVISIONAL)

1. **Ledger lock:** entering Drafting creates `draft_ledgers` v1; every `student` item is a verbatim substring of a saved student field and every `source` item of a verified source; `ai` origin is impossible (schema); no edit control for ledger items; an outline edit creates v2 and flags only affected paragraphs without touching their text.
2. **No re-explaining:** read-backs render story angle, thesis, lesson concept, leader, style, key points, topic sentence and second-sentence plan row from saved data; no Drafting screen asks a question already answered in Stages 1–4 (snapshot test).
3. **Framework:** a 5-key-point leadership paper → intro + 5 body paragraphs + conclusion, in outline order; counter appears only when the rubric requires it; promoting an idea adds a paragraph (cap 3 per section, minimum split, floor 50); folding merges the plan only.
4. **Intro first:** the intro is the only open paragraph at stage entry; the format card shows before the editor; the editor opens empty with the variant's first-summary prompt; no coach output appears before the student has written.
5. **Per-type variants (t56):** argumentative / expository / research / literary analysis / rhetorical analysis / critique / compare-contrast / cause-effect / unknown → thesis intro with a thesis landing check; narrative / personal-experience / admissions → story intro, `scene` default, a so-what check and **no thesis check**; reflective → `context_insight` with an insight check; case study → `situation_question` with a question check; `prompt_type = 'personal_experience'` with no genre → story intro; `lesson` with no genre → thesis intro; the student's **Change** wins and persists; `framework_first` / `framework_case` show only when the rubric names a framework; `fact` hidden with no verified excerpt; admissions ≤ 650 words → intro minimum 40.
6. **Rubric intro requirements:** each intro criterion shows a verbatim teacher quote, a ≤ 30-word plain line and a "?" question; a plain line that states a claim about the topic is rejected; no intro criteria → the "basics" line; model failure → scripted per-type line.
7. **Rough intro is fine:** an intro at the minimum with flow problems can be checked and saved; nothing about flow blocks; tightening opens after the first check.
8. **Student writes first:** no feedback, tighten list or connector chips render before the student has written (connector chips may show once the first sentence is committed); no coach output renders before the paragraph minimum and a check; autosave makes no AI call.
9. **Tightening:** a 41-word sentence with a 14-word baseline average gets the split question; a word used 3× gets the repeat question with the verbatim word; reorder suggestions contain only sentence/paragraph numbers; no "apply order" control; the Reorder view moves whole sentences/paragraphs with byte-identical text.
10. **Example language (t58):** connector chips come only from `connectors.ts` (≤ 4 words per entry, allow-listed words, no brackets/underscores/slots); tapping a chip inserts nothing; `arcFrames.ts` and any `[ ]` / `___` / "We started with…" pattern appear nowhere in app code or coach output (CI grep + D6); each intro variant shows its default relation set.
11. **Drafting guard — topic leak** (ledger: servant leadership / John Legere / T-Mobile):
    - "It started with Legere's arrival at T-Mobile, then moved to his listening tours." → rejected (D1, D6).
    - "Servant leadership puts employees first." in any declarative field → rejected (D1).
    - "Does sentence 2 explain why this example fits the style?" → passes.
    - "Does your paragraph show that Legere's listening tours built trust with frontline employees?" (student never wrote "listening tours") → rejected (D3).
    - "Sentence 1 names 'servant leadership' clearly." (verbatim quote) → passes; "Sentence 1 shows how servant leadership empowers teams." → rejected (D1/D7).
    - A synonym-swapped version of the student's sentence 3 → rejected (D5).
    - "Something like: 'Leaders serve first.'" → rejected (D4, D1).
    - "Your so what could be that the trip changed you." → rejected (D4).
    - A quote that isn't an exact substring, or > 8 words → rejected (D2).
    - Two consecutive rejections → scripted fallback, `draft_guard_fallback` logged.
12. **Guard eval:** `evals/drafting-guard.jsonl` (≥ 40 golden ledgers across all four intro variants, including adversarial "write my intro" requests) runs nightly against the live model; pass bar **0 topic leaks** after the guard.
13. **Stall:** 3 idle minutes → supportive line plus TEACH (lesson) or MIRROR + gentle triggers (memory / story intro; every line passes the t52 gentle-invitation test); "write it for me" → the fixed decline; after 2 nudges the flag option appears; no stall path renders a sentence or opener.
14. **Paste:** an ≥ 80-word paste in any paragraph editor shows the 5.2 note once per session per paper (a second paste elsewhere → not shown); never blocks; `paste_meta` rolls into `drafts.section_paste_meta`; drafting text doesn't change `papers.natural_voice_words`; a multi-paragraph paste gets the split question once.
15. **Voice nudge:** a tripped check shows the exact t48 copy and buttons; retired strings appear nowhere (existing CI grep).
16. **Gates unchanged:** 5.3 hard rules hold per paragraph; the stage completes only when every paragraph and section is done and the draft is ≥ 300 words; section text equals the joined paragraphs; `drafts` v1 has the classic shape.
17. **Feature flag:** with `FEATURES.draftingMuscle = false` the classic 5.3 flow renders and no `draft_*` table is written.
18. **(t58) Milestones in Drafting:** no peek after sentences or paragraphs (`SKELETON_PEEKS = false`); after each section, the milestone pop-up shows the ghost skeleton (unreadable until **Review all**), "{Section label} is done.", **Ready for section {n}?** (spelled-out number; "your conclusion" when next) and **Do you want to review?**; review shows only the student's drafted sentences and captured-idea labels.
19. **(t58) Strict order + jump-and-return:** a later section/paragraph can't be opened for editing before the current one is saved; there's no skip control in Drafting; clicking an earlier drafted section edits it, and saving or **Back to where you were** returns to the exact current beat (section, paragraph, sentence slot, scroll, focus).
20. **(t57) Read-back shaping:** with hidden-draft signals, ideas may be reordered and ≤ 2 flags shown (confidence ≥ 0.7); Move moves the idea unchanged; no read-back string contains model prose.
21. **(t57) D9:** a read-back or feedback string containing a hidden-draft 5-gram not in the student corpus is blocked and logged; a string sharing only the student's own words passes; the canary never appears in any Drafting response, export or log.
22. **(t58) Opener on every section:** intro, each body section, any counter and the conclusion open with "Where are you at on this? Want to give it a shot, or want me to break it down?"; **Break it down for me** shows the shape card before the read-back; **I'll give it a shot** goes to the read-back with the shape one tap away; both lead to an empty input the student fills first.
23. **(t58) Sentences move up:** committing a sentence moves it into the paragraph above and clears the input; earlier sentences in the current paragraph are editable; a multi-sentence paste splits into sentences; **Write as one box** works and runs the same checks; reduced motion disables the slide.
24. **(t58) Conclusion:** the shape card says a conclusion can look back (covered → figured out → how it finishes), not just recap; reflective prompts appear one at a time; the checklist flags a sentence repeating the intro's landing line word for word as a question; no reflection text is ever generated (D1–D9).
25. **(t58) End-of-Drafting payoff:** shows once after the conclusion's last paragraph is saved and before revision opens, with "Look at everything you wrote." and the full outline (intro, body, support, conclusion) in the student's own sentences; the stat row counts only the student's words; CI grep finds the internal phrase and profanity nowhere in app code or copy files; the outline stage shows only "Your outline is complete." on its last milestone.
26. **(t58) Hidden-draft read-back shaping:** with a hidden draft present, the read-back order follows its placement signals and shows ≤ 2 flags; every string is the student's words, labels or scripted templates; D9 blocks a read-back that contains a hidden-draft 5-gram not in the student corpus.
27. **(t58) Name:** every student-facing string for the stage reads exactly "Drafting" (snapshot test over the stage rail, headers, emails and help copy); "Stage 3" and "Draft stage" don't appear in UI copy.
28. **(t58) Intro revisit lives in revision:** no intro revisit prompt inside Drafting; the revision checklist's first item is the intro revisit with questions only.

---

## 15. Open questions for Colton (updated t58)

**Resolved by Colton in t58 (kept for history):**
- ~~Q1 Numbering~~ → the student-facing name is **Drafting** (decision 73); code numbers unchanged.
- ~~Q2 Arc frames~~ → **example language** (connector words and phrases), never fill-in-the-blank frames (decision 80).
- ~~Q3 Intro timing~~ → **rough intro first, revisit in revision** (decision 81, provisional pending research validation).
- ~~Q7 Skipping in drafting~~ → **strict in-order drafting**, no skip, jump-and-return for earlier sections (decision 78).
- ~~Q12 Which "Stage 3"~~ → Drafting; the big payoff is at the **end of Drafting** (decision 79).
- ~~Q13 Two payoffs or one~~ → one big payoff at the end of Drafting; the outline stage keeps only a light "Your outline is complete." line.
- ~~Q14 Zoom-out frequency~~ → **after each section only**; peeks off by default (decision 77).
- ~~Q15 Prose vs. structure hidden draft~~ → **full paper**, server-side, never shown (decision 67 as updated t58).

**Still open:**
4. **Major points:** one paragraph per body section by default, with the student promoting extra ideas (cap 3 per section)? Or every key point in the ledger automatically its own paragraph?
5. **Reorder:** student moves sentences/paragraphs only, or also a one-click "try this order" that moves their own text without changing words?
6. **Second sentence:** the outline stores a *note* for the second sentence. Should the outline stage ask for an actual second sentence?
8. **Teacher's words:** OK to show the assignment wording verbatim while the student writes the first summary in their own words?
9. **Intro variants:** are the four variants (thesis / story / reflective / case) and their type assignments right (statement of purpose: story or thesis; compare-contrast: always a thesis)?
10. **Genre classifier:** classify `paper_genre` in Stage 1 now, or derive the intro variant from `prompt_type` until the taxonomy routing is approved?
11. **Format bank:** right starter formats per variant; hide any for younger grades?
16. **Tell students the hidden draft exists?** Privacy policy and an "About your coach" line saying the coach builds a private, never-shown version of the paper to check structure. We recommend yes, in plain words. **Material: needs an answer (and legal review of the privacy wording) before the hidden draft ships.**
17. **Hidden-draft retention:** text deleted 30 days after Drafting ends (90 days max; immediately on deletion). OK, or delete when Drafting completes? **Material for the hidden draft.**
18. **Readback flags:** max 2 per read-back, only at high confidence, Move it / Keep it here, never automatic. Right amount?
19. **Milestone pop-ups can't be dismissed by clicking outside;** the student picks Ready for section {n} or review. OK?
20. **(t58) Stage numbers after Drafting:** you mentioned the payoff comes "before Stage 4" and the intro revisit happens in "Stage 5 (revision)". In the code, the stage right after Drafting is Revise & feedback (one stage, route 6), and sources/audio beats come *before* Drafting. We've placed the payoff at the end of Drafting and the intro revisit in Revise & feedback. Is there a stage between Drafting and revision that we're missing? **Material: affects where the payoff and revisit live.**
21. **(t58) Sentence-by-sentence input:** one sentence at a time with finished sentences moving up, plus a **Write as one box** option. Keep the option, or sentence-by-sentence only?
22. **(t58) Independence fade:** after 3 papers the opener leans to "give it a shot," shape cards collapse and connector chips hide behind a link. Is 3 the right number?
23. **(t58) Wildcard safety absolutes:** controversial figures now get a neutral "reported, not confirmed" note instead of being blocked, and the student can override. Should anything still be excluded outright for under-18 students (beyond "never offensive for its own sake")?
24. **(t58) Research validation:** the rough-intro-first / revise-later pattern (decision 81) is waiting on your research team.

**Build defaults applied (t67) — none of these blocks building; Colton can change any of them later:**
- **Q4 (major points) [PROVISIONAL default]:** one paragraph per body section; the student may promote extra ideas into their own paragraphs, cap 3 per section (section 4 as written).
- **Q5 [PROVISIONAL default]:** student moves only; no one-click "try this order".
- **Q6 (second sentence) [PROVISIONAL default]:** keep the outline's second-sentence *note*; the outline stage does **not** start asking for a real second sentence (no change to Stages 1–2 of Colton's numbering).
- **Q16 (hidden-draft disclosure) [PROVISIONAL default]:** yes, tell students in plain words. Add an "About your coach" line in the Drafting help and the privacy page: "To check your paper's structure, your coach builds a private outline of where your ideas could go. You never see it, it's never part of your paper, and it's deleted 30 days after you finish Drafting." **Still needs Colton's confirmation and legal review of the privacy-policy wording** (human step, does not block the build).
- **Q17 (retention) [PROVISIONAL default]:** text deleted 30 days after Drafting completes, 90 days max, immediately on paper/account deletion (daily purge cron).
- **Q18, Q19, Q21, Q22 [PROVISIONAL defaults]:** as written (≤ 2 flags at confidence ≥ 0.7; milestone pop-up not dismissed by outside click; keep **Write as one box**; independence fade after 3 papers).
- **Q20 (stage numbers after Drafting) [PROVISIONAL default]:** no extra stage. Payoff fires at the end of Drafting; the intro revisit opens the revision stage (code route 6, Revise & feedback).
- **Q24 (research validation of rough-intro-first) [PROVISIONAL default]:** build decision 81 as written; revisit if the research team disagrees.
- **Q8–Q11, Q23 [PROVISIONAL defaults]:** as written in the sections they point to.

## Changelog

- **Nov 20, 2026 (t67):** **BUILD-READY.** Colton ordered Drafting built now. Removed DO NOT BUILD YET; added section **0A** (the eight required behaviors: hidden-draft scaffold, teach-then-draft for every section incl. the conclusion, zoom-in/zoom-out screen states with an explicit state machine, example language not templates, rough intro first/revisit in revision, strict in-order sequencing enforced server-side, background ghost skeleton, milestone pop-ups with clickable sections) and the feature-flag plan (flags on in production after tests pass). New [PROVISIONAL] details: a one-line shape summary always shows on **I'll give it a shot**; named Drafting screen states. Section 15 gains build defaults for Q4–Q6, Q8–Q11, Q16–Q24; Q16 disclosure wording still needs Colton's OK and legal review.
- **Nov 20, 2026 (t58):** Folded in Colton's t58 decisions. Student-facing name is exactly **Drafting** (internal ids noted). Every section opens with "Where are you at on this? Want to give it a shot, or want me to break it down?" then teach-then-draft (8.1); one sentence at a time with finished sentences moving up (8.2); the conclusion teaches looking back, not just recapping (8.3). Arc fill-in frames replaced by connector example language with an independence fade (section 9; decision 55 superseded; D6 tightened). Intro revisit moved to the revision stage, provisional pending research (5.6). Section 11A rewritten: section-only milestone pop-ups with a background ghost readable on Review all, "Ready for section {n}?" / "Do you want to review?", peeks off by default, strict in-order drafting with jump-and-return, the big payoff at the end of Drafting (outline stage keeps a light line), and hidden-draft read-back shaping as the full-paper answer key. Decision statuses updated (DECIDED / LOCKED / PROVISIONAL); new decisions 73–81. Open questions: 8 resolved, 6 new (Q20–Q24). Tests 22–28.
- **Nov 20, 2026 (t57):** Added the interaction design layer and hidden-draft scaffold as they apply to the draft stage (section 11A; pipeline spec in stage specs 2C, decisions 61–72 there): paragraph frames, ghost, peek after each paragraph, full zoom-out per section, draft payoff, jump-to-edit, read-back shaping limited to reordering/flagging the student's own ideas. Added draftGuard **D9** (hidden-draft leak check), events, tests 18–21 and open questions 12–19. Governing doc now v1.6. All [PROVISIONAL].
- **Nov 20, 2026 (t56):** Created this standalone spec from stage specs section 5B (t53 first draft), named **Stage 3 (draft stage)** per Colton with a mapping note to the code's Stage 5 route. Restated Colton's flow step by step (section 2): locked ledger → framework → intro first (teach formats, read back, student drafts the first summary) → one paragraph per major point → opening summarizes the assignment and explains rubric intro requirements → rough is fine → tightening (flow, reorder) with generic arc language including his "we started here, we went to here" frame → student writes first. Answered Colton's question: the intro teach-then-draft loop applies to **every** paper type, with four [PROVISIONAL] intro variants (thesis / story / reflective / case), a variant-specific first-summary prompt, format bank, checklist and arc default, routed by a new `papers.paper_genre` (fallback from `prompt_type`). Decisions 48–59 moved here from stage specs section 0; decision 60 added. Guard rule D4 adds thesis/so-what rewrite cues; tests add the per-type variant set. Build prompt build item **S3-t56** (pending Colton's review).
- **Nov 20, 2026 (t53):** First draft written as stage specs section 5B.
