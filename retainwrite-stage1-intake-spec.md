# RetainWrite — Stage 1 Intake (assignment first)

> **Superseded in part (Colton t219u, Nov 25, 2026; PC-32):** the Stage 1 voice sample is no longer a step, question, minimum, gate, checklist item or note. Voice, tone and language are captured in the background from every answer in every stage. Stage 1 is only assignment capture, the summary and an initial direction. PLAN.md §9 ("Voice capture runs in the background") wins over every voice-minimum / voice-question rule below.

Companion to `retainwrite-cursor-build-prompt.md` and `retainwrite-stage-specs.md`. Paste this into Cursor with those docs. **This doc wins on Stage 1 behavior.** Stages 2–6 and cross-stage rules still follow the stage specs (that doc wins there). Table names, prices, and existing env var names are unchanged except for the additive migration `supabase/migrations/0005_stage1_assignment_first.sql` (0003 is the AI checker, 0004 is access codes). The Nov 20, 2026 revision (read-the-upload-first, no paste gate, single follow-up question, story pick, INTD600 mapping) adds `supabase/migrations/0006_stage1_extract_first.sql` (additive; fold it into 0005 only if 0005 has never been applied in any environment).

**Governing document:** `retainwrite-coaching-philosophy.md` (v1.4, Nov 20, 2026) governs every probe, summary, and interaction. It wins over this doc on philosophy; this doc holds Stage 1 implementation detail. Stage 1 ends with the loop's **DISSECT** step (section 3.4b). **t47:** the parse also extracts **THE LESSON** and the **prompt type** (section 4.6), which DISSECT finalizes and which route every later stage (stage specs section 2B).

**The six-stage structure is unchanged:** intake → stance interview → outline → sources and audio beats → draft → revise and feedback. This doc only changes what happens *inside* Stage 1, before the student clicks **Start stance interview**.

LOCKED RULES (hold everywhere): coaching only (the app never writes submission prose: no paragraphs, no thesis, no rewrites, no fabricated sources or quotes). AI produces questions, probes, checklists, extracted requirements, and research *leads to verify*. The student writes every submitted sentence and chooses every lead. Style metrics are for feedback and voice baselines only. **Paste is allowed in every text input, with no exceptions (Colton, Nov 20, 2026, t44)**; whether an answer was mostly pasted is recorded quietly as metadata and is never shown, warned about, or used to block. **Pasting assignment text is never required:** uploaded files are read automatically, and paste and professor links are optional secondary inputs, never a gate. Every session is logged to `session_events`. Add `// SOP: coaching only, never generate submission text` at every AI call site. Use `lib/ai/guard.ts` on every model output.

Stack (same as the rest of the app): Next.js App Router, TypeScript, Supabase, Grok via the official `openai` SDK (`baseURL: "https://api.x.ai/v1"`, `GROK_API_KEY`). `MODEL_FAST` = `grok-4.3` (`reasoning_effort: "none"`) for live coaching questions and adaptive decisions. `MODEL_STRONG` = `grok-4.7` (`reasoning_effort: "low"`) for assignment parsing, extraction, and Grok vision OCR. Structured output uses `response_format` `json_schema` (`strict: true`), then Zod; if the schema is rejected, retry with `json_object` + Zod. Optional `MISTRAL_OCR_API_KEY` is the first-choice OCR engine for images and scanned PDF pages (do **not** add a second env var named `MISTRAL_API_KEY`). If that key is missing or Mistral fails, fall back to Grok vision on `MODEL_STRONG` via `api.x.ai/v1` with image inputs. Timeouts: 8 s fast, 30 s strong, 60 s per OCR page. On timeout or error, log `ai_fallback` and use the rule-based path; never block the student with a blank page.

---

## 0. Decisions locked in this doc

