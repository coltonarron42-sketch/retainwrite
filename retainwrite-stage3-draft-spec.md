# RetainWrite — Stage 3 Draft Spec (the drafting muscle) — FIRST DRAFT FOR COLTON'S REVIEW

Companion to `retainwrite-cursor-build-prompt.md` (build item **S3-t56**) and `retainwrite-stage-specs.md`. **Status: first draft, Nov 20, 2026 (t53 → t56). Everything in this doc is [PROVISIONAL] until Colton reviews it and answers the open questions (section 15).** Cursor must not build it until then. When approved, it ships behind the code constant `FEATURES.draftingMuscle = false` (`lib/config.ts`; not an env var, so the env var list is unchanged), and until then the classic draft flow in stage specs 5.1–5.3 stays the shipping behavior.

**Governing document:** `retainwrite-coaching-philosophy.md` (v1.5, Nov 20, 2026) governs everything here, especially section 3 (hard limits) and section 4 (draft-stage feedback: "Here are the three ideas we captured… Write those ideas in your own words… The outline is the map; the student's voice is the road."). It wins over this doc on philosophy. This doc wins on drafting-stage implementation. Stage specs win on everything else (Stages 2–4 loop, section 7 mismatch, paste policy 5.2).

**Naming: "Stage 3" = the drafting stage.** Colton calls this **Stage 3 (draft stage)**, and this doc uses his name. In the code's six-stage map (intake, stance interview, outline, sources and audio beats, draft, revise and feedback), it is the **draft stage, route `/app/papers/[paperId]/stage/5`**. Colton's count groups the research loop (code Stages 2–4) as his "Stage 2," which makes drafting his third. Routes, `stage_progress` rows and gates keep their six-stage numbers; whether to relabel the student-facing stage names is open question Q1.

