# RetainWrite — Stage 1 Intake (assignment first)

Companion to `retainwrite-cursor-build-prompt.md` and `retainwrite-stage-specs.md`. Paste this into Cursor with those docs. **This doc wins on Stage 1 behavior.** Stages 2–6 and cross-stage rules still follow the stage specs (that doc wins there). Table names, prices, and existing env var names are unchanged except for the additive migration `supabase/migrations/0005_stage1_assignment_first.sql` (0003 is the AI checker, 0004 is access codes).

**The six-stage structure is unchanged:** intake → stance interview → outline → sources and audio beats → draft → revise and feedback. This doc only changes what happens *inside* Stage 1, before the student clicks **Start stance interview**.

LOCKED RULES (hold everywhere): coaching only (the app never writes submission prose: no paragraphs, no thesis, no rewrites, no fabricated sources or quotes). AI produces questions, probes, checklists, extracted requirements, and research *leads to verify*. The student writes every submitted sentence and chooses every lead. Style metrics are for feedback and voice baselines only. Paste is blocked on voice-sample answers. Every session is logged to `session_events`. Add `// SOP: coaching only, never generate submission text` at every AI call site. Use `lib/ai/guard.ts` on every model output.

Stack (same as the rest of the app): Next.js App Router, TypeScript, Supabase, Grok via the official `openai` SDK (`baseURL: "https://api.x.ai/v1"`, `GROK_API_KEY`). `MODEL_FAST` = `grok-4.3` (`reasoning_effort: "none"`) for live coaching questions and adaptive decisions. `MODEL_STRONG` = `grok-4.7` (`reasoning_effort: "low"`) for assignment parsing and extraction. Structured output uses `response_format` `json_schema` (`strict: true`), then Zod; if the schema is rejected, retry with `json_object` + Zod. Optional `MISTRAL_OCR_API_KEY` for scanned PDFs and images (feature off if missing). Timeouts: 8 s fast, 30 s strong. On timeout or error, log `ai_fallback` and use the rule-based path; never block the student with a blank page.

---

## 0. Decisions locked in this doc