1. **Assignment first, read automatically.** The student uploads the professor's actual documents (PDF/DOCX/TXT/Word, gallery photos/screenshots, or a device-camera capture) before any coaching question is asked. File upload is the primary path. Every file is read **as soon as it finishes uploading** (native text for typed PDFs/DOCX/TXT; Mistral OCR or Grok vision for photos, screenshots, and scanned pages). **Pasting text is never required when files exist.** Paste and professor URLs are optional secondary inputs, never a gate. If a file can't be read, the student gets a per-file retry/retake message, never a paste demand. Nothing in Stage 1 is inferred silently and used without a student check.
2. **Short confirm checklist (replaces the field-by-field hard gate).** `MODEL_STRONG` extracts a structured `assignment_requirements` JSON (Zod `json_schema`) from a merged, ordered corpus of every uploaded file (plus optional paste and links). Each field has a confidence score and cites the file and page it came from, with a **View source** peek at the snippet. The student sees a short checklist of what was captured (assignment prompt, required format/citation style, page or word count, rubric criteria, required sections/layout, readings and research links, plus course and due date when found), fixes anything that's off, and confirms once. Low-confidence lines are highlighted. Missing fields become **"Not specified,"** never blockers.
3. **Coaching questions are assignment-grounded and adaptive**, one at a time, only after the card is confirmed. The AI never decides the student's sources, stance, or leads.
4. **Get-to-know-you is a short, skippable personalization layer** (3–5 questions, adaptive), run after the card is confirmed and before or woven into the coaching questions. Answers are stored as an `interest_profile` (tags plus the student's own words) and used only to steer research leads toward things the student finds engaging, while still satisfying the assignment.
5. **Suggested people and resources are leads to verify, never citations.** Each lead must show why it connects to the assignment, and — when it came from an interest — why it also connects to that interest. Stage 4 verifies with real sources and drops leads it cannot verify. No unverified quotes, titles, or URLs are presented as fact.
6. **Voice capture is embedded.** Typed answers to get-to-know-you, assignment-grounded, personal, and fallback questions *are* the voice sample (paste allowed, as everywhere; a quiet paste ratio per answer lets the baseline weight typed answers more, see decision 17). Minimum (updated Nov 20, 2026, Colton): ≥ **200** words across the answers given (skipped answers allowed) and at least 2 answers of ≥ 40 words. The personal question is always asked but is no longer separately required. Fallback prompt if short. Metrics reuse the shared `StyleMetrics` helper and the AI checker's `voice_profiles` table (do not fork).
7. **Stage 1 completes** only when the assignment checklist is student-confirmed, the voice minimum is met, a story angle is picked (or written), an early stance (≥ 25 words) is saved, and the student clicks **Start stance interview**. Stage 2 receives the confirmed requirements, the story angle, the early stance, and the accepted research leads.
8. **Interest data is private:** used only to personalize this student's coaching, never shown to other users, and deletable by the student.
9. **One polite follow-up, asked once.** If an important field is missing after extraction (section 3.3a), the coach asks exactly: “Is there any other context or page you want to add so I fully understand the assignment?” The student can add files, text, or links, or say no. Either way the flow continues; nothing is blocked.
10. **Decide the story early (INTD600 Phase 2).** At the end of Stage 1, after the coaching questions, the coach offers 3–4 story angles, phrased as questions grounded in the student's own answers. The student picks one or writes their own. The pick goes to Stage 2 as `storyAngle`.
11. **The owner's INTD600 workflow and coaching principles** (sections 0B and 0C) set the order of work across all six stages. The six stages themselves are unchanged.
12. **(Nov 20, 2026) Stage 1 ends with DISSECT.** After Pick your story and the early stance, the coach builds a section-by-section **roadmap** from the confirmed rubric/prompt only, and the student confirms it (section 3.4b). It's saved as `section_plans` (migration `0008_section_loop.sql`, defined in `retainwrite-stage-specs.md` section 2A). The story angle stays above the roadmap. The per-section TEACH (t47) → PROBE → SEARCH → SUMMARIZE → CONFIRM → LOGIC CHECKPOINT → ADVANCE loop runs in Stages 2–4 (stage specs sections 2A and 2B).
13. **(Nov 20, 2026) Voice capture is conversational, short, and skippable per question.** Every voice question has a **Skip** button. **Colton decided (Nov 20, 2026):** the voice minimum is **200 words total across the answers given; skipped answers are allowed.** The 2 × 40-word rule is **kept** (compatible: two fuller answers are 80 of the 200 words and can come from any questions). The separate personal-question ≥ 40 requirement is **dropped**, because a required question can't also be skippable; the personal question is still asked and re-offered once near the end if skipped.
14. **(Nov 20, 2026, Colton) Research leads: 3–5 at a time, about 20 per paper.** Lead sets are 3–5 (never more than 5); “none appeal” offers 3–5 more or asks for someone specific; after 20 AI-researched leads per paper, the coach hands over a ready-to-paste Google search prompt and researches the names the student brings back, in the same 3–5 pattern, still `to_verify` (section 6.4; stage specs 2A.3).
15. **(Nov 20, 2026, Colton) Section-first loop with skip and browse-ahead.** The roadmap's sections run one at a time through the loop. Later sections can be previewed read-only; a section can be skipped (flagged, with a persistent reminder and a jump-back link). See stage specs section 2A.
16. **(Nov 20, 2026, Colton t41/t42) Logic checkpoint references only.** Stage 1 adds no logic check. The per-section LOGIC CHECKPOINT runs after each section's CONFIRM in Stage 4 and never blocks (stage specs 2A.4a).
17. **(Nov 20, 2026, Colton t43 → t44) Paste is allowed everywhere, including voice-capture answers.** t43 removed paste blocks from every intake field except the voice answers. Colton's t44 then removed that exception, so no text input anywhere in intake blocks or watches paste in a way the student can see, and every paste-blocking attribute or handler comes out (section 0A.1). **Consequence:** the Stage 1 voice sample, which is the baseline for the Stage 6 voice/mismatch comparison, may now include pasted text that isn't the student's natural voice. **Mitigation (non-blocking, invisible):** each answer quietly records how much of it was pasted (`paste_ratio`, `pasted_chars`, `typed_chars`). The voice baseline weights typed answers more heavily, and Stage 6 uses its softer short-sample wording when too little of the sample was typed (section 8.1a). Pasted words still count toward the 200-word minimum. While answering, the student never sees a warning, note, prompt, or lower score because of paste, and nothing is ever blocked. **(t45/t46)** The only visible effect is a kind, factual note at the very bottom of the Stage 6 voice comparison (and of a checker report that uses this baseline) when the baseline is more than 60% pasted (section 8.1a). **t51:** that note now follows Colton's hybrid rule on natural (typed/spoken) words across the paper plus paste share (8.1a).
18. **(Nov 20, 2026, Colton t47) THE LESSON and prompt-type routing start in Stage 1.** The assignment parse also returns `lesson` (what the assignment teaches, why it's assigned, the concepts to learn, a verbatim evidence quote) and `promptType` (`lesson` / `personal_experience` / `mixed`) with a confidence (section 4.6). The checklist shows one extra line, **What this assignment is teaching**, editable like any other line. DISSECT (3.4b) shows the lesson above the roadmap, sets each section's `mode` (`lesson` / `memory`) and `concept`, and lets the student change the prompt type. Saved to `papers.lesson`, `papers.prompt_type`, `section_plans.mode/concept` (stage specs 2B.11; folded into 0008, else 0009). **Personal-experience papers** route Stage 1 memory-forward: coaching questions mirror the prompt's own feeling words and ask for moments, not leaders; no research leads are offered unless the rubric requires sources; story angles are built from the student's moments (stage specs 2B.8). **Lead sets** in Stage 1 follow the t47 rule too: 3–5 ranked by rubric match plus one **Outside the box** wildcard, counted toward the 20-per-paper cap (stage specs 2B.6). The voice minimum stays 200 words across the answers given (Colton's "across skipped answers" read as skips allowed), and the end-of-results note follows the t51 hybrid rule on natural words + paste share (8.1a).
19. **(Nov 20, 2026, Colton t47) Counterargument confirmed.** DISSECT adds a Counterargument & Rebuttal section **only when the rubric/assignment asks for one** (section 16 item 5 resolved; stage specs decision 43).

---

## 0A. Urgent fix — remove the paste gate (ship first)

**Bug:** when a student uploads assignment photos, the live Stage 1 page shows a red message telling them to “paste the prompt text for now.” That is wrong. If the assignment is in the uploaded photos, we read the photos.

Fix, in this order:

1. Delete every client and server validation, state flag, and piece of copy that requires pasted text when files exist (for example `requirePaste`, `pasteRequired`, a `minPasteWords` check, or a `!pasteText` disable condition on the continue button). Pasted text and links are optional inputs only.
2. Wire the real extraction path (section 4.4): each file is read as soon as `finalize` succeeds. Images and scanned pages go to Mistral OCR when `MISTRAL_OCR_API_KEY` is set, otherwise Grok vision on `MODEL_STRONG` (`grok-4.7`) via `https://api.x.ai/v1`. Typed PDFs/DOCX/TXT are parsed directly. Then requirements extraction runs automatically and the checklist appears (section 3.3).
3. If extraction fails on a file, show a **per-file** message with **Retry**, **Retake photo** (images), or **Remove**: “We couldn't read {filename} yet. Try again, or retake the photo in brighter light.” Never a paste demand. Other files keep going.
4. If important fields are still missing, ask the single follow-up question (section 3.3a). Never block.

Acceptance tests (must pass before this ships):

- **(a)** A photos-only upload of a multi-page assignment (no paste, no links) reaches the checklist with the prompt, format, length, rubric, and sections filled from the photos, each citing the right photo/page.
- **(b)** The string `paste the prompt text` (case-insensitive, any punctuation) appears nowhere in the app: source, UI copy, email templates, or fixtures. Add a CI test that fails if it comes back. The test builds the pattern from parts (so it doesn't match itself) and skips these spec docs if they are checked into the repo.
- **(c)** A partial extraction (for example, the rubric page wasn't uploaded) shows the checklist and triggers exactly one follow-up question; answering “No, that's everything” continues with the missing fields marked “Not specified.”

## 0A.1 Urgent fix — remove every paste block (ship first, together with 0A)

**Bug (Colton, Nov 20, 2026):** intake text fields have paste disabled, which stops students from pasting assignment text, prior writing, or their own notes.

**Fix (no exceptions, per Colton t44):** remove every paste-blocking attribute and handler from **every** Stage 1 text input. That covers the assignment paste box, the **Any links your professor gave you?** URL field, the follow-up **Add text** box, checklist field edits, roadmap edits, any optional writing-sample or prior-writing field the live build has, **and** the voice-capture answers (get-to-know-you, coaching, personal, fallback, **I'll write my own** story angle, early stance). Specifically delete:
- `onPaste` / `onDrop` / `onCopy` / `onCut` handlers that call `preventDefault()` or `stopPropagation()`, or that clear the field;
- `onBeforeInput` / `beforeinput` / `input` handlers that reject `inputType` `insertFromPaste`, `insertFromDrop`, `insertFromPasteAsQuotation` or `insertReplacementText`;
- `onKeyDown` traps for Ctrl/Cmd+V, Shift+Insert, or the context menu (`onContextMenu` preventDefault);
- `contenteditable` stand-ins built to swallow paste, invisible overlays, `readOnly` toggled on focus, and `inputmode`/`type` workarounds (e.g. `type="password"`, `autocomplete="off"` tricks) used to stop paste or the iOS paste menu;
- CSS hacks: `user-select: none`, `-webkit-user-select: none`, `-webkit-touch-callout: none`, or `pointer-events` tricks on inputs and textareas;
- any “We need your own typing here” note or toast, and any server check that rejects an answer for being pasted.

Plain controlled `<textarea>` / `<input>` elements, standard browser behavior. Paste stays **optional and secondary** to upload, photo library and camera: always available, never a gate.

**Quiet paste measurement (decision 17), kept separate from blocking:** a shared hook `usePasteMeta()` listens to `paste`, `drop` and `beforeinput` (`insertFromPaste` / `insertFromDrop`) **passively**. It never calls `preventDefault`, never shows UI, and only counts characters inserted by paste/drop versus typing (including autocorrect and dictation, which count as typed). It submits `inputMeta: { pastedChars, typedChars, pasteEvents }` with the answer. Analytics: `intake_answer_pasted` (counts only, no text).

**Acceptance tests (must pass before this ships):**
- **(d)** Pasting into the assignment text box, the URL field, the follow-up Add text box, and every voice-capture answer (interest, coaching, personal, fallback, own story angle, early stance) inserts the text unchanged, on desktop (Cmd/Ctrl+V, context-menu Paste, drag-and-drop) and on mobile (**iOS Safari long-press → Paste**, Android Chrome long-press → Paste), in Playwright plus a manual iOS device check. No warning, note, or toast appears.
- **(e)** A CI grep over `app/` and `components/` finds **no** `preventDefault` inside any `onPaste`, `onDrop`, `onCopy`, `onCut`, `onBeforeInput`, `onContextMenu`, or paste-related `onKeyDown` handler, no `insertFromPaste` rejection, and no `user-select: none` / `-webkit-touch-callout: none` on form fields, **anywhere in intake**. There is no allow-listed exception.
- **(f)** A pasted voice answer saves with `paste_ratio ≈ 1`, counts toward the 200-word minimum, and Stage 1 can complete with a fully pasted sample (no block).

## 0B. The owner's INTD600 workflow → the six stages

The owner's proven workflow from a real graduate paper is the order the app follows. Stages stay exactly as they are; each workflow phase lives inside one or two of them.

| INTD600 phase | Stage | What the app does |
|---|---|---|
| 1. Capture the real assignment first | **Stage 1** (Screens A–C) | Upload → read immediately (OCR / Grok vision / native text) → short checklist the student confirms → one follow-up if something important is missing. No coaching before this. |
| 2. Generate story options and pick early | **End of Stage 1** (Screen D2), carried into Stage 2 | After the interest + coaching questions, the coach offers 3–4 story angles as questions grounded in the student's own words; the student picks one or writes their own. Saved as `storyAngle`, handed to Stage 2. |
| 3. Structured interview for raw material in the student's natural language | **Stage 2** (seeded by Stage 1 answers) | Stage 1 coaching answers plus the Stage 2 stance-interview replies, in the student's own words (paste allowed; the paste ratio is recorded quietly), are the raw material. Probes push for concrete personal detail. The student's own phrases are saved verbatim to a “Your raw material” bank shown in Stages 3 and 5. |
| 4. Sentence-level outline with flagged citations and short source excerpts | **Stage 3** (sentence plan) **+ Stage 4** (excerpts) | Stage 3: each section gets a sentence plan, one row per planned sentence with a student-written **purpose/point note** (not a finished sentence) and a **citation flag** where a source is needed. Stage 4: each flag is linked to a verified source and a short excerpt (≤ 2 sentences, quoted source text). Unverified leads are dropped. |
| 5. Student writes every sentence in their own voice, using the outline only as a map | **Stage 5** | One section at a time; the sentence plan and excerpts sit in the side panel as a map. The student types every sentence. No example sentences, no “write this for me.” |
| 6. Citation integrity with a/b/c suffixes | **Stage 6** (checklist item 4) | Every in-text citation must tie to a specific claim (a flagged sentence), not be piled at the end. Same author + same year in author-date styles (APA, Harvard, Chicago author-date) gets a/b/c suffixes (Smith, 2020a / 2020b) matching the reference list. MLA uses short titles instead. |
| 7. Final assembly and light quality check | **Stage 6** | Assembled draft (from Stage 5), then the revision checklist: thesis, sections, evidence, length, read-aloud pass, and the honesty check. A light check that keeps the student's own voice, not a polish pass. |

## 0C. Coaching principles (encode in prompts, guard, and copy)

1. **The student owns the sentences.** The AI supplies structure (questions, checklists, sentence-plan slots, citation flags) and short verified source excerpts only. It never writes submission prose: no paragraphs, thesis, topic sentences, example sentences, or rewrites. `lib/ai/guard.ts` enforces this on every model output.
2. **Personal detail beats generic summary.** Probes ask for a specific person, place, moment, number, or thing the student saw or did. A generic answer (“it's important for businesses”) gets a dig-deeper probe, not a pass. Story angles and section prompts point back to the student's own details.
3. **Citations are tied to specific claims, not added at the end.** Citation flags are set per sentence in the Stage 3 plan, filled with excerpts in Stage 4, and checked per claim in Stage 6.
4. **Slight imperfection is fine. Keep the student's natural voice.** Coaching never asks the student to smooth their natural phrasing, add fancier vocabulary, or sound “more academic” unless the rubric explicitly requires a register. Fix errors that change meaning or break the rubric; leave the rest. The reason is authenticity: the paper should sound like the person who wrote it. This is about ownership of voice, never about AI detectors. No detector-evasion framing anywhere.
5. **Decide the story early.** The story angle is picked at the end of Stage 1, before the stance interview, so every later stage builds on one chosen direction. The student can change it later (logged), but the default is to commit.
6. **Governing philosophy (Nov 20, 2026).** `retainwrite-coaching-philosophy.md` sits above these principles and wins on philosophy. Its section-by-section loop starts here: DISSECT ends Stage 1 (3.4b); TEACH (t47), PROBE, SEARCH, SUMMARIZE, CONFIRM, the LOGIC CHECKPOINT (Colton's addition, Nov 20, 2026: mandatory after CONFIRM, never blocking; stage specs 2A.4a) and ADVANCE run per section in Stages 2–4 (stage specs section 2A). Stage 1 itself has no logic checkpoint: the roadmap and story angle are checked when each section reaches it.

---

## 1. What changed vs. the old Stage 1

The old Stage 1 was four generic blocks in this order: (1) course / prompt / due date / length / citation style, (2) background survey, (3) topic stance, (4) a separate “write ~150–300 words about anything” voice sample.

| Old block | Now |
|---|---|
| Block 1 Assignment (typed fields, min 15-word prompt) | Upload first, then a parsed **Assignment card** the student must confirm. Structured requirements live in `assignments.requirements`. `papers.course`, `due_date`, `assignment_prompt`, `required_length`, and `citation_style` are synced from the confirmed card. |
| Block 2 Background (generic survey) | Brief, assignment-tied background questions folded into coaching (year, major, comfort with the citation style, prior grades/feedback). Not a standalone survey. |
| Block 3 Topic stance (min 25 words) | An early-take question inside assignment-grounded coaching (still min 25 words). That answer is handed to Stage 2 as `originalThesis`. |
| Block 4 Raw voice sample (150 words, any topic) | No separate “write about anything” block by default. Voice is sampled from intake answers (paste allowed; 200-word floor across answers given; typed answers weighted more in the baseline). A fallback prompt appears only if the sample is still thin. The standalone AI checker keeps its own 150-word, four-question voice check unchanged. |

---

## 2. Flow at a glance

Routes stay under `/app/papers/[paperId]/stage/1`. Shared chrome (left rail, stages 1–6) is unchanged.

1. **Upload** — documents, gallery photos, and/or camera pages first (paste and professor links are optional and secondary, never required).
2. **Read immediately** — each file is extracted as soon as it finishes uploading: native text for typed PDFs/DOCX/TXT; OCR for images and scanned pages (Mistral, else Grok vision); merged into one ordered corpus; then `MODEL_STRONG` extracts the requirements automatically.
3. **Checklist + confirm** — a short checklist of everything captured (prompt, format, length, rubric, sections/layout, readings and links). The student edits anything and confirms once.
4. **One follow-up (only if needed)** — if something important is missing: “Is there any other context or page you want to add so I fully understand the assignment?” Add more or say no; either way, continue.
5. **Get to know you** — 3–5 skippable, adaptive questions about interests. May start immediately after confirm and/or be woven into step 6.
6. **Coaching questions** — one at a time, grounded in the confirmed assignment; research leads steered by the interest profile when present; background and the required personal question included.
7. **Pick your story** — 3–4 story angles, as questions built from the student's own answers; the student picks one or writes their own. Then the early stance on that angle (≥ 25 words).
8. **DISSECT — Your roadmap** — the coach lays out what the paper needs, section by section, from the confirmed rubric/prompt; the student confirms (section 3.4b).
9. **Voice readout + gate** — show the voice summary; **Start stance interview** is enabled only when the gate in section 7 is met.

The student can leave and resume. Progress is saved after every successful API call.

---

## 3. Screen-by-screen flow and microcopy

### 3.1 Screen A — Upload the assignment

This screen is built for the real flow: a student starts from the professor's assignment document, often plus a few source links, and coaching begins only after that anchor is in place. (Motivating example, no course number or personal details: a graduate leadership-course paper began with the professor's assignment document and the source links that came with it; the coach read those first, then asked questions.)

**H1:** Start with the assignment

**Sub:** Upload the document your professor sent — the prompt, rubric, or a photo of a handout. We'll read the requirements, and you'll check them before we ask any questions.

File upload is the **primary** path. Do not present a URL text field as an equal third method. Three input methods sit together as the hero of the screen:

1. **Upload a PDF or document** — `<input type="file" accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" multiple>`. Accept **PDF, DOCX, and TXT**. Reject legacy `.doc` with “Save or export this as a PDF or a .docx and try again.” Reject other types with “That file type isn't supported. Try a PDF, a Word file, a text file, or a photo.”
2. **Choose photos or screenshots** — gallery picker, `accept="image/jpeg,image/png,image/heic,image/heif,image/webp"`. Accept **JPG, PNG, HEIC, WEBP**. Convert HEIC/HEIF to JPEG **server-side** before OCR (do not rely on the browser to decode HEIC). Keep WEBP as WEBP or transcode to JPEG; either is fine if the stored MIME is accurate.
3. **Take a photo** — on a phone, `<input type="file" accept="image/*" capture="environment">` (rear camera). On desktop, open a `getUserMedia` still-capture overlay (`{ video: { facingMode: "environment" } }`); if permission is denied or the API is missing, fall back to the file picker. After each shot, a **crop and rotate** step (90° steps plus free crop, plus auto-rotate suggestion when we detect sideways pages). Then **Add another page** so a multi-page printed syllabus can be captured as an ordered set. Each page is one file in the submission, in capture order, and can be reordered later.

Caps (constants in `lib/config.ts`): max **15** files, **25 MB** each, **100 MB** total. Enforce client-side and again on the signed-upload API.

Desktop: the hero area is also a **drag-and-drop** target for documents and images. Mobile: large tap targets for the three methods; drag-and-drop is optional.

Once files are chosen, show a **thumbnail strip** (document icon for PDF/DOCX/TXT, image thumb for photos). Each item has a name, size, per-file **upload progress**, a **Retry** action on failure, **Remove**, and drag handles (plus up/down buttons) to **reorder**. Reorder changes the corpus order used in parsing. Camera pages are labeled “Page 1, Page 2…” until renamed.

Uploads go to a private Supabase Storage bucket **`assignment-files`** via **resumable** uploads (TUS / Supabase resumable upload) and **signed URLs**. RLS: owner-only (`${user_id}/...`). No public bucket, no public object URLs. The client never receives a service-role key. If a mobile upload is interrupted, reopen the screen, show incomplete items as “Upload paused,” and let the student resume or retry without losing the other files.

**Secondary, below the hero:** a quieter control **Paste the assignment text (optional)**. Opens a textarea (paste allowed, as in every intake field). Max 20,000 words. Use when the student already has the prompt copied, not as the visual equal of upload. **Paste is never required** — not when files exist, not when a file fails, not to continue. No copy anywhere tells the student to paste the prompt.

**Optional, further below, collapsed by default:** **Any links your professor gave you?** A multi-URL field (one URL per line or comma-separated, max 15). Helper: “Optional — syllabi and PDFs often already include these.” We store them as `providedSources` and dedupe with URLs found inside the documents (section 4.5). We may try a public fetch (section 12.7); if it fails, the URL is still kept as a source link. If links are the only input and nothing usable comes back, the checklist opens in its empty state with the follow-up question (section 3.3a) asking for the pages — never a paste demand.

Short rights line + required checkbox, placed above the three methods: “I'm uploading this for my own coursework.” It must be checked before the first upload starts (`upload-url` requires it).

**Extraction starts immediately.** As soon as a file finishes uploading, `finalize` kicks off extraction for that file (section 4.4); the student sees per-file status on the thumbnail (“Reading…”, “Read ✓”, “Couldn't read — Retry / Retake”). When every file is read (or has failed and been skipped), requirements extraction runs and the checklist opens automatically.

Primary CTA (for “I'm done adding pages”): **Read my assignment**. Enabled once the rights box is checked and at least one input exists — a file that is uploaded or still uploading, a paste, or a link. It never requires pasted text. Tapping it while files are still being read just moves to Screen B.

Log `assignment_uploaded` (counts and kinds only, no file bytes).

### 3.2 Screen B — Parsing

Full-width progress, not a blank spinner, driven by parse status (polling or Realtime, section 10). Staged copy as work actually proceeds:

- “Uploading and checking your files…”
- “Extracting the text…”
- “Reading scanned pages…” (only if OCR/vision runs)
- “Collecting links and sources…”
- “Looking for length, citation style, and due date…”
- “Pulling out the rubric and structure…”

Per-file, show a small status: ready / reading page N / needs a clearer photo / failed. If a page fails the quality check (section 4.4), pause that file with “This photo looks blurry or too dark — retake it?” Actions: **Retake**, **Use it anyway**. Do not silently drop the page.

If every OCR path fails for a file: show a per-file message, “We couldn't read {filename} yet. Try again, or retake the photo in brighter light.” Actions: **Retry**, **Retake photo** (images), **Remove**. Log `ocr_failed` (and `ocr_mistral_miss` / `ocr_grok_used` as appropriate) and `extraction_retry_prompted`. **Never ask for a paste.** Other files keep going. If at least one file produced text, continue to the checklist; the follow-up question (3.3a) covers anything missing. If there are fewer than 20 usable words across everything, do not invent requirements: open the checklist in its empty state (“We couldn't read the assignment yet”) with the per-file retry actions and the follow-up question.

Never show “paste the prompt text” or any variant of it, on this screen or anywhere else.

Do not show coaching questions on this screen.

### 3.3 Screen C — Assignment checklist

**H1:** Here's what we found

**Sub:** Check this list. Fix anything that's off, then continue.

A **short checklist**, one line per item, in this order (the full schema in section 4 stays the stored shape; this is just how it's shown):

1. **Assignment prompt** — the question or task (`promptQuestion`, else `topic`), shown as a 1–2 line excerpt with **Show full prompt**
2. **Required format** — citation style (APA, MLA, Chicago, …) plus formatting rules (font, spacing, title page, headings)
3. **Length** — pages and/or words
4. **Rubric criteria** — names (with weights when given)
5. **Required sections or layout** — e.g. abstract, literature review, counterargument, reflection
6. **Readings and research links** — provided readings and links (`providedSources`), deduped
7. **Course and due date** — shown only when found
8. **Other instructions** — collapsed, when present (includes required source counts/types)
9. **What this assignment is teaching** (t47) — `lesson.statement`, one line, with “From {filename}, p. {page}” from `lesson.evidence`; editable (saved as `lesson_source = 'student_edited'`). For personal-experience prompts it reads e.g. “Share three moments from your summer and why they felt magical.” Never blocks; low confidence shows the usual amber state

Line states:

| State | Treatment |
|---|---|
| Captured, confidence ≥ 0.6 | Check mark + short value + “From {filename}, p. {page}” |
| Low confidence (`< 0.6`) | Amber, “Please double-check this one.” |
| Not found | Dashed, “Not found — add it if you know it, or leave it as Not specified.” |
| Student-edited | Quiet “You edited this” mark |

Each captured line cites its provenance in quiet type and has a **View source** control that opens a sheet with that filename, page number, the highlighted snippet, and a page thumbnail when the source is an image or a scanned PDF page. If a value was merged from more than one place, list each citation and let View source page through them. Each line has **Edit** (inline control: text, select, date, or a list editor for rubric / formatting / sections / readings).

Length display rules (section 4.2): if the prompt gives pages and not words, show the page range and the word estimate: “About {min}–{max} words (we count ~275 words per double-spaced page). This is an estimate, not a rule.” If the prompt already gives a word count, show that count and do **not** overwrite it with the estimate. If both are present, show both, with the teacher's word count primary.

**Confirm:** one button, **Looks right — continue**. It's enabled as soon as the checklist is shown (and, if the follow-up in 3.3a was shown, after the student answered it). Confirming marks every line confirmed; lines still not found are saved as “Not specified.” Nothing here requires pasted text.

If the parser found more than one assignment, show the picker (section 12.3) before the checklist.

If the parser flagged a possible AI restriction (section 12.6), show the note on this screen *before* the continue button. The student must pick **Continue anyway** or **I'll check first**. The latter saves progress and leaves Stage 1 `in_progress`.

Primary CTA writes via `POST .../assignment/confirm`. Log `assignment_confirmed` and any `assignment_field_edited` corrections (parsed value vs. confirmed value).

### 3.3a The single follow-up question

**When:** after extraction, if any *important* field is missing (`value` null) or very low confidence (`< 0.4`). Important fields: assignment prompt (`promptQuestion` or `topic`), required format (`citationStyle`), length, rubric criteria, required sections/layout (`structuralRequirements`). Computed in code (`missingImportant(requirements)`), not by the model.

**Copy (exact):** “Is there any other context or page you want to add so I fully understand the assignment?”

Under it, a quiet line listing what's missing in plain words: “I couldn't find: the rubric, the page length.”

Actions:

- **Add a page or file** (opens the same three upload methods), **Add text** (optional paste box), **Add a link**. New input is read immediately and merged into the corpus; requirements re-extract and the checklist refreshes in place.
- **No, that's everything** — continue. Missing fields become “Not specified” on confirm.

Ask it **once per assignment** (`assignments.followup_asked_at`). Do not ask again after the refresh, even if something is still missing. Never block, never repeat, and never phrase it as a demand to paste. Log `followup_shown`, then `followup_added` (with counts and kinds) or `followup_declined`.

If the prompt itself is still missing after the follow-up, coaching starts with a first question that asks, in the student's own words, what the assignment is asking them to do (typed, counts toward the voice sample). That's a coaching question, not a gate.

### 3.4 Screen D — Get to know you, then coaching questions

One question at a time, same conversational panel as later stages. A quiet progress hint: “Question {k} of about {n}” (n is an estimate, not a hard contract).

**H1 (first interest question):** Before we dig into the assignment

**Sub:** A few short questions about you — so the research leads we suggest feel like you, not a generic list. Skip anytime.

**Voice capture feels like a conversation.** Questions are short (≤ 25 words), one at a time, in plain language. Every voice-sample question has a quiet **Skip this one** button (logged `intake_question_skipped`); a small progress line shows how close the student is to the voice minimum in friendly terms (“About 3 more short answers and we've got your voice”), never as a word-count demand. If skips leave the minimum unmet, the personal question is re-offered once near the end, then the fallback (section 8.2).

Persistent text button, always available during interest questions: **Skip — just ask about the paper.** Skipping logs `interest_skipped` and jumps to assignment-grounded coaching. An existing profile can be reused (section 5.3).

**H1 (once coaching starts):** Let's talk about this assignment

Interest and coaching questions share the same input. Answers marked `is_voice_sample` (all interest, coaching, personal, and fallback answers) **accept paste and drop like every other field** (Colton, Nov 20, 2026, t44; section 0A.1). No `preventDefault`, no note. The input only attaches the passive `usePasteMeta()` hook so `paste_ratio` is recorded quietly (decision 17). The same plain input is used for non-voice text fields; there is no voice-specific input behavior the student can see.

Lead cards (section 5.5 and 6.4), when shown after a “I don't know” or a natural opening:

**Heading:** Here are a few leads you might look into — suggestions to research, not citations. You'll verify them later.

Each card: name or story in one line; **why it fits the assignment**; **why it fits your interest** (only if it was interest-steered); badge **To verify**. Actions: **Add as a lead**, **Not this one**. Below the list: **I have someone else** (free-text, becomes a student-added lead, still `to_verify`) and **I don't know yet — give me search terms instead.**

If the assignment requires scholarly or peer-reviewed sources, every personal-interest lead includes this line: “This could be a hook or an example. You'll still need scholarly sources to meet the assignment.”

After the student accepts or declines leads, show an optional one-line rating: “How interesting do these options feel?” on a **1–5** scale, skippable (“Skip this”). Log `lead_interest_rated`. This is for SOP / retention, not a gate.

### 3.4a Screen D2 — Pick your story (INTD600 Phase 2)

Shown after the coaching questions (leads, personal question, background) and before the early-stance question.

**H1:** Pick your story

**Sub:** Here are a few directions your paper could take, built from what you told me. Pick one, or write your own. You can change it later.

`MODEL_STRONG` (`reasoning_effort: "low"`) returns **3–4 story angles** (Zod). Each angle:

- is a **question**, not a claim or thesis (≤ 25 words; must end with “?”), e.g. “What changed when you raised prices at the shop, and what does that say about margin?”
- has a one-line **why it fits** the confirmed assignment (≤ 25 words), naming the requirement it serves
- quotes a short verbatim phrase from the student's own answers when it builds on one (`fromStudentPhrase`, verified as a substring in code; dropped if it doesn't match)
- prefers the student's personal details over generic summary (principle 2)

Actions: **Pick this one** on each card, or **I'll write my own** (textarea, paste allowed, ≥ 15 words, `question_kind: "story_angle"`, counts toward the voice sample). Picking or writing is required to continue (it's the student's choice, never AI's). The student's own angle is never rewritten or “improved.”

Then the early-stance question (section 6.1 item 2) asks about the chosen angle, and then DISSECT (3.4b).

### 3.4b Screen D3 — DISSECT: your roadmap (loop step 1)

**H1:** Here's your playbook

**Sub:** This is what your paper needs, section by section, straight from your assignment. We'll take them one at a time.

**Lesson card (t47), above the sections:** “**What you're learning:** {lesson.statement}” with the concepts as small tags, and one routing line: “This assignment teaches {concept}. Your examples will show it.” (`lesson`), “This looks like a personal-story assignment. We'll help you remember and tell it.” (`personal_experience`), or “This one mixes a concept with your own experience.” (`mixed`), with a **Change** link (three options; the student's pick wins, logged `prompt_type_changed`).

`MODEL_STRONG` (`reasoning_effort: "low"`) builds the roadmap from the **confirmed** assignment requirements only (never from outside material). Section list, in order:

1. If the rubric/prompt names required sections or a layout (`structuralRequirements`, rubric criteria that read as sections), use those, in that order, with the teacher's names.
2. Otherwise, use the default structure from the stage specs (Intro + N body sections by target length + Conclusion). A **Counterargument & Rebuttal** section is included **only when the rubric/assignment asks for one** (confirmed by Colton, t47; section 16, item 5). For personal-experience prompts that name a count (“three things that stood out”), use one body section per item (Intro + Moment 1…N + Conclusion).

Each roadmap section (Zod):

- `title` (the teacher's name for it when given)
- `needs` — what this section has to do, ≤ 25 words, describing the **requirement** (“Explain how two leaders define margin, in APA”), never draft content
- `rubricRefs` — the rubric criteria / prompt requirements it serves (required; ids from the confirmed card)
- `requiredSources` / `requiredStyles` — what the rubric asks for in this section (count, type, named styles/themes/frameworks), if any
- `targetWords` — computed in **code** from the confirmed length (stage-specs rules), not by the model
- `storyLink` — one short question tying the section to the chosen story angle (“Where does your shop story fit here?”)
- `mode` (t47) — `lesson` or `memory`, from `promptType` (mixed: `memory` when `needs` asks for a personal moment); the student can flip it per section
- `concept` (t47) — the lesson concept this section teaches (from `requiredStyles` / `lesson.concepts`; must match one of them), or null (most intros/conclusions and memory sections), which makes TEACH `not_applicable`

Every section card shows “From {file}, p. {page}” provenance for its requirement. The student can rename, reorder (where the assignment doesn't fix the order), merge or split body sections within the length bounds, or add a section of their own (marked “your addition”). The coach never adds a section without a `rubricRef`.

Primary CTA: **This is my roadmap**. Saves `section_plans` rows (`confirmed_at`), logs `roadmap_confirmed` (counts, edits). Nothing here writes draft text.

Fallback if the model fails: build sections in code from `structuralRequirements` (or the default structure), with `needs` copied verbatim from the matching requirement text and `rubricRefs` from the card. Log `ai_fallback`.

Fallback if the model fails or the guard rejects twice: rule-based angles from templates (“What's one moment from your own experience that shows {topic}?”, “Which of your leads would you most like to dig into, and why?”, “What would someone who disagrees with you about {topic} say?”), filled only with verbatim card fields and student phrases. Log `ai_fallback`.

Log `story_options_shown`, then `story_angle_picked` (`{ angleIndex, source: "ai" | "student" }`) or `story_angle_own`.

### 3.5 Screen E — Voice readout and gate

Shown when coaching is done (or the fallback voice prompt, if needed, has been answered).

Readout, same spirit as the AI checker: “Your natural voice: ~{avgSentenceLength} words per sentence, grade-level {readingGrade}, {formality} tone. Your go-to words: {topContentWords}.”

If a recent `voice_profiles` row exists, include the keep/refresh choice from section 8.3 here or at the start of Screen D (see that section).

Primary CTA: **Start stance interview**

Helper: “Next you'll pressure-test your early take. Your assignment details and the leads you picked come with you.”

Helper (updated): “Next you'll pressure-test your early take, then we'll go section by section through your roadmap. Everything you've told us comes with you — you won't have to explain it again.”

Disabled with a specific reason if the gate fails (“Confirm your assignment checklist first,” “We still need a little more writing in your own words,” “Pick a story angle first,” “Add your early take on this topic first,” or “Confirm your roadmap first.”). The complete action is `POST .../intake/complete`.

---

## 4. Assignment requirements schema

Canonical TypeScript / Zod shape (`lib/assignment/schema.ts`). Stored as `assignments.requirements`. `schemaVersion` is `"1.0"`.

```ts
export type FieldSource = "extracted" | "student_edited" | "student_entered" | "missing";

export type Provenance = {
  fileId: string;
  fileName?: string;
  page?: number;               // 1-indexed page in that file
  snippet?: string;            // short verbatim span for View source
};

export type Field<T> = {
  value: T | null;
  confidence: number;          // 0–1; 0 if missing
  source: FieldSource;
  confirmed: boolean;
  rawEvidence?: string;        // short verbatim span from the prompt, if any
  provenance?: Provenance[];   // file + page citations; required when extracted
};

export type LengthValue = {
  pagesMin?: number;
  pagesMax?: number;
  wordsMin?: number;
  wordsMax?: number;
  wordsEstimateMin?: number;   // pages * WORDS_PER_PAGE_DOUBLE_SPACED
  wordsEstimateMax?: number;
  raw?: string;                // e.g. "5–7 pages"
};

export type RequiredSourcesValue = {
  countMin?: number;
  countMax?: number;
  types?: string;              // e.g. "3 leaders who speak about margin"
  scholarlyRequired?: boolean;
  notes?: string;
};

export type RubricCriterion = { name: string; weight?: number; notes?: string };
export type ProvidedSourceOrigin = "manual" | "document_text" | "pdf_annotation" | "extracted_title";

export type ProvidedReading = {
  title?: string;
  url?: string;
  notes?: string;
  origin?: ProvidedSourceOrigin;
  provenance?: Provenance;
};

export type CitationStyle =
  | "APA 7" | "MLA 9" | "Chicago 17 Notes" | "Chicago 17 Author-Date"
  | "Harvard" | "IEEE" | "AMA" | "other";

export type AssignmentRequirements = {
  schemaVersion: "1.0";
  course: Field<string>;
  paperType: Field<string>;        // essay, research paper, literature review, etc.
  topic: Field<string>;
  promptQuestion: Field<string>;   // the actual question, if distinct from topic
  length: Field<LengthValue>;
  citationStyle: Field<CitationStyle>;
  citationStyleOther?: string;
  formattingRules: Field<string[]>;
  requiredSources: Field<RequiredSourcesValue>;
  providedReadings: Field<ProvidedReading[]>;      // alias shown on the card as provided readings and links; same list as providedSources
  providedSources: Field<ProvidedReading[]>;       // merged, deduped URLs + named readings (section 4.5)
  structuralRequirements: Field<string[]>;  // required sections, counterargument, abstract, etc.
  dueDate: Field<string>;          // ISO date or null
  rubricCriteria: Field<RubricCriterion[]>;
  otherInstructions: Field<string>;
  aiPolicy: Field<"unspecified" | "allowed" | "restricted" | "forbidden">;
  language: Field<string>;         // default "English" if undetected
};
```

### 4.1 Parse rules (`MODEL_STRONG`)

- If a field is not in the materials, `value` is `null`, `confidence` is `0`, `source` is `missing`. **Never invent** due dates, page counts, citation styles, rubric weights, or required-source counts.
- `rawEvidence` must be a verbatim substring of the extracted corpus (enforce in code, case-insensitive). Drop it if verification fails. When present, also set `provenance` (file id, 1-indexed page, snippet) so **View source** can open the right page.
- Confidence: 0.85+ when the text states the field clearly; 0.4–0.7 when implied or ambiguous; 0 when absent. Highlight if `confidence < 0.6` or `source === "missing"`.
- If multiple assignments appear in one file or across the corpus, do not pick one silently. Return `parse_meta.candidates` (short labels + evidence + provenance) and show a picker first (section 12.3).
- `aiPolicy` is set only from explicit wording in the prompt (section 12.6). Default `unspecified`.
- Pages-to-words conversion is done in **code**, not by the model.
- Run requirements extraction only after the ordered corpus is built (section 4.4) and `providedSources` are merged (section 4.5). It runs **automatically** once every file is read (or failed and skipped); no button press and no paste required.
- After extraction, compute `missingImportant` in code (section 3.3a) and store it in `parse_meta.missingImportant`. If non-empty and the follow-up hasn't been asked, set `parse_status = "needs_input"` and show the checklist with the follow-up question.
- Structured output: `response_format` `json_schema` (`strict: true`) built from the Zod schema, then Zod-validate; on schema rejection retry with `json_object` + Zod.

### 4.2 Word estimate

Constant: `WORDS_PER_PAGE_DOUBLE_SPACED = 275` in `lib/config.ts`.

- Estimate only when pages are present and an explicit word count is not.
- Ranges use the same min/max (5–7 pages → about 1,375–1,925 words).
- Midpoint of the confirmed word range (or of the estimate if there is no word count) is what Stage 3 uses for body-section N. This matches the existing Stage 3 rule (1 page = 275 words; ranges use the midpoint). Prefer the confirmed card over re-parsing `papers.required_length`.

### 4.3 Confirm rules

The student reviews the checklist and taps **Looks right — continue** once. No field is a blocker. On confirm, every field is set `confirmed: true`; any field still missing is saved as **“Not specified”** — a first-class value stored as `source: "student_entered"` with a null or empty value and `confirmed: true`, so we do not pretend we found something. (`citationStyle: "other"` still requires `citationStyleOther` if the student picks it.)

Server rules for `confirm`: the follow-up question must have been answered if it was shown; the AI-policy choice must be made if flagged; the multiple-assignment picker must be resolved. Nothing else is required. **Pasted text is never required.**

On confirm, sync to `papers`:

- `title` ← topic (or prompt question), if `papers.title` is empty
- `course` ← confirmed course
- `due_date` ← confirmed due date
- `assignment_prompt` ← full concatenated extracted/pasted text (the raw prompt, not a paraphrase)
- `required_length` ← raw length string, or a compact “{min}–{max} words” / “{min}–{max} pages”
- `citation_style` ← confirmed style

### 4.4 Extraction, OCR, and the ordered corpus

**Immediate, per-file extraction.** `finalize` enqueues extraction for that file right away (run it after the response with Next.js `after()` / Vercel `waitUntil`, or a queue). Pages within a file run in parallel (concurrency 4). Typed PDFs/DOCX/TXT are parsed directly; **image files and image-only pages always go through OCR/vision**. Status updates stream to the client through parse-status (section 10). A failure on one file never stops the others.

Build one ordered **assignment corpus** from every item on the submission, in the student's thumbnail order (then paste, then fetched link text if any). Each segment is tagged `{ fileId, fileName, page, text, method, quality }`. This corpus is what `MODEL_STRONG` reads for the Assignment card, and what View source jumps into.

**Native text first**

- **TXT:** read as UTF-8 text (try UTF-8, then latin-1 fallback). Method: `txt`.
- **DOCX:** `mammoth` (or equivalent) to plain text. Method: `docx`. One logical page if the format has no page map; otherwise keep what the library provides.
- **Digital PDF:** extract the text layer **per page**. If a page has ≥ 40 characters of real text (not just page numbers or running headers), use it. Method: `pdf_text`. If a page is empty or nearly empty, treat that page as scanned and send it through OCR.

**OCR / vision for images and scanned PDF pages — fallback order**

For each image file and each scanned PDF page, in this order:

1. **Quality and orientation check** (client preview + server). Score blur, darkness, and resolution (0–1). Auto-rotate using EXIF orientation and a simple rotation detector (0/90/180/270). If quality is below **0.45**, prompt to retake (“This photo looks blurry or too dark — retake it?”) and still allow **Use it anyway**. Store `quality_score` on the file / page. Then **strip EXIF GPS and other location metadata** before the object is stored (or rewrite the stored image without it). HEIC/HEIF is converted to JPEG at this step.
2. **Mistral OCR**, if `MISTRAL_OCR_API_KEY` is set. Method: `ocr_mistral`. Use this key only — do not add `MISTRAL_API_KEY`. Timeout 60 s/page.
3. **Grok vision fallback**, if the Mistral key is missing, the call fails or times out, or Mistral's per-page confidence is below **0.5**. Call `MODEL_STRONG` (`grok-4.7`, `reasoning_effort: "low"`) at `https://api.x.ai/v1` with image inputs (OpenAI-compatible `image_url` or base64 data URL from a short-lived signed URL). Ask only for a **verbatim transcription**, plus `{ rotationDegrees, quality: "good"|"blurry"|"dark"|"partial", handwritten: boolean, confidence }`. Never summarize, never rewrite, never invent text that is not visible. Method: `ocr_grok_vision`. Guard applies. Timeout 60 s/page.
4. **Still unreadable:** mark the page `failed`, show the per-file recovery copy on Screen B (Retry / Retake photo / Remove), and log `ocr_failed`. Never ask for a paste. Do not block other files in the same submission.

**Per-page quality gate.** After transcription, if `confidence < 0.5` or the quality label is `blurry` / `dark`, surface the retake prompt for that page even if some text came back. Keep the text as a best-effort draft the student can check on the card.

**Handwritten pages.** Attempt OCR anyway (step 2 then 3). If `handwritten` is true or the text is clearly fragmentary, show: “This looks handwritten — we'll do our best. Please check the list carefully, and add a clearer photo if we missed anything.” Log `ocr_handwritten`.

Rasterize scanned PDF pages with a server-side renderer (e.g. pdf.js / poppler) at a readable resolution before OCR. Do not send a whole binary PDF to Grok unless the API is documented to accept it; send page images.

### 4.5 Provided sources (links in the files + the optional URL field)

After the corpus is built, collect URLs into `providedSources` / `providedReadings` (one list, two names on the card: “Provided readings and links”):

- URLs in extracted text (plain text, footnotes, bibliographies)
- PDF **link annotations** (URI actions on the page), even when the visible text is a short label
- Named readings in the prompt that have no URL (`origin: "extracted_title"`)
- URLs the student typed in **Any links your professor gave you?** (`origin: "manual"`)

Dedupe case-insensitively on normalized URL (strip trailing slashes, lowercase host). Prefer the richest record (title + URL beats URL-only). Keep `origin` and provenance. Do not invent titles or URLs. These links are materials the professor provided, not Stage 4 research leads.

---

### 4.6 Lesson and prompt type (Colton, Nov 20, 2026, t47)

Extracted in the same `MODEL_STRONG` parse pass as the requirements (or a follow-up call with the merged corpus if the schema would exceed limits), prompt version `lesson_v1`:

```ts
lesson: Lesson;                    // Zod shape in stage specs 2B.1: statement, why, concepts[{term, rubricRef}], examplesServe, evidence{file,page,quote}, emotionalTerms[], confidence
promptType: Field<"lesson" | "personal_experience" | "mixed">;   // with confidence + provenance like other fields
```
- **THE LESSON** answers: what is this assignment trying to teach, why are we writing this paper, what are we trying to learn. It is a learning goal, never a thesis or a sentence the student could submit. Example: “Connect leadership styles to leaders you admire; give three examples” → `statement` “How leadership styles show up in real leaders' choices”, `concepts` [“leadership styles”], `examplesServe` “three admired leaders illustrate the styles”.
- **Prompt type signals:** `personal_experience` for second-person experiential prompts with no named concepts or required sources (“Tell us about your summer vacation, three things that stood out that made it magical”); `mixed` when a concept and a personal experience are both required; else `lesson`. Confidence < 0.6 → `lesson`.
- **Guard:** `evidence.quote` and every `emotionalTerms[]` item must be verbatim substrings of the merged corpus; `statement` must not be a full claim sentence; `concepts[].rubricRef` must exist on the card.
- **Fallback:** model error or two guard rejects → `statement` = the first requirement sentence of the prompt (verbatim), `concepts` = `requiredStyles` + rubric criterion names, `promptType = 'lesson'`, `lesson_source = 'fallback'`. Log `ai_fallback`.
- **Personal-experience effect in Stage 1:** coaching questions (section 6) switch to memory-forward: mirror the prompt's feeling words (“Your prompt says ‘magical.’ What does magical mean to you?”) and ask for moments and details, never leaders. Research leads (6.4) aren't offered unless the rubric requires sources. On a stall, the gentle scripted memory triggers from stage specs 2B.8 may be used, with the same skip and safety rules. Story angles (3.4a) are built from the moments the student mentioned.
- Stored on confirm: `papers.lesson`, `papers.lesson_source`, `papers.prompt_type`, `papers.prompt_type_confidence`, `papers.prompt_type_source`. Log `lesson_extracted`, `prompt_type_classified`, and `lesson_edited` when the student changes the line.

## 5. Get-to-know-you (personalization layer)

After the Assignment card is confirmed, and **before or woven into** the assignment-grounded coaching questions, run a short conversation that learns what this student actually cares about. The point is not small talk. It is to steer research leads toward things they find engaging and authentic, while still meeting the assignment.

### 5.1 Shape

- **3–5 questions**, adaptive, one at a time, **skippable** as a set (and any single question can be passed with “I'd rather not say,” which is not treated as thin).
- Topics to cover, in roughly this order, stopping early if the profile is already rich enough (section 5.4):
  1. What they care about right now, or what they'd rather be doing than writing this paper.
  2. Hobbies, interests, or favorite topics they can talk about without notes.
  3. People, creators, teams, or books they follow or admire (if anything).
  4. A follow-up only when a thread is useful for leads (“You mentioned {verbatim interest}. Anything about it that overlaps with {assignment topic}?”).
- Decided default: start with **two** interest questions immediately after confirm, then weave any remaining interest questions into coaching when a natural opening appears. Never exceed **5** interest questions, probes included.
- These answers are `question_kind: "interest"`, `is_voice_sample: true`, paste allowed (paste ratio recorded quietly), and **count toward the Stage 1 voice minimum**.

Microcopy bank (use verbatim or close paraphrases ≤ 35 words; `{slots}` only from confirmed requirements or the student's own earlier words, verified as substrings):

- “What do you actually care about these days — hobbies, work, people you follow, anything you'd rather be doing?”
- “If you could write about something you already love, and still meet this assignment, what would that something be?”
- “Anyone you follow or admire whose work might touch {topic}? Names you're curious about are enough.”
- “What's a favorite topic you can explain to a friend without looking anything up?”

Do not open with a generic “tell us about yourself” survey. Keep it concrete and short.

### 5.2 Interest profile

Stored in `interest_profiles` (one row per user; see section 9). Shape:

```ts
type InterestProfile = {
  tags: string[];                 // short, normalized phrases drawn from the student's words
  rawAnswers: { questionId: string; question: string; answer: string }[];
  peopleMentioned: string[];      // verbatim names the student typed
  notes?: string;                 // optional coach-safe summary, student's wording preferred
  skipped: boolean;
  updatedAt: string;
};
```

**Tag rules (enforced in code, not only in the prompt):**

- Tags are lowercase phrases taken from the student's text (or a close truncation). Do not add a tag the student did not say.
- Never infer sensitive categories: **health, religion, politics, sexuality**. Do not create those tags, and do not ask follow-ups that fish for them.
- If the student *volunteers* something in a sensitive category **and** it is relevant to the confirmed assignment, you may store their wording in `rawAnswers` and use it for leads on *this paper only*. Still do not promote it to a standing tag, and never infer a related identity or belief.
- People mentioned are stored verbatim. They are not automatically leads.

### 5.3 Reuse

If an `interest_profiles` row exists, was not only a skip, and was updated within **180 days**, offer at the start of Screen D:

> We already know a little about what you care about. Use this, update it, or skip.

Actions: **Use this**, **Update it**, **Skip**. “Use this” proceeds to assignment coaching and still allows later lead steering. “Update it” asks 1–3 follow-ups, not the full set. “Skip” leaves the stored profile untouched and does not use it for this paper's leads (`stage_progress.data.useInterestProfile = false`).

### 5.4 Adaptive stop / dig-deeper

Reuse `lib/coaching/thin.ts` for stock phrases, but “I'd rather not say” / “skip this one” is a valid pass, not a probe.

- **Dig deeper** if the answer is specific (a named hobby, person, or topic) and a single follow-up would clearly improve lead quality.
- **Move on** if you already have at least one concrete tag or named person, or after 2 probes, or at 5 interest questions.
- Enough to steer leads: ≥ 1 specific tag or named person, in the student's words. Do not keep asking once you have that.

### 5.5 How interests steer leads

When generating research leads (section 6.4), `MODEL_FAST` may propose leads that connect **both**:

1. a stated interest (hobby, favorite topic, person they follow), and
2. a confirmed assignment requirement (topic, required source type, scholarly constraint, etc.).

**Illustrative pattern (not a verified fact, do not bake any celebrity–organization pairing into the product or this spec):** a student who loves music and names an artist they admire might be offered a *related* figure, collaborator, or project — if and only if that lead also satisfies the assignment (for example, “cite 3 leaders who speak about margin”). The model may *propose* such a connection as a lead to verify. Stage 4 must verify it with real sources and **drop** it if it cannot. This spec does not assert that any particular person, foundation, or collaboration is real or on-point.

Alongside or instead of generic academic starting points, prefer leads the student is more likely to care about, but never at the expense of the assignment's source rules:

- If the assignment requires scholarly / peer-reviewed sources, an interest-steered lead may be suggested as a **hook or example**, with the on-card note that scholarly support is still required. Also offer at least one scholarly-shaped lead (search terms or source types) in the same set.
- If the assignment already requires a type (“3 leaders who speak about margin”), interest may *rank and color* which leaders or adjacent figures are offered; it does not replace the requirement.
- If no honest connection exists, do not force one. Offer assignment-only leads and, optionally, search terms. Never invent a tie.

Every lead card shows:

- the lead name or story, in one line
- **Why it fits the assignment:** {requirement in the student's or card's wording}
- **Why it fits your interest:** {verbatim tag or name} — omit this line on generic, assignment-only leads
- badge **To verify**

The student picks which leads to pursue. The AI never auto-selects.

### 5.6 Privacy

- Interest data is used **only** to personalize this student's coaching and leads. It is never shown to other users, never used for marketing, and never sent to another student's session.
- Raw answers do not appear in `/admin/sop` (aggregates and event names only; no interest text, tags, or names in admin views).
- The student can delete the profile: a **Delete my interest profile** control in account / privacy settings, and a smaller link on the Screen E recap (“Delete what we saved about your interests”). Deletion clears `interest_profiles` and interest `rawAnswers` stored on the user row; paper-level `intake_answers` remain part of that paper unless the student deletes the paper. Log `interest_profile_deleted` with no payload text.
- System prompts may include tags and short verbatim answers for *this* paper's question/lead generation only. Never include interest data in emails, shareable reports, or the public AI checker.

---

## 6. Assignment-grounded coaching questions

Only after the Assignment card is confirmed. `MODEL_FAST`, one question at a time, knowing when to dig deeper and when to move on.

### 6.1 What must be asked

A typical path is **5–8** questions after interest, **hard cap 12** excluding probes (interest questions have their own cap in 5.1). Always include, unless the student already answered an equivalent in their own words:

1. **Required-source / evidence leads**, when the card has a required source type or count. This is the “3 leaders who speak about margin” slot.
2. **Early stance** (replaces old Block 3), asked right after the story pick (Screen D2): “What's your early take on {chosen story angle}? Why?” **Min 25 words.** Saved as the Stage 2 `originalThesis` snapshot. Probe once if thin: “What's one reason someone might disagree?”
3. **Personal / experiential question (always asked; skippable; re-offered once near the end if skipped):** “In your own words, why does this topic matter to you? If you've got a personal experience or something you've seen at work or in life, tell me that story.” **Min 40 words.** `question_kind: "personal"`.
4. **Brief, assignment-tied background** (not a generic survey), woven in, short answers acceptable (min 8 words when free-text; selects allowed):
   - year / school level (may update `profiles.school_level`)
   - major or program, if it helps
   - comfort with the confirmed citation style (“Have you written in {citationStyle} before? Anything that always trips you up?”)
   - optional: prior grades or teacher feedback on similar papers

If the student already poured a stance into an earlier answer (≥ 25 words, clearly a claim), do not ask the early-take question again; snapshot that answer.

### 6.2 Worked example (margin paper)

Confirmed card (illustrative): 5–7 page APA paper on the value of margin for business owners; cite 3 leaders who speak about margin.

Good first coaching question: “Do you have any leaders in mind who've talked about margin? Who are you curious to look into?”

If the student says they don't know, offer **3–5** example names (never more than 5 at once), each with a one-line why, as **suggestions to research, not citations**. Example shape (these names are starting points the student may accept or reject; still `to_verify`): “Alex Hormozi — writes about pricing and gross margin for business owners.” Optionally add starter resources: search terms (“gross margin thought leaders small business”), types of sources (“a founder interview plus a business book chapter”), or a link to that person's *own* book or talk **only when the URL is known and will be verified in Stage 4**. Never present an unverified quote. If the student also has an interest profile (say they named a musician they follow), a *second* lead in the same set may try the section 5.5 pattern — a related figure or project that also speaks to margin or business leadership — clearly labeled to verify, with both “fits the assignment” and “fits your interest” lines. If that connection cannot be drawn honestly, don't.

The student chooses. Accepted leads go to `research_leads` for Stage 4.

### 6.3 Adaptive rules (coaching)

A `decision` is recorded on each `intake_answers` row: `dig_deeper` | `move_on` | `probe` | `suggestions_offered` | `stuck`.

- **Dig deeper** when the answer is thin (under its min, stock phrase, or repeats the question), when a required-source slot is still empty, when the personal question is under 40 words, or when the early stance is under 25 words.
- **Move on** when the slot is filled with a specific answer, or after **2 probes** (`lib/coaching/thin.ts`), or when the student flags “I'm stuck — flag for help” (save and continue).
- “I don't know” on a source/lead question is not a failure: offer suggestions or search terms (`suggestions_offered`), then move on once the student has picked, added their own, or declined.

- **Personal detail beats generic summary:** treat an answer as thin for dig-deeper purposes when it is generic (no specific person, place, moment, number, or thing the student saw or did) on a question that invites experience. Probe: “Can you give me one specific moment or example — who was there, what happened?” Max 2 probes, as above.

Rule-based fallback if `MODEL_FAST` fails: walk a scripted list derived from the confirmed card (required sources → personal question → citation-style comfort → one “what do you already know about {topic}?” → story pick with template angles → early stance). Log `ai_fallback`.

### 6.4 Research leads — rules that always apply

Applies to both generic and interest-steered leads.

- Offer **3–5** at a time, never more than 5 (Colton, Nov 20, 2026). If none appeal: **Show me 3–5 more** or **I have someone specific to look into**.
- **(t47) Ranked plus one wildcard.** Order the 3–5 by rubric match (including how well each shows the lesson concept), then add exactly one **Outside the box** wildcard below them with a one-line why; it counts toward the per-paper cap, is never preselected, follows the wildcard content rules (never offensive for its own sake; neutral “although controversial” note where relevant; stricter for under-18), and is omitted when no safe one fits (stage specs 2B.6). Personal-experience papers get no leads unless the rubric requires sources.
- **Per-paper cap:** at most `RESEARCH_LEADS_MAX_PER_PAPER = 20` AI-researched leads per paper (Stage 1 and Stage 3 combined; stage specs section 2A.3). At the cap, the coach hands over a ready-to-paste Google search prompt instead (stage specs 2A.3) and invites the student to bring names back. Student-brought names are researched in the same 3–5 card pattern, don't count toward the cap, and are always `to_verify`.
- Mark every suggested person, story, book, talk, or URL `status: "to_verify"`. Never label it a source, citation, or quote.
- Never fabricate citations, quotes, page numbers, publication years, or URLs. If the model is not confident a person or work exists and is on-topic, offer **search terms only**, not a name.
- Suggested items the student accepts or types themselves are handed to **Stage 4** as leads. Stage 4 is responsible for finding real sources. **Stage 4 drops leads it cannot verify** and tells the student that lead was dropped (no silent substitution). Until Stage 4 is built, store the leads and show them in the Stage 4 entry list as “to verify.”
- The student can reject all suggestions and continue.

---

## 7. Gate to Stage 2

`POST /api/papers/[paperId]/intake/complete` succeeds only when all of the following are true. Server-enforced, not just UI.

1. An `assignments` row exists for the paper and `confirmed_at` is set (section 4.3 — no field is required; pasted text is never required).
2. The voice-sample minimum in section 8 is met.
3. A story angle is chosen (`assignments.story_angle` set, from a pick or the student's own).
4. An early stance of ≥ 25 words is stored (dedicated answer or an accepted equivalent).
5. The roadmap is confirmed (`section_plans` rows exist for the paper with `confirmed_at` set; section 3.4b).
6. The student clicked **Start stance interview** (this request).

Then: compute and upsert `style_profiles` for this paper; maybe upsert `voice_profiles` (section 8.3); mark `stage_progress` stage 1 `complete` and stage 2 `in_progress`; set `papers.current_stage = 2`. Log `stage1_completed`.

Stage 2 receives:

- confirmed `assignment_requirements` (and the synced `papers` columns)
- `storyAngle` = the chosen angle (`{ text, source: "ai" | "student" }`)
- `originalThesis` = early stance text
- the confirmed roadmap (`section_plans`), which drives the per-section loop in Stages 2–4
- accepted `research_leads` (including interest-steered ones still `to_verify`)
- `intake_answers` (for cluster classification and slot filling)
- `style_profiles` for later mismatch / revision coaching
- whether an interest profile was used (`useInterestProfile`)

Do not start Stage 2 questioning in Stage 1. The stance interview is still Stage 2.

---

## 8. Voice capture (embedded, compatible with the AI checker)

### 8.1 What counts

The Stage 1 voice sample is the concatenation of `intake_answers` where `is_voice_sample = true`, in order, separated by newlines. That includes get-to-know-you answers, assignment-grounded coaching answers, the personal question, a student-written story angle, and any fallback. It does not include assignment paste, link fetches, or background selects.

### 8.1a Paste ratio and baseline weighting (Colton, Nov 20, 2026, t44; never blocks, never warns)

Paste is allowed in voice answers, so the baseline weights answers by how much was typed. Nothing here is shown to the student or changes the flow.

```sql
-- folded into 0008 (spec-only); if 0008 is already applied, ship as 0009 with the t40/t41 lines
alter table intake_answers add column if not exists pasted_chars int not null default 0;
alter table intake_answers add column if not exists typed_chars int not null default 0;
alter table intake_answers add column if not exists paste_events int not null default 0;
alter table intake_answers add column if not exists paste_ratio numeric(4,3);  -- pasted / (pasted + typed); null = unknown (old rows, no JS)
alter table voice_profiles add column if not exists typed_word_share numeric(4,3); -- share of baseline words that were typed
```

- **Server:** clamp the client's `inputMeta` to the answer length (`pasted_chars ≤ char_length(answer_text)`) and compute `paste_ratio`. Missing meta → `null`, treated as typed. Metadata only, never a gate.
- **Minimum:** all words count toward the 200-word / 2×40 minimum, pasted or not.
- **Baseline weighting (`lib/style/voiceBaseline.ts`):** answer weight `w = 1 − 0.8 × paste_ratio` (typed = 1.0, fully pasted = 0.2). `StyleMetrics` for the baseline are word-weighted averages using `w`; vocabulary sets use typed answers first and add mostly-pasted answers (`paste_ratio ≥ 0.5`) only if typed words are under 150. Store `voice_profiles.typed_word_share`.
- **Typed vs. spoken:** spoken input counts as **typed**. OS keyboard dictation (iOS/Android mic key, macOS/Windows dictation) arrives as ordinary `insertText` / `insertReplacementText`, and any in-app speech-to-text input is recorded as `spokenChars`; both add to `typed_chars`. Only `insertFromPaste`, `insertFromPasteAsQuotation` and `insertFromDrop` count as pasted.
- **Stage 6 effect:** if typed words in the baseline are under 150, the mismatch check uses the existing short-sample downgrade (softer “might” wording, no strong level; stage specs section 7). The comparison chart still shows, unchanged in look.
- **Bottom note (Colton, Nov 20, 2026, t45):** `baselinePastedShare = Σ pasted_chars / Σ (pasted_chars + typed_chars)` over the baseline answers (rows with null meta count as typed). If it is **> 0.60** ("mostly or entirely pasted"), the Stage 6 voice comparison shows, at the very bottom below the chart and tips, in plain muted text with no icon or color alarm, the soft note (t46, checker spec 5.9): “Your voice answers were mostly pasted in, which is totally fine. Typed or spoken answers help us understand your voice better, so treat the voice comparison as a lighter read.” It never interrupts or replaces the comparison, and it is not shown during intake. With no baseline at all, the existing N/A behavior applies and the note is not shown. Log `voice_paste_note_shown {surface:'stage6', pastedShareBucket}`.
- ~~All-pasted note (t47, ≥ 0.95)~~ **Superseded (Colton, Nov 20, 2026, t51): hybrid rule.** The Stage 6 note is chosen from `naturalWords` (typed + spoken words across Stage 1 voice answers **and** the Stage 2–4 conversational answers; pasted excluded) together with `baselinePastedShare`. Tiers [PROVISIONAL]: ≥ 600 → none; 200–599 → `VOICE_NOTE_ANSWERS` only if > 0.60 pasted; 80–199 → lighter-read note (`VOICE_NOTE_ANSWERS`, or `VOICE_NOTE_ANSWERS_SHORT` when ≤ 0.60 pasted); < 80 → `VOICE_NOTE_ANSWERS_LOW`: “Most of your voice came in pasted, or there wasn't much of it, which is totally fine. We couldn't reliably read your voice from it, so treat the voice comparison with lower confidence.” One note at most; same placement and style; never during intake or any writing step. The > 0.60 rule in the bullet above now applies only inside the 200–599 tier. Log `voice_paste_note_shown {surface, tier, naturalWordsBucket, pastedShareBucket}` (stage specs 2B.10; checker spec 5.9).
- **SOP:** `/admin/sop` shows the distribution of `paste_ratio` on voice answers and how often the downgrade applies, so Colton can revisit the policy with data.

Paste and drop are allowed on those textareas, as on every input (section 0A.1). Only the quiet paste ratio is recorded (8.1a).

### 8.2 Minimums

Constants in `lib/config.ts` (do **not** change `MIN_VOICE_SAMPLE_WORDS = 150`; that remains the AI checker's floor):

```ts
export const MIN_VOICE_SAMPLE_WORDS = 150;           // AI checker voice check only
export const STAGE1_VOICE_MIN_WORDS = 200;           // Colton, Nov 20, 2026 (was 250)
export const STAGE1_VOICE_MIN_LONG_ANSWERS = 2;
export const STAGE1_VOICE_MIN_LONG_ANSWER_WORDS = 40;
export const WORDS_PER_PAGE_DOUBLE_SPACED = 275;
```

Stage 1 is met when all are true:

- Sum of voice-sample word counts ≥ `STAGE1_VOICE_MIN_WORDS` (200)
- At least `STAGE1_VOICE_MIN_LONG_ANSWERS` (2) of those answers have ≥ 40 words (any questions)

These are met **across** the answers the student gives (t47: Colton's “200 words total across skipped answers” means across all answers, with skips allowed; it does not mean only skipped answers count). Any question can be skipped, including the personal question (re-offered once near the end); skipping never ends Stage 1 by itself. (Decided by Colton, Nov 20, 2026; see section 16, item 4.)

If the planned questions finish and the sample is still short, show a **fallback** prompt, still assignment-grounded, paste allowed:

> Before we start the stance interview, write a little more in your own words — no editing. Why does this assignment matter to you, or what's a moment when you saw this idea in real life?

Keep the fallback open until the gap is closed (or the keep-baseline exception in 8.3 applies). Log `voice_shortfall` and `voice_fallback_shown`.

### 8.3 Shared baseline (`voice_profiles`) — do not fork

Reuse the AI checker's `voice_profiles` table (created in `0003_ai_checker.sql`) and `lib/style/metrics.ts`. The checker's four questions and 150-word free-write are **unchanged**. Stage 1 must not invent a second metrics system or a second user-level baseline table.

`style_profiles` remains **one per paper** and is what mismatch / Stage 6 compare against.

If a `voice_profiles` row younger than **180 days** exists when Stage 1 reaches Screen D or E, offer:

> We already have a voice baseline from {source, e.g. “your AI checker”} on {date}: ~{n} words per sentence, {formality} tone.

Actions: **Keep this baseline** / **Refresh it with this paper.** Coaching questions still happen either way — they are intake, not just a sample.

- **Keep:** If Stage 1 voice answers are ≥ 150 words and at least one answer is ≥ 40 words, skip the long fallback even if the total is under 200. `style_profiles.raw_sample` = Stage 1 answers if they already meet the full 200 / 2×40 rule; otherwise Stage 1 answers plus `voice_profiles.sample_text`. Set `style_profiles.source = "stage1_answers"` or `"stage1_plus_voice_check"`. Leave `voice_profiles` unchanged. Log `voice_check_reused`.
- **Refresh:** Require the full Stage 1 minimum (200 / 2×40). Upsert `voice_profiles` from this paper's sample (`source = "stage1"`). Log `voice_profile_updated`.

If no profile exists and Stage 1 meets the full minimum, write `voice_profiles` (`source = "stage1"`) so the AI checker can use it later.

This resolves the checker spec's open question about auto-offering “Use my voice check”: **yes, offer it**, with the keep/refresh copy above.

### 8.4 Metrics (shared `StyleMetrics`, additive fields)

Extend `lib/style/metrics.ts` **additively**. Existing mismatch and checker calculations keep using the current fields. New fields are computed deterministically in code (no model call), unit-tested:

```ts
export type StyleMetrics = {
  wordCount: number;
  avgSentenceLength: number;         // mean words / sentences
  sentenceLengthVariance: number;    // population variance of sentence lengths
  readingGrade: number;              // existing Flesch-Kincaid
  formality: "casual" | "neutral" | "formal";
  formalityScore: number;            // 0..1, existing heuristic
  scholarlyRegisterScore: number;    // 0..1, academic register (formal connectors, longer words, low slang); not a detector score
  toneMarkers: string[];             // e.g. "first-person", "hedging", "contractions"
  topContentWords: { word: string; count: number }[];
  vocabulary: string[];
};
```

On Stage 1 complete, persist these on `style_profiles` (new columns in 0005) and inside `voice_profiles.metrics` JSON.

Show the friendly readout on Screen E.

---

## 9. Data model

File: `supabase/migrations/0005_stage1_assignment_first.sql` (additive, after 0004). RLS on every new table: users read/write only their own rows (`auth.uid() = user_id`). Service role unchanged. Do **not** recreate `voice_profiles` (it already exists in 0003); alter it.

```sql
-- 0005_stage1_assignment_first.sql

create type assignment_file_kind as enum ('file', 'paste', 'link');
create type extraction_method as enum ('pdf_text', 'docx', 'txt', 'ocr_mistral', 'ocr_grok_vision', 'paste', 'fetch', 'manual');
create type assignment_upload_status as enum ('pending', 'uploading', 'ready', 'processing', 'failed');
create type assignment_parse_status as enum ('idle', 'extracting', 'ocr', 'merging', 'extracting_requirements', 'ready', 'needs_input', 'failed');
create type intake_question_kind as enum (
  'interest', 'coaching', 'background', 'personal', 'fallback_voice', 'lead_followup'
);

create table assignments (
  id uuid primary key default gen_random_uuid(),
  paper_id uuid not null unique references papers on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  raw_text text not null default '',              -- ordered merged corpus
  requirements jsonb not null default '{}',       -- AssignmentRequirements
  parse_status assignment_parse_status not null default 'idle',
  parse_meta jsonb not null default '{}',         -- model, ocr, language, candidates, timings, provenance index
  field_confirmations jsonb not null default '{}',
  confirmed_at timestamptz,
  ai_policy_ack_at timestamptz,
  files_delete_after timestamptz,                 -- set when the paper is deleted: now + 90 days
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table assignment_files (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references assignments on delete cascade,
  paper_id uuid not null references papers on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  kind assignment_file_kind not null,             -- file | paste | link
  filename text,
  mime text,                                      -- sniffed MIME, not the client-supplied type
  byte_size int,
  storage_path text,                              -- private bucket assignment-files
  url text,                                       -- professor-provided link only; never a public storage URL
  pages int,                                      -- page count (camera shots = 1)
  page_meta jsonb not null default '[]',          -- [{page, method, confidence, quality, handwritten}]
  ocr_method text,                                -- mistral | grok_vision | none
  ocr_confidence numeric,                         -- roll-up 0–1
  quality_score numeric,
  sort_order int not null default 0,              -- corpus order (API field: order)
  content_hash text,                              -- sha256 of stored bytes, for duplicates
  upload_status assignment_upload_status not null default 'pending',
  extracted_text text,
  extraction_method extraction_method,
  ocr_used boolean not null default false,
  exif_stripped boolean not null default false,
  created_at timestamptz not null default now()
);

create table intake_answers (
  id uuid primary key default gen_random_uuid(),
  paper_id uuid not null references papers on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  sequence int not null,
  question_id text not null,
  question_text text not null,
  question_kind intake_question_kind not null,
  answer_text text not null default '',
  word_count int not null default 0,
  is_voice_sample boolean not null default false,
  -- added in 0008 (t44; see section 8.1a): pasted_chars int, typed_chars int, paste_events int, paste_ratio numeric(4,3)
  decision text,                    -- dig_deeper | move_on | probe | suggestions_offered | stuck | skipped
  metadata jsonb not null default '{}',
  started_at timestamptz,
  answered_at timestamptz,
  created_at timestamptz not null default now()
);

create table research_leads (
  id uuid primary key default gen_random_uuid(),
  paper_id uuid not null references papers on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  name text,
  why_assignment text,              -- why it fits the requirement
  why_interest text,                -- why it fits the interest; null for generic leads
  resource_type text,               -- person, book, talk, search_term, source_type, url, story
  url text,
  search_terms text,
  status text not null default 'to_verify',
    -- to_verify | student_accepted | student_rejected | student_added | verified | dropped
  steered_by text not null default 'assignment',  -- assignment | interest | both | student
  source text not null default 'intake_suggestion', -- intake_suggestion | student
  dropped_reason text,
  created_at timestamptz not null default now()
);

-- One per user. Private. Deletable. Do not expose in admin SOP text.
create table interest_profiles (
  user_id uuid primary key references auth.users on delete cascade,
  tags text[] not null default '{}',
  raw_answers jsonb not null default '[]',
  people_mentioned jsonb not null default '[]',
  notes text,
  skipped boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table style_profiles
  add column if not exists sentence_length_variance numeric,
  add column if not exists scholarly_register_score numeric,
  add column if not exists tone_markers jsonb not null default '[]',
  add column if not exists source text;
  -- source: stage1_answers | voice_check | stage1_plus_voice_check

alter table voice_profiles
  add column if not exists source text,     -- ai_checker | stage1 | merged
  add column if not exists word_count int;

create index on intake_answers (paper_id, sequence);
create index on research_leads (paper_id, status);
create index on assignment_files (assignment_id);
```

Also: trigger to keep `assignments.updated_at` fresh. New private Storage bucket **`assignment-files`**, RLS owner-only by user folder `${user_id}/${paper_id}/...`, same pattern as `sources`. **No public policies and no public object URLs**; reads use short-lived signed URLs (preview, View source thumbnails, Grok vision fetch). Generate types into `lib/database.types.ts`.

**Retention:** keep assignment files for the life of the paper plus **90 days**. When a paper is deleted, set `assignments.files_delete_after = now() + interval '90 days'` and leave the objects until a daily cron (`/api/cron/assignment-retention`, Bearer `CRON_SECRET`) purges expired rows and storage objects. The student can delete a file (or all assignment files for a paper) at any time from the upload screen or account/privacy settings; deletion removes the storage object and the row, and re-runs parse if the card was not yet confirmed. Log `assignment_file_deleted` with ids only. Add a note on the upload screen: “We keep these files while this paper is on your account, and for 90 days after it's deleted. You can remove a file anytime.”

`stage_progress.data` for stage 1 (Zod-validated) may store UI state (`useInterestProfile`, `voiceChoice`, current question id). The source of truth for answers, files, requirements, leads, and interests is the tables above.

`research_leads.status` values `verified` and `dropped` are written in Stage 4, not Stage 1.

**Nov 20, 2026 additions — `supabase/migrations/0006_stage1_extract_first.sql`** (additive, after 0005; if 0005 has never been applied in any environment, these may be folded into it instead):

```sql
-- 0006_stage1_extract_first.sql
alter type intake_question_kind add value if not exists 'story_angle';

alter table assignments
  add column if not exists followup_asked_at timestamptz,
  add column if not exists followup_response text,          -- added | declined
  add column if not exists story_options jsonb not null default '[]',
    -- [{ text, whyFits, fromStudentPhrase?, source: 'ai'|'template' }]
  add column if not exists story_angle jsonb;              -- { text, source: 'ai'|'student', optionIndex?, pickedAt }

alter table assignment_files
  add column if not exists extraction_status text not null default 'pending',
    -- pending | extracting | done | failed
  add column if not exists extraction_error text,          -- short enum: unreadable | timeout | encrypted | unsupported
  add column if not exists extraction_attempts int not null default 0;
```

`parse_meta.missingImportant` (string[] of field paths) is stored in the existing JSON column. RLS is unchanged (owner-only on both tables).

---

## 10. API routes

All routes: session required, `assertStageUnlocked(paperId, 1)` (or complete-and-hand-off on `/complete`), Zod-validated bodies, `runtime = 'nodejs'` where files or model calls need it. Never import service-role keys on the client.

### `POST /api/papers/[paperId]/assignment/upload-url`

Creates `assignments` if needed. Body (Zod): `{ filename, mime, byteSize, kind: "file", rightsConfirmed: true }`. Enforces caps (15 files, 25 MB each, 100 MB total), allowlisted types, and the rights checkbox. Inserts a `pending` `assignment_files` row and returns `{ fileId, path, signedUploadUrl, token }` for a **resumable** upload into `assignment-files`. Signed URLs expire in 15 minutes. Never return a public URL or the service-role key.

### `POST /api/papers/[paperId]/assignment/finalize`

Called after a file finishes uploading (or to register paste / links). Body: `{ fileId?, pasteText?, links?: string[] }`. For files: verify the object exists, **MIME-sniff magic bytes** and reject mismatches or non-allowlisted types (executables, HTML, SVG, etc.), convert HEIC/HEIF to JPEG, **strip EXIF GPS**, compute `content_hash`, warn (do not silently drop) if the hash matches a file already on this assignment, set `pages`, `mime`, `byte_size`, `upload_status = "ready"`, `exif_stripped`. For paste: store a `kind='paste'` row. For links: store `kind='link'` rows (normalized URLs). Does **not** have to finish OCR inline: it **immediately** enqueues extraction for that file (section 4.4) and returns quickly. When the last pending file finishes extraction, the server starts requirements extraction (`parse`) automatically. Also accepts `{ fileId, retry: true }` to re-run a failed file (increments `extraction_attempts`).

### `GET /api/papers/[paperId]/assignment/parse-status`

Returns `{ parseStatus, files: [{ id, filename, sortOrder, uploadStatus, extractionStatus, pages, ocrMethod, ocrConfidence, qualityScore, error? }], needsRetake: [{ fileId, page, reason }], missingImportant: string[], followupPending: boolean }`. `error` is a short enum mapped to the per-file retry/retake copy — never to a paste prompt. The client **polls every 2 s** while status is in progress, and **also** subscribes to Supabase Realtime on the `assignments` and `assignment_files` rows for this paper. Either channel is enough to advance Screen B; polling is the fallback if Realtime is unavailable.

### `POST /api/papers/[paperId]/assignment/parse`

Starts (or retries) corpus merge + requirements extraction once files are `ready`. Builds the ordered corpus (section 4.4), merges `providedSources` (section 4.5), calls `MODEL_STRONG` with the parse schema, Zod-validates, verifies `rawEvidence` substrings against the corpus, computes word estimates in code, saves `requirements` + `parse_meta` + `raw_text`. If `parse_meta.candidates.length > 1`, return the picker and do not pretend a single card is confirmed. Returns the Assignment card when `parse_status = "ready"` (clients may also wait on parse-status). Optional public fetch of manual/extracted links uses the section 12.7 rules and must not block the card.

### `POST /api/papers/[paperId]/assignment/followup`

Body: `{ response: "added" | "declined", fileIds?: string[], pasteText?: string, links?: string[] }`. Allowed once per assignment (409 if `followup_asked_at` already has a response). `added`: register the new inputs (same rules as `finalize`), re-run extraction and requirements, refresh the checklist. `declined`: record it; missing fields will be saved as “Not specified” on confirm. Never returns an error that asks for a paste.

### `POST /api/papers/[paperId]/assignment/confirm`

Body: student-edited `AssignmentRequirements` (and optional `selectedCandidateId`, `aiPolicyAck`). Rejects only if section 4.3 is unmet (follow-up unanswered when shown, AI-policy choice missing when flagged, multiple-assignment picker unresolved). Never rejects for missing pasted text or missing fields; missing fields are saved as “Not specified.” Sets `confirmed_at` (and `ai_policy_ack_at` if applicable), syncs `papers` columns. Logs corrections.

### `POST /api/papers/[paperId]/intake/next-question`

Body: `{ answer?: string, skipInterest?: boolean, skipThisQuestion?: boolean, voiceChoice?: "keep" | "refresh", useInterestProfile?: boolean, acceptedLeadIds?: string[], rejectedLeadIds?: string[], addedLead?: {...}, interestRating?: 1|2|3|4|5 }`.

On the first call after confirm, starts get-to-know-you unless skipped or a reusable profile was accepted. Subsequent calls persist the previous answer (`intake_answers`, word count, timings, decision), update `interest_profiles` when an interest question is answered, maybe return lead cards, then return `{ question, kind, minWords, suggestions?, done?, needsFallbackVoice? }`.

Guard every model output. Questions ≤ 35 words. Lead why-lines ≤ 40 words. No paper prose, no quotes attributed to leads, no invented URLs presented as verified.

### `POST /api/papers/[paperId]/intake/story-options`

Generates (or returns cached) 3–4 story angles from the confirmed card, accepted leads, and the student's answers (section 3.4a). `MODEL_STRONG`, guard applies (angles must be questions; no thesis, no claims written for the student). Saves `assignments.story_options`. Rule-based template fallback on failure.

### `POST /api/papers/[paperId]/intake/story-pick`

Body: `{ optionIndex?: number, ownText?: string }` (exactly one). `ownText` accepts paste (sent with `inputMeta`), ≥ 15 words, stored as an `intake_answers` row with `question_kind = "story_angle"` and `is_voice_sample = true`. Saves `assignments.story_angle`. A later change is allowed and logged (`story_angle_changed`).

### `POST /api/papers/[paperId]/intake/roadmap`

Builds (or returns) the DISSECT roadmap from the confirmed requirements (section 3.4b). `MODEL_STRONG`, guard applies; every section must carry `rubricRefs` that exist on the confirmed card (reject otherwise). `targetWords` computed in code.

### `POST /api/papers/[paperId]/intake/roadmap/confirm`

Body: the student-edited section list. Writes `section_plans` (`confirmed_at`, `order`, `source: "rubric" | "default" | "student"`). Logs `roadmap_confirmed` and `roadmap_section_edited`.

### `POST /api/papers/[paperId]/intake/complete`

Enforces the section 7 gate, writes `style_profiles` (and maybe `voice_profiles`), completes Stage 1, unlocks Stage 2. Returns the Stage 2 URL.

---

## 11. Grok system rules

Add `// SOP: coaching only, never generate submission text` at every call site. Run `lib/ai/guard.ts` on the output (same rewrite-phrase and 12-word edited-copy rules as the stage specs). System prompts are cached and must include all of the following.

**Parse (`MODEL_STRONG`, `reasoning_effort: "low"`):**

> You extract assignment requirements from teacher materials. The input is an ordered corpus of files and pages, each labeled with file name and page number. Return only the JSON schema. Quote short evidence spans from the text, verbatim, and cite fileId + page in provenance. If a field is not present, value is null and confidence is 0. Never invent due dates, page counts, citation styles, rubric weights, source counts, or URLs. Never write essay text, theses, or outlines. If more than one assignment appears, list candidates; do not pick one. If the text forbids or restricts AI tools, set aiPolicy and quote the line. Include provided readings and links that appear in the materials or the student's URL list; do not invent links. Image pages and photos are just as authoritative as typed text: read everything provided. Never ask the student to paste text.

**Intake questions and leads (`MODEL_FAST`, `reasoning_effort: "none"`):**

> You are a writing coach. Never write, rewrite, or complete sentences or paragraphs for the student. Never produce a thesis, topic sentence, or paper prose. Never fabricate sources, quotes, titles, page numbers, or URLs. Ask one question at a time, grounded in the confirmed assignment. You may ask short get-to-know-you questions so research leads can reflect the student's stated interests. Do not ask about health, religion, politics, or sexuality, and do not infer them; only use such content if the student volunteered it and it is relevant to this assignment. When suggesting people, stories, or resources, they are leads to verify, not citations. Each lead must say why it fits the assignment, and if it was interest-steered, why it also fits that interest, using the student's words. If the assignment requires scholarly sources, say clearly that an interest lead can be a hook or example and still needs scholarly support. If you are not confident a connection or a work exists, offer search terms instead of a name. The student chooses every lead. Decide dig_deeper or move_on using the rules you were given.

**Vision OCR (`MODEL_STRONG`, image inputs):** transcribe verbatim only (section 4.4 step 3).

**Story angles (`MODEL_STRONG`, `reasoning_effort: "low"`):**

> You help a student pick a direction for their own paper. Offer 3 or 4 story angles as questions, never as claims, theses, or sentences the student could submit. Build each one from the student's own answers and specific details (people, moments, numbers they mentioned), quoting their short phrase verbatim when you use it. Prefer personal, specific angles over generic summaries. Each angle must fit the confirmed assignment; say which requirement it serves in one line. Do not invent facts, sources, or quotes.

**All Stage 1 prompts also carry the coaching principles (section 0C):** the student owns every sentence; ask for personal detail over generic summary; citations belong to specific claims; don't push the student to polish away their natural voice (this is about authenticity of their own voice, never about AI detectors); help them decide the story early.

**DISSECT roadmap (`MODEL_STRONG`, `reasoning_effort: "low"`):**

> You turn a confirmed assignment into a section-by-section roadmap. Use only the confirmed requirements you were given; never add content, sections, or sources the assignment didn't ask for. For each section, say what it must do as a requirement, not as draft text, and list the rubric criteria it serves by id. Do not write sentences the student could submit. Keep each description under 25 words.

**Lesson + prompt type (t47, `MODEL_STRONG`, `reasoning_effort: "low"`):**

> Identify THE LESSON of this assignment: what it is trying to teach, why the student is writing it, and what they should learn. State it as a learning goal (a short phrase), not as a claim, thesis, or sentence the student could submit. List the concepts to learn using the teacher's own words, and say how any requested examples serve the lesson. Quote the exact prompt text your answer rests on. Classify the prompt as lesson, personal_experience, or mixed. For personal-experience prompts, list up to 4 feeling words copied exactly from the prompt. Do not invent requirements.

**Governing philosophy:** every Stage 1 prompt includes the hard limits from `retainwrite-coaching-philosophy.md` section 3 (no student sentences; stay inside the rubric; no decorative citations; no detector promises; no fake clean results; paste never a gate; voice capture short and skippable).

Student data in prompts: send only the fields needed (confirmed card, recent answers, interest tags / short verbatim answers for this user). Never send email or name.

---

## 12. Edge cases

**12.1 No rubric.** The rubric line shows “Not found.” It counts toward the single follow-up question (3.3a); if the student says no, it's saved as “Not specified.” Not required.

**12.2 Vague prompt** (“write a paper about X”). Missing length and citation style trigger the single follow-up question. The student adds what they have or says no; those fields become “Not specified.” Coaching still starts after confirm, more general but still topic-grounded. **(t47)** A vague *personal* prompt (“tell us about your summer vacation…”) is classified `personal_experience` and routed memory-forward (section 4.6; stage specs 2B.8), not treated as a missing-information problem.

**12.3 Multiple assignments in one file or across the upload.** Parser returns `parse_meta.candidates`. Picker: “We found more than one assignment in this file. Which one is this paper for?” plus “It's all one assignment.” Then parse (or filter) the selected part. Never silently pick.

**12.4 Image-only or scanned PDF.** Follow the section 4.4 fallback order (Mistral if `MISTRAL_OCR_API_KEY` is set, otherwise Grok vision). Quality issues go through the retake prompt, not a dead end. The student can always retake or add another photo. A photo-only or scan-only upload is a normal, fully supported path — never a reason to ask for a paste.

**12.5 Non-English materials.** If detected language is not English: “This assignment looks like it's in {language}. Coaching questions and feedback are in English in this version, but you can still upload it and type answers in the assignment's language.” Continue is the student's choice. Parse extracts what it can. Do not block.

**12.6 Teacher forbids or restricts AI.** Trigger on `aiPolicy` of `restricted` or `forbidden`, or on explicit phrases in the extracted text (case-insensitive), including “no AI,” “do not use ChatGPT,” “AI use is prohibited,” “generative AI is not allowed.” Show a note, not a hard block:

> This assignment looks like it may restrict AI tools. RetainWrite is a coach — it doesn't write your paper — but your teacher may still not allow it. You decide whether to continue. If you're unsure, check with your teacher.

Buttons: **Continue anyway** (sets `ai_policy_ack_at`, logs `ai_policy_continued`) or **I'll check first** (saves, leaves Stage 1 in progress, logs `ai_policy_notice_shown`).

**12.7 Link fetch failures.** Public GET only, 8 s timeout, 2 MB cap, follow a small redirect limit, no cookies or student LMS credentials. If the response is a login page or fails, keep the URL as a `providedSources` entry and, if useful, ask the student to upload the document. Never store fetched credentials. A failed fetch must not block the Assignment card.

**12.8 Empty or unreadable mix.** If after all files (and any optional paste or links) the usable text is under 20 words, do not invent requirements. Show the checklist's empty state with per-file **Retry / Retake photo / Remove** and the single follow-up question. Never a paste demand.

**12.9 Blurry or dark photo.** If the quality score is below 0.45, or OCR returns `blurry` / `dark`, prompt to retake and show the score in debug-only logs (not to the student as a raw number unless useful: “This photo looks blurry or too dark”). **Retake** replaces that page in order; **Use it anyway** keeps the best-effort text.

**12.10 Rotated pages.** Auto-rotate on EXIF and detected orientation, then let the student fix remaining issues in the crop/rotate step. Re-run OCR if they change rotation after a first pass.

**12.11 Duplicate uploads.** If `content_hash` matches another file on this assignment, warn: “This looks like a file you already added.” Let them keep both or remove one. Do not silently drop it.

**12.12 Password-protected PDFs.** Detect encryption and stop with “This PDF is password-protected. Export an unlocked copy, or take photos of the pages — we don't ask for the password.” Do not collect or store the PDF password. Log `pdf_encrypted`.

**12.13 Handwritten notes.** Best-effort OCR (section 4.4) plus the handwritten check copy. Never guess missing words into a required field with high confidence; leave those fields low-confidence or missing so the student fills them.

**12.14 Unsupported types.** Reject on the picker and again on finalize (magic-byte sniff). Clear message: “That file type isn't supported. Try a PDF, a Word file, a text file, or a photo.”

**12.15 Upload interrupted on mobile.** Resumable uploads (TUS). On return, show paused items with progress and **Resume** / **Retry**. Other finished files stay, and their extraction keeps running. The interrupted file is extracted as soon as its upload completes; requirements extraction waits until it finishes or the student removes it. Never ask for a paste instead.

**12.16 Security.** Treat every upload as untrusted. MIME-sniff magic bytes and reject type mismatches and non-allowlisted types (including executables, HTML, and SVG). Do not trust the client `Content-Type`. Strip EXIF GPS and location metadata from images before they are stored or sent to a model. No public storage URLs — signed URLs only, short TTL. Do not interpolate extracted text into HTML unsanitized (View source is escaped text plus an image thumbnail). Don't run uploaded files as code. A full antivirus engine is not required on Vercel; the allowlist, sniffing, and private bucket are the v1 control. Log `upload_rejected` with reason enum only.

---

## 13. Session logging (SOP improvement)

Write `session_events` with `stage = 1`. Never put full assignment text, interest raw answers, or voice-sample prose in `detail`. Store counts, ids, timings, field paths, and short enums.

Events:

`lesson_extracted`, `lesson_edited`, `prompt_type_classified`, `prompt_type_changed`, `section_mode_changed`, `lead_wildcard_shown`, `lead_wildcard_picked`, `lead_wildcard_omitted`, `mirror_shown`, `memory_triggers_shown`, `memory_trigger_picked`, `memory_safety_note_shown` (t47), `roadmap_generated`, `roadmap_confirmed`, `roadmap_section_edited`, `intake_question_skipped`, `personal_reoffered`, `assignment_uploaded`, `assignment_file_finalized`, `extraction_started`, `extraction_done`, `extraction_retry_prompted`, `followup_shown`, `followup_added`, `followup_declined`, `story_options_shown`, `story_angle_picked`, `story_angle_own`, `story_angle_changed`, `assignment_file_deleted`, `assignment_parse_started`, `assignment_parsed`, `assignment_field_edited`, `assignment_confirmed`, `ocr_mistral_used`, `ocr_grok_used`, `ocr_failed`, `ocr_handwritten`, `upload_rejected`, `pdf_encrypted`, `retake_prompted`, `ai_policy_notice_shown`, `ai_policy_continued`, `interest_started`, `interest_skipped`, `interest_question_shown`, `interest_answered`, `interest_profile_updated`, `interest_profile_deleted`, `interest_profile_reused`, `intake_question_shown`, `intake_answered`, `intake_dig_deeper`, `intake_move_on`, `suggestions_offered`, `lead_accepted`, `lead_rejected`, `lead_student_added`, `lead_interest_rated`, `voice_shortfall`, `voice_fallback_shown`, `voice_sample_computed`, `voice_check_reused`, `voice_profile_updated`, `stage1_completed`, `ai_fallback`.

`detail` should include, as relevant:

- `time_ms` per step (upload → parse, parse, per question, confirm)
- `fields_corrected`: `{ path, hadExtractedValue: boolean }` (not the text)
- `decision`: dig_deeper vs move_on vs suggestions_offered
- word counts, question_id, question_kind
- lead metrics: `{ leadId, steered_by: "assignment" | "interest" | "both" | "student", accepted: boolean }`
- `interestRating` (1–5) when provided

**Retention / SOP aggregates** (expose on `/admin/sop`, no raw interest text):

- Pickup rate of **interest-steered** leads vs **assignment-only** (generic) leads (`lead_accepted` grouped by `steered_by`)
- Stage 1 completion rate with vs. without an interest profile used
- Later: paper / Stage 5–6 completion joined to whether an interest-steered lead was accepted
- Distribution of self-reported lead interest (1–5)
- Drop-off by Stage 1 screen (upload, parse, checklist, follow-up, interest, coaching, story pick, gate)
- Follow-up rate (how often something important is missing) and which fields, to improve extraction
- Photo-only uploads that reach the checklist without any paste (should be ~100%)

Stage 4 should log `lead_verified` and `lead_dropped` with `steered_by` so SOP can see which personalized leads survive verification. Add those event names when Stage 4 is implemented; they are reserved now.

---

## 14. Constants and tests

In `lib/config.ts`, add the Stage 1 voice and page-to-word constants in section 8.2, plus `ASSIGNMENT_MAX_FILES = 15`, `ASSIGNMENT_MAX_FILE_BYTES = 25 * 1024 * 1024`, and `ASSIGNMENT_MAX_TOTAL_BYTES = 100 * 1024 * 1024`. Keep `MIN_VOICE_SAMPLE_WORDS = 150` for the checker.

Vitest, at minimum:

- Page-to-word estimate (275, ranges, never overwrites an explicit word count)
- Confirm gate (required fields, “Not specified,” unreviewed fields fail)
- Voice-minimum calculator (200 / 2×40 across answers given, skipped answers allowed, and the keep-baseline exception)
- `rawEvidence` and lead-name evidence must be substrings when claimed as extracted
- Interest tag rules: no inferred sensitive tags; volunteered sensitive content is not promoted to standing tags
- Leads default to `to_verify`; interest-steered leads require both why-lines; scholarly-required assignments attach the hook-or-example note
- StyleMetrics additive fields exist and do not break existing mismatch tests
- Stage 2 stays locked until `/intake/complete` succeeds
- Interest profile delete clears the user row
- File caps (15 / 25 MB / 100 MB) enforced on `upload-url`
- MIME sniff rejects mismatched and non-allowlisted types
- EXIF GPS is stripped from a fixture image
- HEIC conversion writes a JPEG (or a documented skip in environments without a HEIC decoder, with a student-facing “we couldn't read this photo — try JPG or PNG”)
- Corpus merge respects `sort_order`; URL dedupe of document + pdf_annotation + manual links
- Quality threshold prompts a retake below 0.45
- OCR fallback: Mistral used when the key is set; Grok vision is used when the key is missing or Mistral fails; a double failure marks the page failed without inventing text
- Password-protected PDF is rejected without asking for the password (copy suggests photos, not paste)
- **No paste gate:** photos-only multi-page fixture reaches the checklist with no paste and no links (section 0A test a)
- Roadmap: every section has `rubricRefs` on the confirmed card; `targetWords` from code; gate fails without a confirmed roadmap; fallback builds sections from `structuralRequirements`
- Skip: every voice question can be skipped; the 200 / 2×40 minimum is computed across answers given; a skipped personal question is re-offered once; no personal-question requirement in the gate
- **Banned string:** repo-wide test fails if `paste the prompt text` appears anywhere in app code, copy, or fixtures (case-insensitive; pattern built from parts; spec docs excluded) (section 0A test b)
- **Single follow-up:** partial extraction shows the follow-up exactly once; `declined` → confirm succeeds with “Not specified” fields; a second follow-up call returns 409 (section 0A test c)
- `missingImportant` computed in code for prompt, format, length, rubric, sections
- Per-file extraction failure returns a retry/retake error enum and doesn't stop other files
- Story angles: guard rejects non-question / thesis-like angles; `fromStudentPhrase` must be a verbatim substring; own-angle ≥ 15 words; gate fails without a story angle

---

## 15. Acceptance criteria

- [ ] Stage 1 starts on the upload screen, with file upload as the primary CTA (PDF/document, gallery photos, and camera). No coaching question appears before the Assignment card is confirmed.
- [ ] The three input methods work as specified: document picker (PDF/DOCX/TXT), gallery (JPG/PNG/HEIC→JPEG/WEBP), and camera (mobile `capture=environment`; desktop getUserMedia with file-picker fallback, crop/rotate, “add another page”).
- [ ] Multiple files per submission (cap 15 / 25 MB / 100 MB), desktop drag-and-drop, thumbnails with reorder/remove, per-file progress and retry, and resumable uploads to the private `assignment-files` bucket (owner-only RLS, signed URLs only).
- [ ] **Paste is never a gate.** Paste and “Any links your professor gave you?” are optional, secondary inputs. A photos-only upload reaches the checklist with no paste. The string “paste the prompt text” appears nowhere in the codebase. A failed file shows a per-file retry/retake message, never a paste demand.
- [ ] Each file is read immediately after upload (native text, Mistral OCR, or Grok vision), and requirements extraction runs automatically when the files are read.
- [ ] If an important field is missing, the single follow-up question appears exactly once with the exact copy; the student can add more or say no and continue.
- [ ] Digital PDFs/DOCX use native text; images and scanned pages use Mistral OCR when `MISTRAL_OCR_API_KEY` is set, otherwise Grok vision; per-page quality checks can prompt a retake. All files merge into one ordered corpus with file and page provenance.
- [ ] URLs inside documents (including PDF link annotations) are extracted into provided sources and deduped with the manual URL field.
- [ ] The Assignment card shows paper type, topic/question, length (with a ~275 words/page estimate when only pages are given), citation style, formatting rules, required sources, provided readings and links, structural requirements, due date, and rubric criteria with weights. Each extracted field cites file and page and offers **View source**. Low-confidence and missing fields are highlighted.
- [ ] The checklist shows prompt, format, length, rubric, sections/layout, and readings/links (plus course/due date when found), each with a confidence state and file + page provenance. The student confirms once; missing fields become “Not specified,” not blockers. Nothing is used downstream that the student did not confirm.
- [ ] After coaching, the student picks one of 3–4 story angles (questions built from their own answers) or writes their own before the early stance; Stage 2 receives `storyAngle`.
- [ ] The INTD600 phase-to-stage mapping (section 0B) and coaching principles (section 0C) are reflected in prompts, guard rules, and copy; nothing uses detector-evasion framing.
- [ ] **Golden path: a 3-photo phone capture of a printed syllabus produces a correct Assignment card** (topic, length, due date, citation style, and visible requirements match the pages, with provenance pointing at the right photo/page).
- [ ] **Golden path: one PDF + two screenshots + one professor URL merge correctly** into a single card; the URL appears in provided sources (and is deduped if the PDF also contains it); no field is missing solely because it lived in a screenshot rather than the PDF.
- [ ] After confirm, a 3–5 question get-to-know-you conversation can run (and can be skipped). Answers are stored on `interest_profiles` as tags plus the student's own words.
- [ ] Coaching questions are generated from the confirmed requirements, one at a time, adaptive. The margin-paper pattern asks about leaders and, on “I don't know,” offers 3–5 example names with a one-line why, as leads to verify.
- [ ] Interest-steered leads, when shown, each explain the assignment fit and the interest fit. They never appear as citations or quotes. When scholarly sources are required, the hook-or-example note is visible and a scholarly-shaped lead is also offered.
- [ ] The student picks every lead. Accepted leads are stored `to_verify` for Stage 4. The product does not present unverified quotes or fabricated citations. No celebrity–organization pairing is hard-coded as fact.
- [ ] Get-to-know-you and coaching answers accept paste (no warning; `paste_ratio` recorded quietly) and count toward the voice sample. The 200-word / 2×40 minimum (across answers given; any question skippable) is enforced, with a fallback prompt if short.
- [ ] `StyleMetrics` and `voice_profiles` are reused, not forked. A recent checker baseline can be kept or refreshed. Completing Stage 1 writes `style_profiles` for the paper.
- [ ] Background questions are brief and assignment-tied, not a generic survey.
- [ ] Stage 1 ends with DISSECT: a roadmap built only from the confirmed rubric/prompt, each section tied to rubric criteria, confirmed by the student and saved as `section_plans`.
- [ ] Every voice question has a Skip button; the voice minimum is met across answers, not per question.
- [ ] (t47) The parse returns THE LESSON (verbatim evidence quote) and a prompt type; the checklist shows **What this assignment is teaching** (editable); DISSECT shows the lesson card, each section's mode and concept, and a working **Change** for prompt type. The leadership-styles prompt → `lesson` with “leadership styles” as a concept; the summer-vacation prompt → `personal_experience` with “magical” in `emotionalTerms`, memory sections, no Stage 1 leads, and mirror-style coaching questions. Stage 1 lead sets are 3–5 ranked plus at most one wildcard, counted toward the cap. A Counterargument section appears only when the assignment asks for one. The Stage 6 voice note follows the t51 hybrid rule (natural words + paste share; e.g. a fully typed 210-word Stage 1 with nothing else → no note, 210 words at 65% pasted → `VOICE_NOTE_ANSWERS_LOW`); never during intake.
- [ ] **Start stance interview** is disabled until the checklist is confirmed, the voice minimum is met, a story angle is chosen, an early stance (≥ 25 words) exists, and the roadmap is confirmed. Stage 2 then receives requirements, the story angle, early ideas, and leads. The six-stage structure is unchanged.
- [ ] Edge cases in section 12 behave as specified (no rubric, vague prompt, multiple assignments, image-only, non-English, teacher forbids AI, failed link fetch, blurry/dark retake, rotation, duplicates, password-protected PDFs, handwriting, unsupported types, interrupted mobile upload). Assignment files are private, EXIF GPS-stripped, retained for the life of the paper plus 90 days, and deletable by the student.
- [ ] Interest data is only used to personalize this student's coaching, is hidden from other users and from admin text views, and can be deleted by the student.
- [ ] Session events support SOP review of dig-deeper vs. move-on, time per step, fields corrected after parse, personalized vs. generic lead pickup, completion, and optional 1–5 lead-interest ratings — without storing interest prose in `detail`.
- [ ] Sensitive categories are not asked for or inferred. Volunteered, assignment-relevant content may be used on this paper only and is not stored as a standing tag.
- [ ] Guard, coaching-only comments, and rule-based fallbacks hold on parse and intake model calls.

---

## 16. Open questions

None of these should block the build. Defaults above are in force if unset.

1. Interest-profile reuse window: **180 days**, same as the voice baseline. Confirm later if a longer window is wanted.
2. Where Stage 4 surfaces dropped leads: **default:** a short note on the Stage 4 source list, “We couldn't verify this lead, so we dropped it,” with a chance to replace it. Implement with Stage 4.
3. Whether `/admin/sop` should ever show interest *tag frequency* (no raw answers). **Default: no** in v1; pickup-rate aggregates only.
4. **Voice minimum — DECIDED by Colton (Nov 20, 2026):** 200 words total across the answers given; skipped answers allowed. We kept the 2 × 40-word rule (compatible) and dropped the separate personal-question requirement (incompatible with skipping). See decision 13.
5. **Counterargument section — DECIDED by Colton (Nov 20, 2026, t47):** “Counterargument only appears when the rubric asks for one.” DISSECT includes a Counterargument & Rebuttal section only when the assignment requires it (the earlier “or argumentative paper type” inclusion is dropped). The Stage 2 counterargument moves still run for every paper because they test the student's own claim and add no section. See decision 19.
6. **TODO for Paper Coach Research (t47):** how common vague/personal-experience prompts are (e.g. “tell us about your summer vacation”) and at which grade levels. No statistics are assumed in copy or routing until this research lands; routing defaults aren't tuned to any assumed share (stage specs 2B.8).

No other blockers. Build Stage 1 with the defaults in this doc.

---

## Changelog

- **Nov 20, 2026 (t51)** — 8.1a: the t47 all-pasted rule is replaced by Colton's hybrid rule (natural typed/spoken words across the paper plus paste share; tiers 600 / 200 / 80 [PROVISIONAL]; `VOICE_NOTE_ANSWERS_SHORT` / `VOICE_NOTE_ANSWERS_LOW`). Acceptance line updated. Intake behavior is unchanged.
- **Nov 20, 2026 (t47)** — Colton's Stage 2 brainstorm: the parse now extracts THE LESSON and the prompt type (new section 4.6; checklist line 9; DISSECT lesson card, section `mode`/`concept`, prompt-type **Change**). Personal-experience prompts route memory-forward from Stage 1 (mirror questions, no leads unless sources are required). Stage 1 lead sets are ranked with one Outside the box wildcard (counted toward the cap). Counterargument decided (only when the rubric asks; section 16 item 5 resolved). All-pasted voice note `VOICE_NOTE_ANSWERS_ALL` (8.1a). Research TODO on vague-prompt prevalence (section 16 item 6). Decisions 18–19.
- **Nov 20, 2026 (t46)** — The Stage 6 voice-baseline note (8.1a, decision 17) now uses Colton's softer style: “Your voice answers were mostly pasted in, which is totally fine. Typed or spoken answers help us understand your voice better, so treat the voice comparison as a lighter read.” t45's wording is retired. Intake behavior is unchanged.
- **Nov 20, 2026 (t43/t44)** — Added urgent fix 0A.1, shipped with the paste-gate fix: remove every paste-blocking attribute and handler from every intake input, **including voice-capture answers** (Colton t44 replaced t43's voice-answer exception). Added acceptance tests (d)–(f), including iOS long-press paste and a CI grep with no exceptions. Decision 17 notes that the Stage 6 voice comparison may now include pasted text, and adds the quiet `paste_ratio` mitigation (section 8.1a; columns folded into 0008). Changed the locked rules, decision 6, sections 3.x, 5.x, 8 and the acceptance criteria from "paste-blocked" to "paste allowed."
- **Nov 20, 2026 (t41/t42)** — Loop-step references now include Colton's LOGIC CHECKPOINT (after CONFIRM, before ADVANCE, non-blocking). Added decision 16. No change to Stage 1 behavior.
- **Nov 20, 2026 (t40)** — Applied Colton's answers. Voice minimum is now 200 words across the answers given, skipped answers allowed; 2 × 40 kept, personal-question requirement dropped (decision 13, constants, gate, keep/refresh rules, tests, acceptance). Research leads are 3–5 per set with a 20-per-paper cap and a Google search-prompt handoff (decision 14, section 6.4). Section-first loop with skip/browse-ahead noted (decision 15). Counterargument default marked unconfirmed by Colton.

- **Nov 20, 2026 (t39)** — Folded in `retainwrite-coaching-philosophy.md` as the governing doc. Stage 1 now ends with DISSECT: a student-confirmed section roadmap (`section_plans`, migration `0008_section_loop.sql`) built only from the confirmed rubric/prompt (3.4b), added to the gate, API, prompts, events, tests, and acceptance criteria. Voice questions are skippable one by one while the unchanged minimum is met across answers. Decisions 12–13 added; open decisions 4 (voice minimum) and 5 (counterargument section) flagged for Colton.

- **Nov 20, 2026** — Read-the-upload-first rewrite. Removed the paste gate (urgent fix, section 0A): uploads are extracted immediately (Mistral OCR / Grok vision / native text), failures get per-file retry/retake, and paste/links are optional only. The field-by-field hard gate became a short confirm checklist with “Not specified” for anything missing, plus one polite follow-up question (3.3a). Added Pick your story (3.4a) before the early stance, the INTD600 phase-to-stage mapping (0B), and coaching principles (0C). Additive migration `0006_stage1_extract_first.sql`. Decisions 1, 2, and 7 revised; 9–11 added.