LOCKED RULES (restated, because drafting is where they're most at risk): **coaching only. The app NEVER writes submission text** — no paragraphs, no thesis, no intro sentence, no topic sentence, no rewrites, no "you could say…". **The student writes first, every time; the coach teaches structure around what the student wrote.** Nothing is framed around AI detectors. Voice feedback uses only the gentle t48 voice nudge (stage specs section 7). Paste is allowed in every editor, with the t46 once-per-session supportive note (stage specs 5.2) and the t51 hybrid voice-note rules (stage specs 2B.10; drafting text never counts toward `naturalWords`). Add `// SOP: coaching only, never generate submission text` at every AI call site.

---

## 0. Decisions in this doc (all [PROVISIONAL]; numbered after stage-specs decision 47; moved here from stage specs section 0 in t56)

48. **Drafting muscle is a first draft for Colton's review.** Colton's "Stage 3 draft stage" is the code's draft stage (Stage 5 route); numbering is unchanged pending Q1. It layers on stage specs 5.1–5.3 behind `FEATURES.draftingMuscle = false` and isn't built until Colton approves. Section 1.
49. **Locked ledger handoff.** Entering the draft stage snapshots a read-only `draft_ledgers` version from saved data only: lesson, story angle, thesis, and per-section big ideas in the student's words (leader, style, key points, teach aspect, memory card, verified excerpts), plus the skeleton (topic sentence = the outline `claim`; second sentence = the second sentence-plan row). It changes only through the existing outline/section reopen routes, which create a new version and softly flag the affected paragraphs. The student never re-explains. Section 3.
50. **One paragraph per major point.** Each body section's claim is one major point and one paragraph by default; the student can promote other ideas to their own paragraph (max 3 per section); the section minimum splits across paragraphs (floor 50 words). Section 4.
51. **Per-paragraph loop: TEACH → RE-READ → STUDENT DRAFTS → CHECK → STRUCTURE FEEDBACK → TIGHTEN/REORDER → STUDENT REVISES → SAVE.** The student always writes first; no feedback, tighten list or arc frame appears before they've written the paragraph minimum. The 5.3 hard rules apply per paragraph. Section 8.
52. **Intro first, teach-then-draft.** The intro is built first: a brief intro-format lesson (scripted, structure only), the captured ideas read back, then the student drafts their own first summary of the assignment (or thesis) as the intro's starting point. Every opening summarizes the assignment (Colton's rule). A rough intro is fine. A one-time "revisit your intro" prompt follows the last body paragraph. Section 5.
53. **Rubric intro requirements explained.** Every rubric criterion the intro (or a paragraph) must meet shows the teacher's words verbatim, a ≤ 30-word plain-words explanation of the job, and a self-check question. Section 7.
54. **Tighten and reorder are questions and checklists.** They point at sentence numbers and the student's exact words; the student makes every change (sentence drag in a Reorder view; no one-click apply). Section 9.
55. **Generic arc language is scripted and topic-free.** Bracket-slot arc frames from `lib/coaching/arcFrames.ts`, including Colton's "We started here, we went to here, then we went to here." The model may only pick an id; frames use allow-listed words only, have no copy button, and are never exported. Section 9.
56. **Drafting guard (`lib/ai/draftGuard.ts`).** Rejects any draft-stage coach output that could be pasted into the paper (rules D1–D8). Retry once, then scripted fallback. Nightly eval bar: 0 leaks. Section 10.
57. **Stalls reuse existing muscles.** Lesson sections reuse TEACH / teach-then-ask; memory sections reuse MIRROR and the t52 gentle triggers; plus **Say it out loud**; after 2 nudges, flag for help. "Write it for me" gets a fixed, kind decline. Never a sentence written for the student. Section 11.
58. **Paste and voice in drafting are unchanged.** Paste is allowed in every paragraph editor; the 5.2 supportive note shows at most once per session per paper (shared key); per-paragraph paste metadata rolls into `drafts.section_paste_meta`; drafting text never changes `naturalWords`; the t48 voice nudge is the only voice feedback. Section 11.
59. **Data and events.** Spec-only migration `0010_drafting_muscle.sql` (`draft_ledgers`, `draft_paragraphs`, plus `papers.paper_genre`; 0009 stays reserved for the section-loop fallback). Section text is derived from paragraphs, so 5.3, `drafts` v1 and section 7 are unchanged. New `draft_*` / `paragraph_*` / `intro_*` events (counts and ids only). Sections 12–13.
60. **(t56) The intro teach-then-draft loop applies to every paper type; only the intro's landing line changes.** Same loop shape everywhere (teach formats → read back → student drafts → rough is fine → tighten with arc language). Four intro variants, chosen from the paper type: **thesis intro** (argumentative, expository, research, literary/rhetorical analysis, critique, compare-contrast, cause-effect) lands on a thesis; **story intro** (narrative, personal-experience, admissions) opens with a hook or scene and lands on a "so what" line about what the story will show, not a thesis; **reflective intro** opens with context and lands on the insight; **case intro** opens with the situation and lands on the question the analysis answers. The student can switch variants; their pick wins. Section 6.

---

## 1. Scope and where it sits

- **Inputs:** every roadmap section confirmed in the research loop (code Stage 4 complete; gate unchanged), the approved outline (code Stage 3), verified source cards and excerpts (code Stage 4), THE LESSON and prompt type (Stage 1 / stage specs 2B.1–2B.2).
- **Output:** the student's own draft. Section text = its paragraphs joined by blank lines (no generated connective text). On completion, `drafts` version 1 is assembled exactly as in stage specs 5.3, then revision (code Stage 6) opens.
- **What it changes vs. stage specs 5.1–5.3:**

| Classic draft stage (5.1–5.3) | Stage 3 draft muscle (this doc) |
|---|---|
| One textarea per outline section | One editor per **paragraph**; each major point gets its own paragraph (section 4) |
| Draft feedback read-back per section | Same read-back, built from a **locked ledger** and repeated on every paragraph (sections 3, 8) |
| Intro is just the first section | **Intro first**: intro-format lesson, ideas read back, student drafts the first summary, rubric intro requirements explained; per-type intro variants (sections 5–7) |
| Feedback on section submit | Feedback per paragraph, then **tightening** (flow, reorder) with scripted generic arc language (sections 8–9) |
| Shared guard | Adds the drafting guard (section 10) |