1. **Assignment first.** The student uploads the full prompt (files, paste, and/or links) before any coaching question is asked. Nothing in Stage 1 is inferred silently and used without a student check.
2. **Assignment card is a hard gate.** `MODEL_STRONG` extracts a structured `assignment_requirements` JSON. Each field has a confidence score. Low-confidence or missing fields are highlighted. The student must confirm or edit every field before coaching begins.
3. **Coaching questions are assignment-grounded and adaptive**, one at a time, only after the card is confirmed. The AI never decides the student's sources, stance, or leads.
4. **Get-to-know-you is a short, skippable personalization layer** (3–5 questions, adaptive), run after the card is confirmed and before or woven into the coaching questions. Answers are stored as an `interest_profile` (tags plus the student's own words) and used only to steer research leads toward things the student finds engaging, while still satisfying the assignment.
5. **Suggested people and resources are leads to verify, never citations.** Each lead must show why it connects to the assignment, and — when it came from an interest — why it also connects to that interest. Stage 4 verifies with real sources and drops leads it cannot verify. No unverified quotes, titles, or URLs are presented as fact.
6. **Voice capture is embedded.** Typed answers to get-to-know-you, assignment-grounded, personal, and fallback questions *are* the voice sample (paste blocked). Minimum: ≥ 250 words across those answers, at least 2 answers of ≥ 40 words, and one required personal question of ≥ 40 words. Fallback prompt if short. Metrics reuse the shared `StyleMetrics` helper and the AI checker's `voice_profiles` table (do not fork).
7. **Stage 1 completes** only when the assignment card is student-confirmed, the voice minimum is met, an early stance (≥ 25 words) is saved, and the student clicks **Start stance interview**. Stage 2 receives the confirmed requirements, the early stance, and the accepted research leads.
8. **Interest data is private:** used only to personalize this student's coaching, never shown to other users, and deletable by the student.

---

## 1. What changed vs. the old Stage 1

The old Stage 1 was four generic blocks in this order: (1) course / prompt / due date / length / citation style, (2) background survey, (3) topic stance, (4) a separate “write ~150–300 words about anything” voice sample.

| Old block | Now |
|---|---|
| Block 1 Assignment (typed fields, min 15-word prompt) | Upload first, then a parsed **Assignment card** the student must confirm. Structured requirements live in `assignments.requirements`. `papers.course`, `due_date`, `assignment_prompt`, `required_length`, and `citation_style` are synced from the confirmed card. |
| Block 2 Background (generic survey) | Brief, assignment-tied background questions folded into coaching (year, major, comfort with the citation style, prior grades/feedback). Not a standalone survey. |
| Block 3 Topic stance (min 25 words) | An early-take question inside assignment-grounded coaching (still min 25 words). That answer is handed to Stage 2 as `originalThesis`. |
| Block 4 Raw voice sample (150 words, any topic) | No separate “write about anything” block by default. Voice is sampled from paste-blocked intake answers (250-word floor). A fallback prompt appears only if the sample is still thin. The standalone AI checker keeps its own 150-word, four-question voice check unchanged. |

---

## 2. Flow at a glance

Routes stay under `/app/papers/[paperId]/stage/1`. Shared chrome (left rail, stages 1–6) is unchanged.

1. **Upload** — files, paste, and/or links.
2. **Parse** — extract text (OCR fallback for scans), then `MODEL_STRONG` fills the Assignment card.
3. **Confirm** — student reviews, edits, and confirms every field. This is a hard gate.
4. **Get to know you** — 3–5 skippable, adaptive questions about interests. May start immediately after confirm and/or be woven into step 5.
5. **Coaching questions** — one at a time, grounded in the confirmed assignment; leads steered by the interest profile when present; background and the required personal question included.
6. **Voice readout + gate** — show the voice summary; **Start stance interview** is enabled only when the gate in section 7 is met.

The student can leave and resume. Progress is saved after every successful API call.

---

## 3. Screen-by-screen flow and microcopy

### 3.1 Screen A — Upload the assignment

**H1:** Start with the assignment

**Sub:** Upload the full prompt — the instructions, rubric, and anything your teacher handed out. We'll pull out the requirements, and you'll check them before we ask any questions.

Three equal actions:

- **Upload files** — accept `.pdf`, `.docx`, `.txt`, `.md`, `.png`, `.jpg`, `.jpeg`, `.webp`, `.heic`, `.gif`. Multiple files allowed, max **10**, max **20 MB** each. Reject `.doc` with “Save or export this as a PDF or a .docx and try again.”
- **Paste the prompt** — textarea, paste allowed here (this is the teacher's text, not a voice sample). Max 20,000 words.
- **Add a link** — one URL per line, max 10. We only fetch public pages (see 12.7). If a fetch fails, keep the URL and ask the student to paste or upload the content.

Helper: “PDF, Word, or a photo of a handout all work. You can add more than one.”

Short rights line + required checkbox: “I'm uploading this for my own coursework.” Disable the primary CTA until it's checked and at least one file, paste, or link is present.

Primary CTA: **Read my assignment**

Log `assignment_uploaded`.

### 3.2 Screen B — Parsing

Full-width progress, not a blank spinner. Staged copy, 2–3 s each as work actually proceeds:

- “Extracting the text…”
- “Looking for length, citation style, and sources…”
- “Pulling out the rubric and structure…”

If OCR runs: “This looks like a scan — reading the page…”
If OCR is needed but `MISTRAL_OCR_API_KEY` is missing: stop on a recovery state, not a dead end: “This looks like a scan, and we couldn't read the text automatically. Paste the prompt, or try a clearer photo.” Log `ocr_skipped`. Offer **Paste the prompt** and **Add another file**.

If extraction yields fewer than 20 words and there is no paste: same recovery state, “We couldn't read enough text from that file.”

Do not show coaching questions on this screen.

### 3.3 Screen C — Assignment card

**H1:** Does this look right?

**Sub:** We read your prompt. Check every field. Fix anything that's off before we continue — we won't guess for you.

Render every field in the schema (section 4), including empty ones. Visual states:

| State | Treatment |
|---|---|
| Extracted, confidence ≥ 0.6 | Normal text + **Looks right** |
| Low confidence (`< 0.6`) | Amber highlight, label “We're not sure about this one — please check.” |
| Missing / null | Dashed empty state, “We couldn't find this — add it if you know it.” |
| Student-edited | Quiet “You edited this” mark |

Each field has **Looks right** and **Edit**. Edit opens an inline control (text, select, date, list editor for sources / rubric / formatting / readings). List fields can add/remove rows.

Length display rules (section 4.3): if the prompt gives pages and not words, show the page range and the word estimate: “About {min}–{max} words (we count ~275 words per double-spaced page). This is an estimate, not a rule.” If the prompt already gives a word count, show that count and do **not** overwrite it with the estimate. If both are present, show both, with the teacher's word count primary.

**Confirm all after review:** button **Looks right — continue**. It is disabled until (a) every *displayed* field has been marked Looks right or edited-and-saved, and (b) required fields are filled or explicitly set to “Not specified” (section 4.4). Clicking it early scrolls to the first unreviewed or missing required field: “A few fields still need a look.”

If the parser flagged a possible AI restriction (section 12.6), show the note on this screen *before* the continue button. The student must pick **Continue anyway** or **I'll check first**. The latter saves progress and leaves Stage 1 `in_progress`.

Primary CTA writes via `POST .../assignment/confirm`. Log `assignment_confirmed` and any `assignment_field_edited` corrections (parsed value vs. confirmed value).

### 3.4 Screen D — Get to know you, then coaching questions

One question at a time, same conversational panel as later stages. A quiet progress hint: “Question {k} of about {n}” (n is an estimate, not a hard contract).

**H1 (first interest question):** Before we dig into the assignment

**Sub:** A few short questions about you — so the research leads we suggest feel like you, not a generic list. Skip anytime.

Persistent text button, always available during interest questions: **Skip — just ask about the paper.** Skipping logs `interest_skipped` and jumps to assignment-grounded coaching. An existing profile can be reused (section 5.3).

**H1 (once coaching starts):** Let's talk about this assignment

Interest and coaching questions share the same input. Answers marked `is_voice_sample` (all interest, coaching, personal, and fallback answers) **block paste and drop**: `onPaste` / `onDrop` `preventDefault`, note “We need your own typing here.” Background *selects* (year, citation-style comfort) are not paste-blocked.

Lead cards (section 5.5 and 6.4), when shown after a “I don't know” or a natural opening:

**Heading:** Here are a few leads you might look into — suggestions to research, not citations. You'll verify them later.

Each card: name or story in one line; **why it fits the assignment**; **why it fits your interest** (only if it was interest-steered); badge **To verify**. Actions: **Add as a lead**, **Not this one**. Below the list: **I have someone else** (free-text, becomes a student-added lead, still `to_verify`) and **I don't know yet — give me search terms instead.**

If the assignment requires scholarly or peer-reviewed sources, every personal-interest lead includes this line: “This could be a hook or an example. You'll still need scholarly sources to meet the assignment.”

After the student accepts or declines leads, show an optional one-line rating: “How interesting do these options feel?” on a **1–5** scale, skippable (“Skip this”). Log `lead_interest_rated`. This is for SOP / retention, not a gate.

### 3.5 Screen E — Voice readout and gate

Shown when coaching is done (or the fallback voice prompt, if needed, has been answered).

Readout, same spirit as the AI checker: “Your natural voice: ~{avgSentenceLength} words per sentence, grade-level {readingGrade}, {formality} tone. Your go-to words: {topContentWords}.”

If a recent `voice_profiles` row exists, include the keep/refresh choice from section 8.3 here or at the start of Screen D (see that section).

Primary CTA: **Start stance interview**

Helper: “Next you'll pressure-test your early take. Your assignment details and the leads you picked come with you.”

Disabled with a specific reason if the gate fails (“A few assignment fields still need a check,” “We still need a little more writing in your own words,” or “Add your early take on this topic first.”). The complete action is `POST .../intake/complete`.

---

## 4. Assignment requirements schema

Canonical TypeScript / Zod shape (`lib/assignment/schema.ts`). Stored as `assignments.requirements`. `schemaVersion` is `"1.0"`.

```ts
export type FieldSource = "extracted" | "student_edited" | "student_entered" | "missing";

export type Field<T> = {
  value: T | null;
  confidence: number;          // 0–1; 0 if missing
  source: FieldSource;
  confirmed: boolean;
  rawEvidence?: string;        // short verbatim span from the prompt, if any
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
export type ProvidedReading = { title?: string; url?: string; notes?: string };

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
  providedReadings: Field<ProvidedReading[]>;
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
- `rawEvidence` must be a verbatim substring of the extracted text (enforce in code, case-insensitive). Drop it if verification fails.
- Confidence: 0.85+ when the text states the field clearly; 0.4–0.7 when implied or ambiguous; 0 when absent. Highlight if `confidence < 0.6` or `source === "missing"`.
- If multiple assignments appear in one file, do not pick one silently. Return `parse_meta.candidates` (short labels + evidence) and show a picker first (section 12.3).
- `aiPolicy` is set only from explicit wording in the prompt (section 12.6). Default `unspecified`.
- Pages-to-words conversion is done in **code**, not by the model.

### 4.2 Word estimate

Constant: `WORDS_PER_PAGE_DOUBLE_SPACED = 275` in `lib/config.ts`.

- Estimate only when pages are present and an explicit word count is not.
- Ranges use the same min/max (5–7 pages → about 1,375–1,925 words).
- Midpoint of the confirmed word range (or of the estimate if there is no word count) is what Stage 3 uses for body-section N. This matches the existing Stage 3 rule (1 page = 275 words; ranges use the midpoint). Prefer the confirmed card over re-parsing `papers.required_length`.

### 4.3 Confirm rules

The student must mark every displayed field Looks right or edit it. **Required before continue:**

- `topic` or `promptQuestion` (at least one, non-empty).
- `length`: a value, or explicit “Not specified.”
- `citationStyle`: a value, or explicit “Not specified.” (`other` requires `citationStyleOther`.)

Course, due date, rubric, formatting, readings, and structure are encouraged but optional. “Not specified” is a first-class value, stored as `source: "student_entered"` with a null or empty value and `confirmed: true`, so we do not pretend we found something.

On confirm, sync to `papers`:

- `title` ← topic (or prompt question), if `papers.title` is empty
- `course` ← confirmed course
- `due_date` ← confirmed due date
- `assignment_prompt` ← full concatenated extracted/pasted text (the raw prompt, not a paraphrase)
- `required_length` ← raw length string, or a compact “{min}–{max} words” / “{min}–{max} pages”
- `citation_style` ← confirmed style

---

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
- These answers are `question_kind: "interest"`, `is_voice_sample: true`, paste-blocked, and **count toward the Stage 1 voice minimum**.

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
2. **Early stance** (replaces old Block 3): “What's your early take on {topic or promptQuestion}? Why?” **Min 25 words.** Saved as the Stage 2 `originalThesis` snapshot. Probe once if thin: “What's one reason someone might disagree?”
3. **Personal / experiential question (required for voice):** “In your own words, why does this topic matter to you? If you've got a personal experience or something you've seen at work or in life, tell me that story.” **Min 40 words.** `question_kind: "personal"`.
4. **Brief, assignment-tied background** (not a generic survey), woven in, short answers acceptable (min 8 words when free-text; selects allowed):
   - year / school level (may update `profiles.school_level`)
   - major or program, if it helps
   - comfort with the confirmed citation style (“Have you written in {citationStyle} before? Anything that always trips you up?”)
   - optional: prior grades or teacher feedback on similar papers

If the student already poured a stance into an earlier answer (≥ 25 words, clearly a claim), do not ask the early-take question again; snapshot that answer.

### 6.2 Worked example (margin paper)

Confirmed card (illustrative): 5–7 page APA paper on the value of margin for business owners; cite 3 leaders who speak about margin.

Good first coaching question: “Do you have any leaders in mind who've talked about margin? Who are you curious to look into?”

If the student says they don't know, offer **2–4** example names, each with a one-line why, as **suggestions to research, not citations**. Example shape (these names are starting points the student may accept or reject; still `to_verify`): “Alex Hormozi — writes about pricing and gross margin for business owners.” Optionally add starter resources: search terms (“gross margin thought leaders small business”), types of sources (“a founder interview plus a business book chapter”), or a link to that person's *own* book or talk **only when the URL is known and will be verified in Stage 4**. Never present an unverified quote. If the student also has an interest profile (say they named a musician they follow), a *second* lead in the same set may try the section 5.5 pattern — a related figure or project that also speaks to margin or business leadership — clearly labeled to verify, with both “fits the assignment” and “fits your interest” lines. If that connection cannot be drawn honestly, don't.

The student chooses. Accepted leads go to `research_leads` for Stage 4.

### 6.3 Adaptive rules (coaching)

A `decision` is recorded on each `intake_answers` row: `dig_deeper` | `move_on` | `probe` | `suggestions_offered` | `stuck`.

- **Dig deeper** when the answer is thin (under its min, stock phrase, or repeats the question), when a required-source slot is still empty, when the personal question is under 40 words, or when the early stance is under 25 words.
- **Move on** when the slot is filled with a specific answer, or after **2 probes** (`lib/coaching/thin.ts`), or when the student flags “I'm stuck — flag for help” (save and continue).
- “I don't know” on a source/lead question is not a failure: offer suggestions or search terms (`suggestions_offered`), then move on once the student has picked, added their own, or declined.

Rule-based fallback if `MODEL_FAST` fails: walk a scripted list derived from the confirmed card (required sources → early stance → personal question → citation-style comfort → one “what do you already know about {topic}?”). Log `ai_fallback`.

### 6.4 Research leads — rules that always apply

Applies to both generic and interest-steered leads.

- Offer at most **2–4** at a time.
- Mark every suggested person, story, book, talk, or URL `status: "to_verify"`. Never label it a source, citation, or quote.
- Never fabricate citations, quotes, page numbers, publication years, or URLs. If the model is not confident a person or work exists and is on-topic, offer **search terms only**, not a name.
- Suggested items the student accepts or types themselves are handed to **Stage 4** as leads. Stage 4 is responsible for finding real sources. **Stage 4 drops leads it cannot verify** and tells the student that lead was dropped (no silent substitution). Until Stage 4 is built, store the leads and show them in the Stage 4 entry list as “to verify.”
- The student can reject all suggestions and continue.

---

## 7. Gate to Stage 2

`POST /api/papers/[paperId]/intake/complete` succeeds only when all of the following are true. Server-enforced, not just UI.

1. An `assignments` row exists for the paper, `confirmed_at` is set, and required card fields meet section 4.3.
2. The voice-sample minimum in section 8 is met.
3. An early stance of ≥ 25 words is stored (dedicated answer or an accepted equivalent).
4. The student clicked **Start stance interview** (this request).

Then: compute and upsert `style_profiles` for this paper; maybe upsert `voice_profiles` (section 8.3); mark `stage_progress` stage 1 `complete` and stage 2 `in_progress`; set `papers.current_stage = 2`. Log `stage1_completed`.

Stage 2 receives:

- confirmed `assignment_requirements` (and the synced `papers` columns)
- `originalThesis` = early stance text
- accepted `research_leads` (including interest-steered ones still `to_verify`)
- `intake_answers` (for cluster classification and slot filling)
- `style_profiles` for later mismatch / revision coaching
- whether an interest profile was used (`useInterestProfile`)

Do not start Stage 2 questioning in Stage 1. The stance interview is still Stage 2.

---

## 8. Voice capture (embedded, compatible with the AI checker)

### 8.1 What counts

The Stage 1 voice sample is the concatenation of `intake_answers` where `is_voice_sample = true`, in order, separated by newlines. That includes get-to-know-you answers, assignment-grounded coaching answers, the personal question, and any fallback. It does not include assignment paste, link fetches, or background selects.

Paste/drop is blocked on those textareas, same note as Stage 2: “We need your own typing here.”

### 8.2 Minimums

Constants in `lib/config.ts` (do **not** change `MIN_VOICE_SAMPLE_WORDS = 150`; that remains the AI checker's floor):

```ts
export const MIN_VOICE_SAMPLE_WORDS = 150;           // AI checker voice check only
export const STAGE1_VOICE_MIN_WORDS = 250;
export const STAGE1_VOICE_MIN_LONG_ANSWERS = 2;
export const STAGE1_VOICE_MIN_LONG_ANSWER_WORDS = 40;
export const WORDS_PER_PAGE_DOUBLE_SPACED = 275;
```

Stage 1 is met when all are true:

- Sum of voice-sample word counts ≥ `STAGE1_VOICE_MIN_WORDS` (250)
- At least `STAGE1_VOICE_MIN_LONG_ANSWERS` (2) of those answers have ≥ 40 words
- The personal question is answered at ≥ 40 words (it may count as one of the two long answers)

If the planned questions finish and the sample is still short, show a **fallback** prompt, still assignment-grounded, paste blocked:

> Before we start the stance interview, write a little more in your own words — no editing. Why does this assignment matter to you, or what's a moment when you saw this idea in real life?

Keep the fallback open until the gap is closed (or the keep-baseline exception in 8.3 applies). Log `voice_shortfall` and `voice_fallback_shown`.

### 8.3 Shared baseline (`voice_profiles`) — do not fork

Reuse the AI checker's `voice_profiles` table (created in `0003_ai_checker.sql`) and `lib/style/metrics.ts`. The checker's four questions and 150-word free-write are **unchanged**. Stage 1 must not invent a second metrics system or a second user-level baseline table.

`style_profiles` remains **one per paper** and is what mismatch / Stage 6 compare against.

If a `voice_profiles` row younger than **180 days** exists when Stage 1 reaches Screen D or E, offer:

> We already have a voice baseline from {source, e.g. “your AI checker”} on {date}: ~{n} words per sentence, {formality} tone.

Actions: **Keep this baseline** / **Refresh it with this paper.** Coaching questions still happen either way — they are intake, not just a sample.

- **Keep:** If Stage 1 voice answers are ≥ 150 words, the personal question is ≥ 40 words, and at least one answer is ≥ 40 words, skip the long fallback even if the total is under 250. `style_profiles.raw_sample` = Stage 1 answers if they already meet the full 250 / 2×40 rule; otherwise Stage 1 answers plus `voice_profiles.sample_text`. Set `style_profiles.source = "stage1_answers"` or `"stage1_plus_voice_check"`. Leave `voice_profiles` unchanged. Log `voice_check_reused`.
- **Refresh:** Require the full Stage 1 minimum (250 / 2×40 / personal 40). Upsert `voice_profiles` from this paper's sample (`source = "stage1"`). Log `voice_profile_updated`.

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
create type extraction_method as enum ('pdf_text', 'docx', 'ocr', 'paste', 'fetch', 'manual');
create type intake_question_kind as enum (
  'interest', 'coaching', 'background', 'personal', 'fallback_voice', 'lead_followup'
);

create table assignments (
  id uuid primary key default gen_random_uuid(),
  paper_id uuid not null unique references papers on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  raw_text text not null default '',
  requirements jsonb not null default '{}',       -- AssignmentRequirements
  parse_meta jsonb not null default '{}',         -- model, ocr, language, candidates, timings
  field_confirmations jsonb not null default '{}',
  confirmed_at timestamptz,
  ai_policy_ack_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table assignment_files (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references assignments on delete cascade,
  paper_id uuid not null references papers on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  kind assignment_file_kind not null,
  filename text,
  mime text,
  byte_size int,
  storage_path text,
  url text,
  extracted_text text,
  extraction_method extraction_method,
  ocr_used boolean not null default false,
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

Also: trigger to keep `assignments.updated_at` fresh. New private Storage bucket `assignments`, RLS by user folder `${user_id}/...`, same pattern as `sources`. Generate types into `lib/database.types.ts`.

`stage_progress.data` for stage 1 (Zod-validated) may store UI state (`useInterestProfile`, `voiceChoice`, current question id). The source of truth for answers, files, requirements, leads, and interests is the tables above.

`research_leads.status` values `verified` and `dropped` are written in Stage 4, not Stage 1.

---

## 10. API routes

All routes: session required, `assertStageUnlocked(paperId, 1)` (or complete-and-hand-off on `/complete`), Zod-validated bodies, `runtime = 'nodejs'` where files or model calls need it. Never import service-role keys on the client.

### `POST /api/papers/[paperId]/assignment/upload`

Accepts multipart files and/or JSON `{ pasteText?: string, links?: string[] }` plus `rightsConfirmed: true`. Creates `assignments` if needed. Writes `assignment_files`, extracts text (PDF text layer, `mammoth` for DOCX, optional Mistral OCR for images and textless PDFs, public fetch for links — timeout 8 s, size cap 2 MB, no authenticated LMS pages). Does **not** call the LLM. Returns file ids, extraction method, word counts, and any `ocr_skipped` flags.

### `POST /api/papers/[paperId]/assignment/parse`

Concatenates extracted text, calls `MODEL_STRONG` with the parse schema, Zod-validates, verifies `rawEvidence` substrings, computes word estimates in code, saves `requirements` + `parse_meta`. If `parse_meta.candidates.length > 1`, return the picker and do not pretend a single card is confirmed. Returns the Assignment card.

### `POST /api/papers/[paperId]/assignment/confirm`

Body: student-edited `AssignmentRequirements` and per-field confirmations (and optional `selectedCandidateId`, `aiPolicyAck`). Rejects if section 4.3 is unmet. Sets `confirmed_at` (and `ai_policy_ack_at` if applicable), syncs `papers` columns. Logs corrections.

### `POST /api/papers/[paperId]/intake/next-question`

Body: `{ answer?: string, skipInterest?: boolean, skipThisQuestion?: boolean, voiceChoice?: "keep" | "refresh", useInterestProfile?: boolean, acceptedLeadIds?: string[], rejectedLeadIds?: string[], addedLead?: {...}, interestRating?: 1|2|3|4|5 }`.

On the first call after confirm, starts get-to-know-you unless skipped or a reusable profile was accepted. Subsequent calls persist the previous answer (`intake_answers`, word count, timings, decision), update `interest_profiles` when an interest question is answered, maybe return lead cards, then return `{ question, kind, minWords, suggestions?, done?, needsFallbackVoice? }`.

Guard every model output. Questions ≤ 35 words. Lead why-lines ≤ 40 words. No paper prose, no quotes attributed to leads, no invented URLs presented as verified.

### `POST /api/papers/[paperId]/intake/complete`

Enforces the section 7 gate, writes `style_profiles` (and maybe `voice_profiles`), completes Stage 1, unlocks Stage 2. Returns the Stage 2 URL.

---

## 11. Grok system rules

Add `// SOP: coaching only, never generate submission text` at every call site. Run `lib/ai/guard.ts` on the output (same rewrite-phrase and 12-word edited-copy rules as the stage specs). System prompts are cached and must include all of the following.

**Parse (`MODEL_STRONG`, `reasoning_effort: "low"`):**

> You extract assignment requirements from teacher materials. Return only the JSON schema. Quote short evidence spans from the text, verbatim. If a field is not present, value is null and confidence is 0. Never invent due dates, page counts, citation styles, rubric weights, or source counts. Never write essay text, theses, or outlines. If more than one assignment appears, list candidates; do not pick one. If the text forbids or restricts AI tools, set aiPolicy and quote the line.

**Intake questions and leads (`MODEL_FAST`, `reasoning_effort: "none"`):**

> You are a writing coach. Never write, rewrite, or complete sentences or paragraphs for the student. Never produce a thesis, topic sentence, or paper prose. Never fabricate sources, quotes, titles, page numbers, or URLs. Ask one question at a time, grounded in the confirmed assignment. You may ask short get-to-know-you questions so research leads can reflect the student's stated interests. Do not ask about health, religion, politics, or sexuality, and do not infer them; only use such content if the student volunteered it and it is relevant to this assignment. When suggesting people, stories, or resources, they are leads to verify, not citations. Each lead must say why it fits the assignment, and if it was interest-steered, why it also fits that interest, using the student's words. If the assignment requires scholarly sources, say clearly that an interest lead can be a hook or example and still needs scholarly support. If you are not confident a connection or a work exists, offer search terms instead of a name. The student chooses every lead. Decide dig_deeper or move_on using the rules you were given.

Student data in prompts: send only the fields needed (confirmed card, recent answers, interest tags / short verbatim answers for this user). Never send email or name.

---

## 12. Edge cases

**12.1 No rubric.** The rubric field stays missing. Copy: “No rubric in what you uploaded. You can add grading criteria if you have them, or continue without.” Not required.

**12.2 Vague prompt** (“write a paper about X”). Highlight missing length and citation style. The student fills what they know or marks Not specified. Coaching still starts after confirm, more general but still topic-grounded.

**12.3 Multiple assignments in one PDF.** Parser returns `parse_meta.candidates`. Picker: “We found more than one assignment in this file. Which one is this paper for?” plus “It's all one assignment.” Then parse (or filter) the selected part. Never silently pick.

**12.4 Image-only or scanned PDF.** Try Mistral OCR when the key is set. If not, or if OCR fails, the recovery copy in 3.2. The student can always paste.

**12.5 Non-English materials.** If detected language is not English: “This assignment looks like it's in {language}. Coaching questions and feedback are in English in this version, but you can still upload it and type answers in the assignment's language.” Continue is the student's choice. Parse extracts what it can. Do not block.

**12.6 Teacher forbids or restricts AI.** Trigger on `aiPolicy` of `restricted` or `forbidden`, or on explicit phrases in the extracted text (case-insensitive), including “no AI,” “do not use ChatGPT,” “AI use is prohibited,” “generative AI is not allowed.” Show a note, not a hard block:

> This assignment looks like it may restrict AI tools. RetainWrite is a coach — it doesn't write your paper — but your teacher may still not allow it. You decide whether to continue. If you're unsure, check with your teacher.

Buttons: **Continue anyway** (sets `ai_policy_ack_at`, logs `ai_policy_continued`) or **I'll check first** (saves, leaves Stage 1 in progress, logs `ai_policy_notice_shown`).

**12.7 Link fetch failures.** Public GET only, 8 s timeout, 2 MB cap, follow a small redirect limit, no cookies or student LMS credentials. If the response is a login page or fails, keep the URL on the file row and ask the student to paste or upload. Never store fetched credentials.

**12.8 Empty or unreadable mix.** If after all files + paste the usable text is under 20 words, stay on the recovery state. Do not invent a card.

---

## 13. Session logging (SOP improvement)

Write `session_events` with `stage = 1`. Never put full assignment text, interest raw answers, or voice-sample prose in `detail`. Store counts, ids, timings, field paths, and short enums.

Events:

`assignment_uploaded`, `assignment_parse_started`, `assignment_parsed`, `assignment_field_edited`, `assignment_confirmed`, `ocr_skipped`, `ai_policy_notice_shown`, `ai_policy_continued`, `interest_started`, `interest_skipped`, `interest_question_shown`, `interest_answered`, `interest_profile_updated`, `interest_profile_deleted`, `interest_profile_reused`, `intake_question_shown`, `intake_answered`, `intake_dig_deeper`, `intake_move_on`, `suggestions_offered`, `lead_accepted`, `lead_rejected`, `lead_student_added`, `lead_interest_rated`, `voice_shortfall`, `voice_fallback_shown`, `voice_sample_computed`, `voice_check_reused`, `voice_profile_updated`, `stage1_completed`, `ai_fallback`.

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
- Drop-off by Stage 1 screen (upload, parse, confirm, interest, coaching, gate)

Stage 4 should log `lead_verified` and `lead_dropped` with `steered_by` so SOP can see which personalized leads survive verification. Add those event names when Stage 4 is implemented; they are reserved now.

---

## 14. Constants and tests

In `lib/config.ts`, add the Stage 1 voice and page-to-word constants in section 8.2. Keep `MIN_VOICE_SAMPLE_WORDS = 150` for the checker.

Vitest, at minimum:

- Page-to-word estimate (275, ranges, never overwrites an explicit word count)
- Confirm gate (required fields, “Not specified,” unreviewed fields fail)
- Voice-minimum calculator (250 / 2×40 / personal 40, and the keep-baseline exception)
- `rawEvidence` and lead-name evidence must be substrings when claimed as extracted
- Interest tag rules: no inferred sensitive tags; volunteered sensitive content is not promoted to standing tags
- Leads default to `to_verify`; interest-steered leads require both why-lines; scholarly-required assignments attach the hook-or-example note
- StyleMetrics additive fields exist and do not break existing mismatch tests
- Stage 2 stays locked until `/intake/complete` succeeds
- Interest profile delete clears the user row
- OCR skipped path when the Mistral key is missing

---

## 15. Acceptance criteria

- [ ] Stage 1 starts on the upload screen. No coaching question appears before the Assignment card is confirmed.
- [ ] Multiple files, pasted text, and a link list are all accepted. Scanned/image uploads use OCR when the key is present, and fall back to a paste prompt when it is not.
- [ ] The Assignment card shows paper type, topic/question, length (with a ~275 words/page estimate when only pages are given), citation style, formatting rules, required sources, provided readings, structural requirements, due date, and rubric criteria with weights.
- [ ] Every field has a confidence state. Low-confidence and missing fields are highlighted. The student must confirm or edit every field. Confirm-all cannot skip unreviewed or missing required fields. Nothing is used downstream that the student did not confirm.
- [ ] After confirm, a 3–5 question get-to-know-you conversation can run (and can be skipped). Answers are stored on `interest_profiles` as tags plus the student's own words.
- [ ] Coaching questions are generated from the confirmed requirements, one at a time, adaptive. The margin-paper pattern asks about leaders and, on “I don't know,” offers 2–4 example names with a one-line why, as leads to verify.
- [ ] Interest-steered leads, when shown, each explain the assignment fit and the interest fit. They never appear as citations or quotes. When scholarly sources are required, the hook-or-example note is visible and a scholarly-shaped lead is also offered.
- [ ] The student picks every lead. Accepted leads are stored `to_verify` for Stage 4. The product does not present unverified quotes or fabricated citations. No celebrity–organization pairing is hard-coded as fact.
- [ ] Get-to-know-you and coaching answers are paste-blocked and count toward the voice sample. The 250-word / 2×40 / personal-40 minimum is enforced, with a fallback prompt if short.
- [ ] `StyleMetrics` and `voice_profiles` are reused, not forked. A recent checker baseline can be kept or refreshed. Completing Stage 1 writes `style_profiles` for the paper.
- [ ] Background questions are brief and assignment-tied, not a generic survey.
- [ ] **Start stance interview** is disabled until the card is confirmed, the voice minimum is met, and an early stance (≥ 25 words) exists. Stage 2 then receives requirements, early ideas, and leads. The six-stage structure is unchanged.
- [ ] Edge cases in section 12 behave as specified (no rubric, vague prompt, multiple assignments, image-only, non-English, teacher forbids AI, failed link fetch).
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

No other blockers. Build Stage 1 with the defaults in this doc.