Kept unchanged: 5.1 coaching timing (no keystroke coaching; Ask the coach max 3 per section, questions only), 5.2 paste policy, 5.3 topic-sentence-first and minimum-length hard rules, section 7 voice nudge, Stage 5 completion (every section done, draft ≥ 300 words).

---

## 2. Colton's flow, step by step (t56)

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
| 10 | Then offer tightening: make it flow, switch points around, with generic example language like "we started here, we went to here, we went to here." | Tighten checklist, reorder questions by sentence number, and a scripted, topic-free arc frame. | 9 |
| 11 | Student writes first, coach teaches structure around what they wrote. | Enforced by UI order (section 8) and the drafting guard (section 10). | 8, 10 |

---

## 3. Handoff: the locked ledger (read-only input)

When the draft stage opens, the server builds one **draft ledger** snapshot in code (no model call) and locks it. The student never re-explains anything (stage-specs decision 26). The ledger is read-only here.

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

### 5.6 Intro revisit
After the last body paragraph is saved and before the conclusion, the coach asks once: "Now that your body paragraphs are written, want to take one more look at your intro so it matches where the paper went?" (**Take a look** reopens the intro in tightening / **It's good**). Q3 asks whether Colton would rather write the intro last.

---

## 6. Intro variants by paper type (t56, [PROVISIONAL])

**Colton's question: does the intro teach-then-draft loop apply to every paper type, or only ones with a clear thesis?**

**Answer: every type.** The loop shape is the same for all papers: teach a few opening formats → read the captured ideas back → the student drafts the first summary → a rough intro is fine → tighten with generic arc language. Not every paper has a thesis, so what changes per type is the **opening move** and the **landing line** (what the intro ends on), plus the matching checklist and default arc frame. Forcing a thesis onto a personal story, a reflection or a case would teach the wrong lesson (stage-specs 2B.1, lesson-first). This reuses existing muscles: teach-then-ask for the formats (M2), memory-forward for story openings (M5), lesson-first for what the opening must explain (M1). The only new piece is the variant table itself, marked [PROVISIONAL].

### 6.1 Which variant (routing)
- **`papers.paper_genre`** [PROVISIONAL, new column in 0010]: one of the 13 types in `retainwrite-prompt-type-taxonomy-brief.md` (`narrative`, `personal_experience`, `reflective`, `admissions`, `expository`, `argumentative`, `compare_contrast`, `cause_effect`, `literary_analysis`, `rhetorical_analysis`, `research`, `case_study`, `critique`) or `unknown`. Set in Stage 1 by the brief's routing rules (rubric first, then the prompt verb; the brief's decision order), with the student able to change it. Until that classifier ships, it's derived from Stage 2's `prompt_type`: `personal_experience` → `personal_experience`; `lesson` → `unknown`; `mixed` → the intro section's `mode` (`memory` → `personal_experience`, else `unknown`).
- **`unknown` → thesis intro**, matching the brief's fallback (expository is the most common type at every level).
- **Hybrids:** the primary type picks the variant (brief's tie-breaker).
- The variant shows as a small line above the format card, **"Opening style: thesis intro · Change"**. The student's pick wins (`draft_paragraphs.intro_variant_source = 'student'`).

### 6.2 The four variants

| Variant | Paper types | Opening move | Landing line (what the intro ends on) | Default format | Default arc |
|---|---|---|---|---|---|
| **Thesis intro** | argumentative, expository, research, literary analysis, rhetorical analysis, critique, compare-contrast, cause-effect, unknown | Say what the paper explores and why, and explain the key terms the rubric needs | **The thesis** (main point / claim / interpretation / verdict / insight from the comparison / causal claim) | `assignment_forward` | `start_go_land` |
| **Story intro** | narrative, personal-experience, admissions | A hook or a short scene from the real moment | **A "so what" line:** what the story will show or what it meant, **not a thesis** | `scene` | `before_during_after` |
| **Reflective intro** | reflective | Context: what the experience or task was, where and when (plus the course framework if the rubric names one) | **The insight:** what you learned or how your thinking changed | `context_insight` | `what_sowhat_nowwhat` |
| **Case intro** | case study | The situation: who, what, and the problem or decision | **The question** the analysis answers (plus a one-line preview of the recommendation only if the rubric asks for it up front) | `situation_question` | `problem_analysis_recommend` |

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

Every paragraph (intro, body, counter, conclusion) runs the same loop. Steps 1–3 come before the student types; steps 4–8 respond to what they wrote.

1. **TEACH (short).** Intro: the format card (section 5.1). Others: one scripted structure-tip card (`lib/coaching/paragraphShapes.ts`): body = "Point → proof → explain → link back"; counter = "Fair version of the other side → your response → why yours holds"; conclusion = "Where you started → what you showed → why it matters now"; memory-mode body = "The moment → the detail → what it meant"; reflective body = "What happened → what it meant → what you'll do differently"; case body = "Fact from the case → framework → what it tells you". Plus rubric rows (section 7). Collapsible; **I know this** skips.
2. **RE-READ the ledger** (philosophy section 4): "Here are the {n} ideas we captured for this paragraph based on what you told me. We chose {leader}, we chose {style}. Idea one: … Write those ideas in your own words." Plus the topic sentence (the student's own `claim`), the second-sentence plan row, linked excerpts, and transition suggestions (relationship label + bank connectives only, 5.3).
3. **STUDENT DRAFTS.** Topic sentence first (5.3 step 1, unchanged; for the intro, the first summary from 5.3 above), then the paragraph. Autosave every 5 s (no AI call). Live word count. **Ask the coach** stays available on request (5.1 limits).
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
  arcFrameId: z.enum(ARC_FRAME_IDS).nullable(),            // id from the scripted bank; never free text
});
```
Rule-based fallback on timeout/error: sentence count and length, ledger coverage by content-stem overlap, thesis/landing-line overlap for the intro, repeated words, and scripted questions. Logged `ai_fallback`.

---

## 9. Tightening: flow, reorder, and generic arc language

**When:** after the first check on a rough version (Colton: "even if it doesn't flow perfectly, now you have an introduction; then offer tightening").

**Flow and tighten checklist** (computed in code first; the model adds questions only):
- "Sentence {n} is {w} words. Your sentences usually run about {avg}. Is there a natural place to split it?" (uses the voice baseline average when one exists).
- "'{word}' shows up {k} times. Is each one doing work?" (word quoted verbatim from the student).
- "Does sentence {n} lead into sentence {n+1}, or is there a jump? A connecting word might help." (plus the 5.3 connective bank: relationship label + words only).
- "Which sentence tells the reader what this paragraph is about? Is it first?"
- Filler/hedge list (scripted): "very", "really", "in today's society", "throughout history", "it is important to note" → "Do you need '{phrase}' here?"

**Reorder ("switch points around"):** sentence numbers only, as a question: "What if sentence 3 came before sentence 2? Read it both ways and see which feels clearer." At the paper level: "Your second key point builds on your third. Want to switch those paragraphs?" (paragraph numbers only). The student moves things themselves in a **Reorder view** (drag handles or ▲/▼ on whole sentences or paragraphs, byte-identical text). No one-click "apply the coach's order" (Q5).

**Generic arc language (scripted, topic-free).** To show what a clear arc sounds like, the coach can show one **arc frame** from `lib/coaching/arcFrames.ts`. Frames are **never model-generated**; the model may only pick an id. Every frame has bracketed slots and no topic words, so it can't be pasted in as content:

| id | Arc | Frame shown (exact copy) |
|---|---|---|
| `start_go_land` | Colton's arc: started here → went here → went here | "We started with [where you began]. Then we went to [your next point]. Then we went to [where you ended up]." |
| `before_during_after` | Before → during → after (story) | "Before, [how things were]. Then [the moment]. After that, [what changed]." |
| `claim_proof_meaning` | Point → proof → meaning | "[Your point]. [What shows it]. [Why that matters for your main point]." |
| `broad_narrow_point` | Big picture → your topic → your point (funnel) | "[The big picture]. Within that, [your topic]. This paper argues [your main point]." |
| `question_answer` | Question → answer → roadmap | "[The question your paper asks]? [Your answer]. First [point one], then [point two], and finally [point three]." |
| `other_side_response` | Other side → response → why yours holds | "Some say [the other view]. But [your response]. That holds because [your reason]." |
| `what_sowhat_nowwhat` | What → so what → now what (reflective) | "[What happened]. [Why it mattered to you]. [What you'll do with it now]." |
| `problem_analysis_recommend` | Problem → analysis → recommendation (case) | "[The problem]. [What the framework shows]. [What should happen next]." |

- Heading **"The shape, not the words"**, with: "This shows the path a paragraph can take. Fill it with your own ideas and your own words, or ignore it."
- Slots render as visible empty chips; no copy button, `user-select: none`, never exported.
- Next to the frame, a second column lists **the student's own sentences in their current order** ("Your paragraph: 1… 2… 3…"), so they can see where their arc starts, goes and lands. That column is only their text.
- Frames are an allowed exception to the 5.3 "no example sentences" rule because they hold no claims, no topic words and no student content. If Colton prefers arrows-only labels, `ARC_FRAME_STYLE = 'labels'` shows just "Started here → went here → went here" (Q2).

---

## 10. Drafting guard: no pasteable sentences, ever

`lib/ai/draftGuard.ts`, run after the shared `lib/ai/guard.ts` on every draft-stage coach output (Ask the coach answers, `ParagraphFeedback`, rubric explainers, split/merge questions, stall prompts). On failure: retry once with the reason appended; if it fails again, use the rule-based fallback and log `draft_guard_rejected {rule, field}` and `draft_guard_fallback` (no text in `detail`).

**Topic lexicon.** Per paper, built in code: content-word stems (lemmatized, stopwords removed) from the ledger, the student's draft, the assignment card, `lesson.concepts`, chosen leader names, story angle, thesis and verified excerpts. **Generic allow-list:** structural and academic words that are never topic content (`paper`, `paragraph`, `sentence`, `point`, `idea`, `reader`, `intro`, `conclusion`, `evidence`, `source`, `example`, `first`, `next`, `main`, `clear`, `split`, `story`, `moment`, `question`, …; `lib/ai/genericWords.ts`).

**Rules (reject when any fails):**
- **D1. No topic declaratives.** Outside quotation marks, a declarative sentence (subject + verb, ends in "." or "!") may contain no topic-lexicon stem. Topic words may appear only inside questions or verbatim student quotes. **One exception:** a rubric explainer's plain line (section 7) may reuse words from the criterion it explains, addressed to the student as a job ("Your reader should be able to…"), never as a claim about the topic.
- **D2. Verbatim quotes only, and short.** Any quoted span must be an exact substring of the student's current draft or ledger, ≤ 8 words.
- **D3. No new topic content in questions.** A question may use topic words only if they already appear in the student's draft or ledger, and it may not be claim-shaped: after removing the question frame ("Does your paragraph say that…", "Would it help to mention…", "What if you said…"), the remainder may not be a declarative clause ≥ 6 words containing a topic stem.
- **D4. No rewrite cues.** Stage-specs section 2 list plus "something like", "you might write", "try saying", "one way to put it", "your intro could read", "here's a version", "consider phrasing", "reworded", "a stronger sentence would be", "your thesis could be", "your so what could be".
- **D5. Paraphrase check.** No output sentence shares ≥ 3 content stems (any order) with any single student sentence unless it's a verbatim quote.
- **D6. Frames, formats and shapes are code-only.** `arcFrameId`, intro formats and paragraph shapes must be bank ids; any free-text field shaped like a frame (brackets, or "We started with…") is rejected.
- **D7. Field shape.** `praise.note` references its sentence by number and describes what it does (≤ 20 words, no topic stems outside a verbatim quote); `tighten.question` and `questions[]` end with "?"; `reorder.order` is a permutation of the paragraph's sentence numbers.
- **D8. Existing hard limits still apply** (stage-specs section 2): no citations, no "% AI" or detector phrasing, rubric scope, verbatim excerpts.

**Bank checks (CI):** every line in `arcFrames.ts`, `introFormats.ts` and `paragraphShapes.ts` uses only allow-listed words plus slot brackets; every arc frame has ≥ 2 slots; no frame sentence is complete without filling a slot.

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
- **Very short assignments** (< 400 words or a one-paragraph prompt): one paragraph total; the intro lesson collapses to "Open by saying what you're answering"; arc default `claim_proof_meaning`.
- **Wrong intro variant:** the student taps **Change**; checklist and formats switch; their text is untouched.
- **Ledger updated mid-draft:** section 3 banner; the student's text is never changed.
- **AI outage:** scripted banks and code-only checks keep the loop running; "Coach check unavailable — we'll recheck later."
- **Reopening a done paragraph:** allowed; new version; feedback re-runs on **Check again**.

---

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
  arc_frame_ids text[] not null default '{}',
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
- `FEATURES.draftingMuscle` is read at draft-stage entry and stored as `stage_progress.data.draftingMode = 'classic'|'muscle'`; papers already drafting stay classic.

## 13. Session events (counts and ids only; no student prose in `detail`)

`draft_ledger_locked {version, sections, items}`, `draft_ledger_updated {version, changedItems}`, `draft_point_promoted`, `draft_point_folded`, `draft_paragraph_opened {kind}`, `draft_paragraph_reordered`, `intro_variant_set {variant, source}`, `intro_variant_changed {from, to}`, `intro_formats_shown {variant}`, `intro_format_chosen {id}`, `intro_first_summary_written {words}`, `paragraph_shape_shown {id}`, `rubric_term_explained {rubricRef, source}`, `ledger_readback_shown {items}`, `paragraph_check_requested {run}`, `paragraph_feedback_shown {onePoint, coverage}`, `intro_checklist_shown {variant, passed, total}`, `tighten_checklist_shown {items}`, `reorder_suggested`, `reorder_view_opened`, `paragraph_sentences_moved`, `arc_frame_shown {frameId}`, `paragraph_split_offered`, `paragraph_split_accepted`, `paragraph_revised {version}`, `paragraph_saved {words}`, `intro_revisit_prompted {choice}`, `draft_stall_detected {trigger}`, `draft_stall_nudge_shown {kind}`, `draft_write_request_declined`, `draft_guard_rejected {rule, field}`, `draft_guard_fallback`. Reused: `paste`, `paste_suggestion_shown`, `paste_suggestion_dismissed`, `voice_nudge_*`, `coach_asked`, `section_done`, `ai_fallback`, `teach_skipped_known`.

---

## 14. Acceptance tests (Vitest + evals; PROVISIONAL)

1. **Ledger lock:** entering the draft stage creates `draft_ledgers` v1; every `student` item is a verbatim substring of a saved student field and every `source` item of a verified source; `ai` origin is impossible (schema); no edit control for ledger items; an outline edit creates v2 and flags only affected paragraphs without touching their text.
2. **No re-explaining:** read-backs render story angle, thesis, lesson concept, leader, style, key points, topic sentence and second-sentence plan row from saved data; no draft-stage screen asks a question already answered in Stages 1–4 (snapshot test).
3. **Framework:** a 5-key-point leadership paper → intro + 5 body paragraphs + conclusion, in outline order; counter appears only when the rubric requires it; promoting an idea adds a paragraph (cap 3 per section, minimum split, floor 50); folding merges the plan only.
4. **Intro first:** the intro is the only open paragraph at stage entry; the format card shows before the editor; the editor opens empty with the variant's first-summary prompt; no coach output appears before the student has written.
5. **Per-type variants (t56):** argumentative / expository / research / literary analysis / rhetorical analysis / critique / compare-contrast / cause-effect / unknown → thesis intro with a thesis landing check; narrative / personal-experience / admissions → story intro, `scene` default, a so-what check and **no thesis check**; reflective → `context_insight` with an insight check; case study → `situation_question` with a question check; `prompt_type = 'personal_experience'` with no genre → story intro; `lesson` with no genre → thesis intro; the student's **Change** wins and persists; `framework_first` / `framework_case` show only when the rubric names a framework; `fact` hidden with no verified excerpt; admissions ≤ 650 words → intro minimum 40.
6. **Rubric intro requirements:** each intro criterion shows a verbatim teacher quote, a ≤ 30-word plain line and a "?" question; a plain line that states a claim about the topic is rejected; no intro criteria → the "basics" line; model failure → scripted per-type line.
7. **Rough intro is fine:** an intro at the minimum with flow problems can be checked and saved; nothing about flow blocks; tightening opens after the first check.
8. **Student writes first:** no feedback, tighten list or arc frame renders before the paragraph minimum and a check; autosave makes no AI call.
9. **Tightening:** a 41-word sentence with a 14-word baseline average gets the split question; a word used 3× gets the repeat question with the verbatim word; reorder suggestions contain only sentence/paragraph numbers; no "apply order" control; the Reorder view moves whole sentences/paragraphs with byte-identical text.
10. **Arc frames:** only bank ids accepted; `start_go_land` shows Colton's "We started with … Then we went to … Then we went to …" frame with empty slots; every frame has ≥ 2 slots and only allow-listed words (CI); no copy button; not in any export; variant defaults as in 6.2.
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

---

## 15. Open questions for Colton

1. **Numbering:** keep the six code stages (drafting = Stage 5 route) and relabel only the student-facing names so drafting reads "Stage 3" (e.g. 1 Understand, 2 Research, 3 Draft, 4 Revise)? Or keep the six names everywhere?
2. **Arc frames:** OK to show fill-in-the-blank frames with empty slots, including your "We started with… Then we went to…" line? Or arrows-only labels?
3. **Intro timing:** rough intro first plus a one-time revisit after the body, as drafted? Or write the intro last?
4. **Major points:** one paragraph per body section by default, with the student promoting extra ideas (cap 3 per section)? Or should every key point in the ledger (e.g. all five) automatically be its own paragraph?
5. **Reorder:** student moves sentences/paragraphs only, or also a one-click "try this order" that moves their own text without changing words?
6. **Second sentence:** the outline stores a *note* for the second sentence. Should the outline stage ask for an actual second sentence so the skeleton matches your description?
7. **Skipping in drafting:** allow "come back to this paragraph later," or keep drafting strictly in order?
8. **Teacher's words:** OK to show the assignment wording verbatim as a reference while the student writes the first summary in their own words?
9. **Intro variants (t56):** are the four variants (thesis / story / reflective / case) and their type assignments right? Specifically: should admissions statements of purpose use the story intro or the thesis intro, and should compare-contrast always require a thesis?
10. **Genre classifier:** should `paper_genre` (the 13-type taxonomy) be classified in Stage 1 now, or should the draft stage derive the variant from `prompt_type` until the taxonomy routing is approved?
11. **Format bank:** are these the right starter formats per variant, and should any be hidden for younger grades?

---

## Changelog

- **Nov 20, 2026 (t56):** Created this standalone spec from stage specs section 5B (t53 first draft), named **Stage 3 (draft stage)** per Colton with a mapping note to the code's Stage 5 route. Restated Colton's flow step by step (section 2): locked ledger → framework → intro first (teach formats, read back, student drafts the first summary) → one paragraph per major point → opening summarizes the assignment and explains rubric intro requirements → rough is fine → tightening (flow, reorder) with generic arc language including his "we started here, we went to here" frame → student writes first. Answered Colton's question: the intro teach-then-draft loop applies to **every** paper type, with four [PROVISIONAL] intro variants (thesis / story / reflective / case), a variant-specific first-summary prompt, format bank, checklist and arc default, routed by a new `papers.paper_genre` (fallback from `prompt_type`). Decisions 48–59 moved here from stage specs section 0; decision 60 added. Guard rule D4 adds thesis/so-what rewrite cues; tests add the per-type variant set. Build prompt build item **S3-t56** (pending Colton's review).
- **Nov 20, 2026 (t53):** First draft written as stage specs section 5B.
