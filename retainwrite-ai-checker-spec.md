# RetainWrite — Free AI Checker Spec (companion to `retainwrite-cursor-build-prompt.md` and `retainwrite-stage-specs.md`)

Public routes: `https://retainwrite.com/ai-checker` and `https://retainwrite.com/ai-checker/rubric`.
Landing copy (Paper Coach Marketing): `/workspace/retainwrite/ai-checker-landing-copy.md`.
Rubric version at launch: **v1.0**. This is a standalone free tool, separate from the paid six-stage paper pipeline.

Where this doc conflicts with the build prompt, **this doc wins** for the checker. Existing product rules still hold: coaching only, `lib/ai/guard.ts`, no detector-evasion framing, Grok via `https://api.x.ai/v1`, Zod-validated `json_schema` output, no new env var names.

---

## 0. Locked meanings (do not reinterpret)

**(a) Ratings are pattern strength, not authorship probability.** `high` / `moderate` / `low`, and the 0–100 **Signal strength** number, describe how strongly a writing pattern shows up in the text. They are **not** a probability that AI wrote the text, a chance of being flagged, or a verdict about cheating. Never label a number "AI likelihood," "AI %," or "chance AI wrote this."

**(b) The voice check builds a baseline.** The 1-minute voice check captures the student's own vocabulary, tone, and scholarly register (typed writing voice, not a spoken recording). That baseline is what "vocabulary vs. your own writing" and register comparisons run against.

**(c) Accounts.** The checker itself needs **no account**. A student can paste a draft and see a preview with no signup. Unlocking the full report asks for an email (and age confirmation). The voice check **creates a free account** (magic link / signup) and attaches the baseline to it. The first paper remains free, no card.

**(d) Privacy line (use this wording, or a close paraphrase, on the page, in the report, and in the FAQ):**

> Drafts aren't stored unless you are signed in and opt in. We never use drafts for training.

Full pasted text is processed to produce the report, then discarded, unless the user is signed in and opts in to save it. Quoted tells in a report are kept only as long as the report link lasts (30 days). Users must be 13+.

---

## 1. Purpose and positioning

**Positioning line (locked with marketing):** **Does this sound like you?**

The student pastes a draft and gets an honest, named-tell readout of seven documented writing signals, plus a coaching question for each tell. It is a free coaching tool for people searching for an "AI detector for student papers." It is **not** a ghostwriter, a rewriter, a "humanizer," or a verdict machine.

Frame, everywhere (UI, emails, SEO body copy, social):

> Does this sound like you? See which parts read generic or machine-like, and why.

Allowed in the title tag and keywords only, because it is the search term: "AI detector for student papers." Any use of "detector" is immediately framed as: this tool rates writing patterns; it does not prove who wrote something. Banned in copy, UI, and SEO: "bypass," "beat Turnitin," "undetectable," "pass AI detection," "humanize," "make this undetectable."

Public-facing marketing uses the name **Retain and Write**; code, table names, and technical docs use **RetainWrite**. Both refer to retainwrite.com.

---

## 2. Non-negotiable guardrails

- **Coaching only.** The tool never rewrites, paraphrases, "humanizes," or offers alternate sentences. `lib/ai/guard.ts` applies to every model call. Each named tell comes with a coaching question (for example, "What happened to you that shows this?"), never replacement text. Add `// SOP: coaching only, never generate submission text` at every AI call site.
- **No detector-evasion framing** in copy, UI, emails, or SEO (see section 1).
- **Prominent honesty disclaimer**, visible in the **report itself** (not only on the landing page), near the summary ring and again in the footer:

  > No tool, including this one or Turnitin or GPTZero, can prove whether AI wrote something. These results are style signals, not a verdict. False positives are real, especially for ESL writers and very formal writers.

  Cite Liang et al. (2023) on the landing page, rubric page, and FAQ (section 18). Turnitin itself tells instructors to use its indicator to start a conversation, not to draw a conclusion, and reports a sentence-level false-positive rate of about 4% (Chechitelli, 2023).
- **Privacy** as in section 0(d). Under-13 users are not allowed. Ages 13–17 may receive the report but must not be added to marketing lists.
- **Abuse limits:** per-IP and per-account rate limits, plus word limits (section 15).
- **Do not pad results to create alarm.** If the signals are low, the report must say the draft reads fine (section 9).

---

## 3. User flow

1. Student lands on `/ai-checker` (no account required).
2. Pastes a draft (min **120** words, max **4,000** words). Optional: if already signed in with a `voice_profiles` row, the vocabulary and register signals run immediately.
3. Clicks **Check my draft**. Server validates length and rate limits, strips quotes/citations/references the same way Stage 6 mismatch does, computes deterministic metrics, then calls Grok for the judgment signals. Skeleton loading with staged progress copy (section 5.6).
4. **Free preview:** the overall summary ring plus the **top 2** signals by signal strength. Disclaimer visible. No full grid, no per-section heatmap.
5. **Email gate:** "Enter your email to get your full report." Required age confirmation. Marketing checkbox unchecked by default, hidden for 13–17. On submit: unlock the full report on the page and email a PDF/HTML copy from `RetainWrite Coach <coach@send.retainwrite.com>`.
6. **Full report:** all seven signals, per-section breakdown, quoted tells, coaching questions, disclaimer, public-rubric link (v1.0).
7. **Bottom of the report:** voice-check upsell and **Start your free first paper** (free trial, no card). The voice check creates a free account, stores the baseline, and can continue into `/app/papers/new`.
8. Signed-in users with an existing session skip the email gate (still offered "Email me a copy"). Users 13–17 never see a prechecked or required marketing opt-in.

If the student is under the minimum word count, or over the maximum, do not run the model. Show a clear error. For a paper over 4,000 words: "Paste up to 4,000 words (about 8 pages). For a longer paper, check one section at a time."

---

## 4. Page layout

### 4.1 `/ai-checker`

Use the heading structure and body copy in `/workspace/retainwrite/ai-checker-landing-copy.md`, with the copy-alignment fixes in section 6.

1. **Hero.** H1: "Does this sound like you?" Subhead, primary CTA **Check my draft** (smooth-scrolls to the paste box), microcopy: "Free. No account needed to check. No card required. Ratings measure writing patterns, not who wrote it — no tool can prove that."
2. **What the checker looks at.** The seven signals, each in one line, plus a link to the public rubric (v1.0).
3. **What you get back.** Named tells, coaching questions, and that many drafts come back "reads fine."
4. **What no detector can tell you.** Liang et al. (2023) + formal-writing caveat.
5. **Paste box.** Label, word-count live readout (120–4,000), "Check my draft" button, privacy line from section 0(d).
6. **Results panel.** Preview or full report (section 5). The honesty disclaimer is inside this panel.
7. **Email gate** (after preview, if locked).
8. **Voice-check upsell** and **Start your free first paper** (after the report, or after preview as secondary links).
9. **FAQ** (section 17), including the privacy answer.
10. **Footer disclaimer** (marketing section 6 wording is fine).

### 4.2 `/ai-checker/rubric`

Publish the full v1.0 table (section 7), the scoring and calibration rules in plain language, a short changelog, and this note:

> This rubric is public and versioned. It will be updated as writing tools and detection methods evolve. Changes ship under a new version number and are listed below.

Link back to the checker. Do not hide thresholds.

### 4.3 `/blog` and `/blog/[slug]`

Implemented in the same public-content phase, alongside the checker. Marketing supplies posts. The checker is not blocked on blog content existing.

### 4.4 `/ai-checker/report/[token]`

Shareable / printable full report (no site chrome beyond a slim header). Token is unguessable. Expires in 30 days. Includes the disclaimer. No chat-bubble UI anywhere on these routes.

---

## 5. Results report design

### 5.1 Visual layout and the 0–100 score

Each **signal** and each **section** shows a prominent 0–100 score, easy to scan, labeled **Signal strength**.

- Tooltip (info icon next to the label): "Signal strength is how strongly this writing pattern shows up in the text. It is not the chance that AI wrote this."
- Footnote under the summary ring, always visible: the same sentence, plus "A low score is a good outcome — it means we did not find much of this pattern."

An **overall summary ring** uses the same 0–100 strength scale and a plain-language summary (not an authorship verdict):

| Overall strength | Label shown |
|---|---|
| 0–39 | **Reads like you** (also the "your draft reads fine" state) |
| 40–69 | **A few generic spots** |
| 70–100 | **Several machine-like patterns** |

When the band is 0–39, the headline must be one of: **"Your draft reads fine"** or **"Reads like you."** Do not bury it.

There is still no "score out of 100 that you passed or failed," and no authorship verdict. The number is pattern strength. Marketing copy that said "there is no score out of 100 and no verdict" must be revised (section 6).

### 5.2 Color, icons, and labels (never color alone)

| Strength | Band | Icon | Label | Color role |
|---|---|---|---|---|
| 0–39 | low | green check | **Keep** | sage green |
| 40–69 | moderate | amber circle / eye | **Worth a look** | amber |
| 70–100 | high | coral/red flag | **Fix first** | coral |

Meet **WCAG AA**: body text and labels ≥ 4.5:1 against the page background; large numerals and icons ≥ 3:1. Use darker ink tints for text on the warm off-white; use the brighter green/amber/coral only as fills or icon accents, not as small text. Every state pairs **icon + text label + number**. Do not rely on color alone.

Each flagged item (Worth a look or Fix first) is a collapsed row that expands to (1) the quoted tell from the student's own text and (2) one coaching question. Keep items can expand too, but start collapsed and do not demand attention.

### 5.3 Email gate

The free preview shows the overall ring (number, band, summary label) plus the **top 2** signals (name, strength, icon, label). A short line: "The other five signals and the section-by-section view are in your full report."

Unlock copy: **"Enter your email to get your full report."** That unlocks all seven signals, the per-section breakdown, and an emailed PDF/HTML copy via Resend from `coach@send.retainwrite.com` (`EMAIL_FROM` in the stage specs: `RetainWrite Coach <coach@send.retainwrite.com>`).

Form fields:

- Email (required).
- Age: required confirmation "I am 13 or older," plus a choice of **13–17** or **18+**. Under 13: block with "You must be 13 or older to use RetainWrite."
- Marketing consent checkbox, **unchecked by default**, copy: "Also send me occasional writing-coach tips. This is optional and separate from your report." Hidden for 13–17; stored as `false`.
- Submit: "Send my full report."

Report email: subject "Your RetainWrite writing-signals report"; HTML body with the summary, all signals, top tells, a private link to `/ai-checker/report/[token]`, and a PDF attachment (or a clear "Download PDF" link that works without signing in). Marketing emails (only if consented and 18+) include a visible unsubscribe link and the physical address **3629 Maizeland Rd, Colorado Springs, CO 80909** (CAN-SPAM; same address as the growth-ops doc). Report-delivery mail is transactional and is sent even when marketing is declined.

Leads go to `ai_checker_leads` with `source` and UTM fields (section 12).

### 5.4 Bottom CTAs

After the full report (and visible on the print view as links, not as a second sales page):

1. Upsell: **"Want even clearer results? Take this one-minute voice check."** Subcopy: "We'll build a baseline of your vocabulary, tone, and scholarly register, then re-score the comparison signals. Creates a free account. No card."
2. **"Start your free first paper"** → `/signup` or `/app/papers/new` (free trial, no card).

### 5.5 Design tokens (premium, academic, not a chat app)

| Token | Value |
|---|---|
| Display / headlines | **Newsreader**, 28–48px, tight tracking, ink. Use for H1, report title, and the overall label. |
| Body / UI | **Source Sans 3**, 16px body, 14px captions, 13px footnotes. |
| Numerals (scores) | Source Sans 3 tabular figures, 32–44px on cards, 56–72px in the ring. |
| Background | Warm off-white `#F6F1E8` |
| Surface / cards | `#FFFBF6` with a 1px `#E6DFD2` hairline and 16–20px radius |
| Ink / navy | `#15202B` (headings, scores) |
| Secondary text | `#3D4A57` (must pass 4.5:1 on `#F6F1E8`) |
| Accent (restrained) | `#9A4A2C` terracotta — links, the primary button, focus rings |
| Keep | fill `#D7E8DC`, ink `#1F6B4A`, icon check |
| Worth a look | fill `#F4E6C8`, ink `#8A5A00`, icon |
| Fix first | fill `#F3D8D2`, ink `#A33B2B`, icon flag |
| Spacing | Generous: 24/32/48/80 page rhythm; card padding 20–24px. |
| Motion | Score count-up (~600ms, ease-out, `prefers-reduced-motion` skips). Ring fill draws once. No bounce, no chat typing dots. |
| Loading | Skeleton cards plus staged copy: "Counting sentence lengths… / Checking rhythm… / Looking for stock phrases… / Reading topic sentences…" |
| Layout | Mobile-first. On a phone, the ring is at the top, then signal cards in a single column. On desktop, ring + overall label in a left column, signal cards on the right, section heatmap below. |
| Print / share | `@media print` on `/ai-checker/report/[token]`: white background, no gate, no nav, disclaimer included. |

No chat-bubble UI, no avatars, no "the coach is typing." This is a report, not a messenger.

### 5.6 Named components

- `ReportSummaryRing` — 0–100 ring, band, plain-language summary, tooltip, footnote, disclaimer adjacent.
- `SignalCard` — name, strength, icon, Keep / Worth a look / Fix first, expandable quoted tell + coaching question.
- `SectionHeatmap` — per-section strength for each signal or an aggregate per section; expandable tells scoped to that section.
- `EmailGate` — preview-to-full unlock form.
- `UpsellPanel` — voice check + free-first-paper CTAs.

### 5.7 Report acceptance criteria

- [ ] Every score is labeled "Signal strength," never "AI likelihood" or similar.
- [ ] Tooltip and footnote explain the number in the wording above.
- [ ] 0–39 / 40–69 / 70–100 map to Keep / Worth a look / Fix first, each with icon + label + color.
- [ ] Color is not the only indicator; contrast meets WCAG AA.
- [ ] A calibrated-low draft shows "Your draft reads fine" or "Reads like you," not a padded mid score.
- [ ] Preview shows only the overall ring and top 2 signals until the email gate is completed (or the user is already signed in).
- [ ] Full report emails from `coach@send.retainwrite.com` and is unlockable from the private link.
- [ ] Marketing checkbox defaults unchecked, is separate from delivery, and is not offered to 13–17.
- [ ] Unsubscribe works on marketing mail.
- [ ] Disclaimer is visible in the on-page report, the emailed copy, and the printable view.
- [ ] Reduced-motion is respected; layout works at 320px width; report is keyboard-navigable.

---

## 6. Copy alignment

Source: `/workspace/retainwrite/ai-checker-landing-copy.md`. **Seven writing signals** in that doc matches this rubric: there are exactly **seven** top-level signals, and they are the same seven, in the same order. Other documented tells (listy triads, generic transitions, repetitive openings, uniform paragraph length, over-polished register) are sub-measures inside those seven, not extra top-level signals. Marketing should keep saying "seven."

### 6.1 Real rubric examples (replace the illustrative tells)

Use these in "What you get back" and similar lines, instead of made-up placeholders:

- **Sentence-length variance:** "a run of five sentences between 17 and 19 words" — this is a real tell (a flat run: five or more consecutive sentences whose lengths span 3 words or fewer). Keep it.
- **Stock phrases:** a closing line such as "In conclusion, it is important to note that X plays a vital role in today's fast-paced world." Quote the student's actual closing line when present; the example above is only for marketing until live quotes exist.
- **Personal specifics (high = missing detail):** a paragraph that names no person, place, number, or first-hand moment — coaching question: "What did you actually see in that source?" or "What happened to you that shows this?"
- **Vocabulary (only once a voice baseline exists):** "words that weren't in your sample: multifaceted, meticulous, landscape."
- Additional coaching questions the copy may use: "Would you say this out loud?" / "What's the one point this paragraph is making, in your words?" / "If you deleted this opener, what specific fact would you start with instead?"

### 6.2 Copy lines that conflict with this spec (Marketing should patch)

1. **"There is no score out of 100 and no verdict."** Conflicts with the owner-required 0–100 Signal strength scores and the plain-language summary labels. Replace with something like: "Each signal gets a 0–100 signal-strength score — how strongly the pattern shows up, not the chance that AI wrote it. There is no pass/fail grade and no authorship verdict. Plenty of drafts come back 'reads fine.'"
2. **Email gate is missing.** The landing copy does not mention that the free preview is the overall summary plus the top 2 signals, and that an email unlocks the full report. Add one honest line near the paste box or results: "You'll see a preview right away. Enter your email for the full report and a copy in your inbox." Hero microcopy may keep "Free. No card required" but should also say no account is needed to check.
3. **"…how you actually write and speak."** The voice check is a **typed** conversational intake, not an audio recording. Say "how you actually write" (vocabulary, tone, and scholarly register). Drop "and speak" unless a spoken recording is added later.
4. **Account behavior is unstated.** Add: the checker needs no account; the voice check creates a free account.
5. **Privacy is unstated.** Add the privacy FAQ in section 17 (question 7) and the one-line privacy notice by the paste box.
6. **Brand name.** Copy says "Retain and Write"; the app and technical docs say "RetainWrite." Acceptable if marketing is standardizing the spaced name in public copy. Keep the domain retainwrite.com either way.
7. **"Detector" in the title, an H2, and keywords** is allowed for search intent, as the copy already frames the tool as not a verdict. Do not expand that wording into body CTAs ("Run the detector," "Detection score").

Assumptions in the landing copy that this spec **confirms:** (a) high / moderate / low = pattern strength, not authorship; (b) the voice check is a baseline of the student's own writing voice; (c) "reads fine" is a normal, desirable result.

---

## 7. Rubric v1.0 — seven writing signals

Starting thresholds, in the same spirit as the Stage 6 mismatch table in `retainwrite-stage-specs.md` section 7: published, unit-tested, and tuned from logged (non-text) metrics after roughly 50 real runs. Target: about 40–60% of genuine student drafts should land in **Reads like you**. If that share is under 25%, loosen; if over 80% and obvious stock-phrase drafts are slipping through, tighten. Log every metric, never to force a mid-band result.

**Exclusions (all deterministic signals):** text inside quotation marks and block quotes, in-text citations, headings, and the references list — same as mismatch. **Minimum to score a signal:** generally 120 words and 8 sentences; otherwise mark the signal `insufficient` and exclude it from the overall mean (do not treat as high).

**Level mapping:** moderate = "tell" (Worth a look, 40–69); high = "strong" (Fix first, 70–100). Consistent with mismatch: a strong signal stands alone as a reason to look; a single moderate tell is not a crisis.

### 7.1 The seven signals

#### 1. Sentence-length variance (deterministic)

- **Definition:** Whether sentence lengths cluster tightly instead of varying. Marketing: "Do your sentences all run about the same length?"
- **Measured:** After sentence splitting (reuse `lib/style/metrics.ts`), compute the coefficient of variation (CV = standard deviation / mean) of sentence word-counts, and detect **flat runs** (5+ consecutive sentences whose max−min length ≤ 3 words).
- **Why it is in the rubric:** Human prose typically varies sentence length; model output is often more even (documented as a stylometric tendency; see e.g. discussion in GPTZero's early statistical layer and later stylometric comparisons). We measure length variation directly. We do not compute model perplexity.
- **Thresholds (starting points):**
  - Keep (0–39): CV ≥ 0.45 and no flat run of 5.
  - Worth a look (40–69): CV < 0.40, **or** one flat run of 5–7 sentences.
  - Fix first (70–100): CV < 0.28, **or** a flat run of 8+, **or** two or more flat runs of 5+.
  - Map in-between CV values linearly across the band. Example tell: "Five sentences in a row run 17–19 words."
- **Coaching question:** "Which of these would you actually say out loud, and which would you split or combine?"

#### 2. Burstiness (deterministic; length/rhythm proxy)

- **Definition:** Whether short and long stretches alternate across the draft, including uneven paragraph size. Marketing: "Do short and long stretches alternate the way they do in most people's writing?"
- **Measured:** Slide windows of 4 sentences and compute each window's mean sentence length; burstiness = CV of those window means. Also compute CV of paragraph word-counts (uniform paragraph length is a sub-measure). This is a **transparent rhythm proxy**, not GPTZero-style variance of model perplexity. GPTZero used perplexity and burstiness until autumn 2023, then moved to a deep-learning classifier (GPTZero, 2023/2024). We do not run a local language model to score this, and we say so on the rubric page.
- **Thresholds (starting points):**
  - Keep: window-mean CV ≥ 0.30 and paragraph-length CV ≥ 0.35.
  - Worth a look: window-mean CV < 0.22, **or** paragraph-length CV < 0.20.
  - Fix first: window-mean CV < 0.14, **or** both sub-measures in the moderate band.
- **Coaching question:** "Where does this section speed up or slow down in your own thinking?"

#### 3. Vocabulary vs. your own writing (deterministic, **requires a voice baseline**)

- **Definition:** Whether the draft's vocabulary and complexity match the student's own sample. Marketing: "Do the words match how you usually write?"
- **Measured:** Reuse `lib/style/metrics.ts` and the mismatch table in the stage specs (section 7): unseen content words (≥ 8 letters, not in the allow-list) at **> 12%** (tell) and **> 20%** (strong); sentence-length jump **+60% / +100%**; reading grade **+4.0 / +6.0**; formality **+0.35 / +0.50**. Allow-list: sample vocabulary, plus any assignment text the student pasted (none, on this standalone tool, unless they later start a paper). Direction: only upward jumps. If the sample is under 200 words, a "strong" sentence-length jump is treated as a tell, same as mismatch.
- **Without a baseline:** status = `needs_voice`. **Do not score, do not treat as high, do not invent a comparison.** Card copy: "Want a clearer read on vocabulary? Take the 1-minute voice check."
- **With a baseline:** Keep if no tell; Worth a look if one tell and no strong; Fix first if one strong or two or more tells (same trigger rule as mismatch).
- **Coaching question:** "Which of these words would you use if you were explaining this to a classmate?"

#### 4. Tone consistency (deterministic + LLM judgment)

- **Definition:** Whether the voice stays steady or shifts between paragraphs, and — when a baseline exists — whether the draft is suddenly more polished than the student. Marketing: "Does the voice stay steady, or shift between paragraphs?" Over-polished register mismatch is a sub-measure, not an eighth signal.
- **Measured:** Formality score per paragraph (existing 0–1 metric). Intra-draft: standard deviation of paragraph formality, plus the gap between the most casual and most formal paragraph. With a baseline: `draft.formalityScore − sample.formalityScore` using mismatch thresholds (+0.35 tell, +0.50 strong). `MODEL_FAST` (`grok-4.3`, `reasoning_effort: "none"`) may only **name** the shift and pick short verbatim quotes; the numeric score comes from the metrics. Guard applies.
- **Thresholds:** Keep if formality SD < 0.12 and (if baseline) formality jump below +0.35. Worth a look if SD ≥ 0.18 or a paragraph gap ≥ 0.30 or a tell-level jump vs. sample. Fix first if SD ≥ 0.28 or a gap ≥ 0.45 or a strong jump vs. sample. Formal academic writing that is formal **throughout** is consistent — do not flag a steady formal register as a "shift." A steady formal register **far above the sample** is a vocabulary/register issue, scored here as the register-mismatch sub-measure and also reflected in signal 3.
- **Coaching question:** "Does this paragraph sound like the one before it, or like a different writer?"

#### 5. Topic sentences (LLM judgment + light rules)

- **Definition:** Whether each body paragraph opens with a clear point. Marketing: "Does each paragraph open with a clear point you would recognize as yours?"
- **Measured:** Rule pass: first sentence is very short and empty ("Yes.", "This is important."), or is a stock opener from the phrase list, or is a purpose announcement ("This paragraph will discuss…"). `MODEL_STRONG` (`grok-4.7`, `reasoning_effort: "low"`) classifies each body paragraph's first sentence as `specific_claim`, `generic_opener`, or `unclear`, with a verbatim quote, validated by Zod. Never rewrite the sentence. Score = share of body paragraphs that are `generic_opener` or `unclear`.
- **Thresholds:** Keep if < 25% weak. Worth a look if 25–49% weak, or two consecutive weak openers. Fix first if ≥ 50% weak, or the introduction and a majority of body paragraphs start with stock openers.
- **Coaching question:** "What's the one point this paragraph is making, in your words?"

#### 6. Personal specifics (deterministic + LLM judgment)

- **Definition:** Whether the draft includes details a generic essay would not: a class discussion, a place, a number the student collected, a first-hand moment. Marketing: "Are there details only you would know…?" High strength means the **lack** of those details (the genericness pattern), not "this is personal, therefore human."
- **Measured:** Deterministic counts per 250 words: numerals and dates, proper names / places, first-person lived phrases ("in my class," "when I," "at [school]"), concrete objects vs. abstract nouns. `MODEL_STRONG` labels up to 3 paragraphs as `has_specifics` or `generic_claim` with quotes. Academic papers can be specific without being autobiographical (a method, a cited figure, a named case). Count those as specifics. Do not punish a formal lab report for lacking a childhood anecdote.
- **Thresholds:** Keep if there is at least one concrete specific per 250 words, or the LLM finds specifics in ≥ 50% of body paragraphs. Worth a look if specifics are sparse (under one per 400 words) and ≥ 40% of body paragraphs are `generic_claim`. Fix first if almost no concrete specifics in 500+ words and a majority of body paragraphs are `generic_claim`.
- **Coaching questions:** "What happened to you that shows this?" / "What did you actually see in that source?"

#### 7. Stock phrases (deterministic list + cluster rule)

- **Definition:** Stand-by openers, wrap-ups, and LLM-favored style words that could fit almost any paper. Sub-measures: generic transitions that do no work, listy triads of empty adjectives ("comprehensive, robust, and seamless"), repetitive sentence openings (three or more consecutive sentences starting with the same function word or the same transition), and hedging pads ("it is important to note that") used as ceremony rather than caution.
- **Measured:** A versioned phrase list in `lib/style/stockPhrases.ts` (shipped with rubric v1.0), stem-matched, case-insensitive. The list is public on the rubric page. It includes documented LLM-favored style words such as *delve / delves / delving*, *underscore(s)*, *showcase / showcasing* (Kobak et al., 2025, found large 2024 excesses in PubMed abstracts, e.g. *delves* at 28× expected frequency), and scene-setting or ceremonial phrases widely reported as over-represented, including "in today's fast-paced world," "it is important to note," "plays a vital role," "in conclusion," "navigate the complexities," "a tapestry of," "serves as a testament." **Do not treat ordinary academic connectors alone** (*however*, *therefore*, *moreover*, *furthermore*) as AI tells — those also raise the existing formality score in human scholarly writing. One listed word means little; a **cluster** is the tell (Kobak et al.; later work notes co-occurrence of marker words after 2023). Also flag 3+ consecutive sentences with the same opening pattern, and listy triads from a short adjective list (comprehensive, robust, seamless, innovative, holistic, pivotal, nuanced, intricate, meticulous).
- **Thresholds:** Keep if 0–1 distinct list hits and no cluster, triad, or repetitive-opening run. Worth a look if 2 distinct hits per 500 words, **or** one ceremonial opener/closer, **or** one triad, **or** one repetitive-opening run. Fix first if 3+ distinct hits, **or** 2+ hits in the same paragraph, **or** two of {cluster, ceremonial closer, triad, repetitive openings}.
- **Coaching question:** "If you deleted this opener (or this closing line), what specific fact would you start or end with instead?"

### 7.2 Changelog (v1.0)

- **v1.0** (launch): Initial public rubric. Seven signals as above. Burstiness is a length/rhythm proxy, not model perplexity. Vocabulary comparison is off until a voice baseline exists. Thresholds are starting points, to be tuned from logged metrics.

---

## 8. Scoring and aggregation math

1. Strip exclusions, count words and sentences, enforce 120–4,000 words.
2. Split **sections**: use student headings if present; otherwise treat the first paragraph(s) as Introduction, the last as Conclusion if it looks like a close, and the middle paragraphs as Body (group very short paragraphs with a neighbor so a section is usually ≥ 80 words). Score signals at draft level and, where the metric is local, at section level.
3. Compute each available signal's 0–100 **signal strength** with the thresholds above. `needs_voice` and `insufficient` are omitted from averages and do not count as high.
4. Band the 0–100 number: 0–39 Keep / low, 40–69 Worth a look / moderate, 70–100 Fix first / high.
5. **Overall strength** starts as the **mean of available signal scores**, then is **constrained by the count rules in section 9** so the label and the number never disagree, and so a clean draft cannot be nudged into a mid band.

Per-section "section strength" is the mean of the signals available in that section (stock phrases, topic sentences, personal specifics, local length variance, local tone). Same 0–100 label and colors.

---

## 9. "Reads fine" calibration (do not pad)

The tool must often return **"Your draft reads fine"** / **Reads like you** when the patterns are weak. This is a success state.

**Count rules (decisive):**

- **Reads like you (0–39):** zero signals at Fix first, and at most **one** signal at Worth a look. Overall number = `min(39, mean of available scores)`.
- **A few generic spots (40–69):** exactly one Fix first, **or** two or three Worth a look and zero Fix first. Overall number = `clamp(max(mean, 40), 40, 69)`.
- **Several machine-like patterns (70–100):** two or more Fix first, **or** one Fix first plus two or more Worth a look, **or** four or more Worth a look. Overall number = `clamp(max(mean, 70), 70, 100)`.

**Anti-padding rules:**

- If all available signals are Keep, the overall band **must** be Reads like you. It is a bug if such a draft lands in a higher band.
- Never raise a score to "give the user something to work on." Never add filler tells.
- A single stock-list hit, one slightly even paragraph, or one weak topic sentence is not enough for a mid or high overall band.
- When most signals are `insufficient` (short but legal 120-word paste), cap overall at 39 and say we did not have enough text to be confident, not that the draft is fine or not fine.
- ESL and steadily formal writing: do not treat a limited vocabulary or a consistently formal register as stock phrases or as a tone "shift." The honesty disclaimer stays visible.

Unit-test these rules with fixture drafts: a clean varied human-like fixture, a mildly generic fixture, and a stock-phrase-heavy fixture.

---

## 10. Voice check

Copy: **"Want even clearer results? Take this one-minute voice check."**

It is a short **typed** conversational intake (four questions) that builds a baseline of vocabulary, tone, and scholarly register. It reuses Stage 1 Block 4 voice-sample logic (`MIN_VOICE_SAMPLE_WORDS = 150`, paste blocked, same "we need your natural typing voice" note, same `StyleMetrics` computation). Completing it **creates a free account** (or attaches to the signed-in user) and writes `voice_profiles`. That profile sharpens signals 3 and 4 (and the register sub-measure). After scoring, offer to re-run the comparison signals on the current draft. It is also the funnel into the free first paper: "Your first paper is free. No card."

**The four questions:**

1. "Write about 150–300 words, no editing, about anything you care about, the way you'd text a friend who asked." (The Stage 1 sample; required; ≥ 150 words; paste blocked.)
2. "In three or four sentences, explain a topic you know well to a classmate." (Scholarly vs. casual register.)
3. "What's a word or phrase you rely on when you write, or one teachers often mark?" (Vocabulary awareness; short answer is fine.)
4. "When you write for school, do you sound casual, in-between, or formal — and is that on purpose?" (Tone / register; short answer.)

Show a friendly readout, same spirit as Stage 1: "Your natural voice: ~X words per sentence, grade-level Y, Z tone. Your go-to words: …"

If a `voice_profiles` row younger than 180 days already exists when the student later starts a paper, Stage 1 Block 4 may offer "Use my voice check" or "Write a new sample."

---

## 11. API route and JSON schema

`POST /api/ai-checker/analyze` (route handler, `runtime = 'nodejs'`, Zod-validated body). No new env vars. Use the existing Grok client (`baseURL: "https://api.x.ai/v1"`, `GROK_API_KEY`).

`MODEL_FAST` (`grok-4.3`, `reasoning_effort: "none"`) for short classification (tone-shift quotes, light labeling). `MODEL_STRONG` (`grok-4.7`, `reasoning_effort: "low"`) for topic-sentence and personal-specifics judgments. Timeouts: 8 s fast, 30 s strong, same as the stage specs. On timeout or error, log `ai_fallback` and return deterministic signals plus `partial: true`; never block with a blank page. Guard every model output: reject rewrites, alternate sentences, or "try this:" completions; retry once; then fall back.

Structured output: `response_format: { type: "json_schema", json_schema: { name: "ai_checker_judgment", strict: true, schema } }`, then Zod. If the schema is rejected (HTTP 400), retry with `json_object` + Zod.

**Request (Zod):** `{ text: string, voiceProfileId?: string, utm?: { source?, medium?, campaign?, content?, term? } }`.

**Response (shape the UI consumes):**

```ts
{
  rubricVersion: "1.0",
  wordCount: number,
  overall: {
    strength: number,          // 0–100, after calibration
    band: "low" | "moderate" | "high",
    label: "Reads like you" | "A few generic spots" | "Several machine-like patterns",
    headline: string           // e.g. "Your draft reads fine"
  },
  signals: [{
    id: "sentence_length_variance" | "burstiness" | "vocabulary" | "tone_consistency" | "topic_sentences" | "personal_specifics" | "stock_phrases",
    strength: number | null,   // null if needs_voice or insufficient
    status: "scored" | "needs_voice" | "insufficient",
    band: "low" | "moderate" | "high" | null,
    label: "Keep" | "Worth a look" | "Fix first" | null,
    tells: [{ quote: string, note: string, sectionId?: string }],
    coachingQuestion: string
  }],
  sections: [{
    id: string,
    title: string,
    strength: number,
    band: "low" | "moderate" | "high",
    label: "Keep" | "Worth a look" | "Fix first",
    signalIds: string[]
  }],
  preview: { topSignalIds: [string, string?] },
  locked: boolean,             // true until email gate or signed-in session
  reportToken?: string,        // only after unlock
  partial: boolean,
  disclaimer: string
}
```

Quotes must be verbatim substrings of the submitted text (enforce in code, same spirit as Stage 2 slot filling). Coaching questions are selected from a small fixed bank per signal, optionally filled with a verbatim slot; the model must not invent a rewrite.

`POST /api/ai-checker/unlock` — email, age band, marketing consent, UTM, preview report id. Creates `ai_checker_leads` + `ai_checker_reports`, sends the email, returns the full result and token.

`POST /api/ai-checker/voice` — the four answers; requires or creates a session; writes `voice_profiles`; may return updated comparison signals.

`GET /api/ai-checker/unsubscribe` — marketing suppression for that lead.

---

## 12. Supabase tables

Additive migration `supabase/migrations/0003_ai_checker.sql`. RLS on; users read only their own rows; service role for anonymous report creation and email. No new env vars.

```sql
create table rubric_versions (
  version text primary key,               -- '1.0'
  published_at timestamptz not null default now(),
  changelog text not null,
  signals jsonb not null                  -- public snapshot of the rubric
);

create table ai_checker_runs (            -- anonymous / aggregate; NO draft text, NO quotes
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  rubric_version text not null references rubric_versions(version),
  word_count int not null,
  overall_strength int,
  overall_band text,
  signal_scores jsonb not null default '{}',  -- id -> strength only
  ip_hash text,                           -- HMAC-SHA256 of IP + day, key = CRON_SECRET
  user_id uuid references auth.users,
  partial boolean not null default false
);

create table ai_checker_reports (         -- operational store for preview/unlock/email, 30-day TTL
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  run_id uuid references ai_checker_runs,
  token_hash text not null unique,        -- sha256 of the secret token
  email text,
  user_id uuid references auth.users,
  result jsonb not null,                  -- full result including quoted tells; not the full draft
  unlocked_at timestamptz,
  emailed_at timestamptz
);

create table ai_checker_saved_runs (      -- only if signed in AND opted in
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  report_id uuid references ai_checker_reports,
  draft_text text not null,
  created_at timestamptz not null default now()
);

create table ai_checker_leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  email text not null,
  user_id uuid references auth.users,
  source text not null default 'ai-checker',
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  marketing_consent boolean not null default false,
  marketing_consent_at timestamptz,
  unsubscribed_at timestamptz,
  age_band text not null,                 -- '13-17' | '18+'
  report_id uuid references ai_checker_reports
);

create table voice_profiles (             -- one per user; baseline for signals 3 and 4
  user_id uuid primary key references auth.users on delete cascade,
  sample_text text not null,
  answers jsonb not null default '{}',
  metrics jsonb not null,                 -- StyleMetrics
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

Indexes: `ai_checker_runs (ip_hash, created_at)`, `ai_checker_leads (email)`, `ai_checker_reports (expires_at)`. RLS: `ai_checker_saved_runs` and `voice_profiles` by `auth.uid() = user_id`; leads and reports readable by the owner once `user_id` is set; otherwise service role only.

Retention cron (add `/api/cron/checker-retention`, still authed with `CRON_SECRET`): delete expired reports (and their quoted tells); never keep opted-out draft text after the user deletes it. Anonymous `ai_checker_runs` rows (counts and numeric scores only) may be kept for tuning.

---

## 13. Analytics events

Log to `session_events` (or a checker-specific event name in `detail`) without storing draft text:

`checker_viewed`, `checker_submitted`, `checker_preview_shown`, `checker_reads_fine`, `checker_partial`, `email_gate_submitted`, `report_unlocked`, `report_emailed`, `marketing_consent_yes`, `marketing_consent_no`, `unsubscribe`, `voice_check_started`, `voice_check_completed`, `account_created_from_checker`, `cta_free_paper_clicked`, `rubric_viewed`, `report_printed`, `rate_limited`, `ai_fallback`.

---

## 14. Rate limits and word limits

- **Words:** min **120** (same floor as mismatch evaluation), max **4,000**.
- **Anonymous, per `ip_hash`:** 5 analyzes / hour, 15 / day.
- **Unlocked or signed-in:** 10 / hour, 30 / day.
- **Voice-check completions:** 3 / user / day.
- **Report emails:** 1 per unlock, cap 10 / email / day.
- Over limit: HTTP 429, plain message "That's the limit for now — try again in an hour," no model call.

Enforce on the server with the runs table. Fail closed if the table write fails.

---

## 15. Privacy and age (implementation)

- Process the draft in memory. Persist full `draft_text` only in `ai_checker_saved_runs` when the user is signed in and opts in.
- `ai_checker_reports.result` may include quoted tells for 30 days so the private link and email work; then delete.
- Never send drafts or reports to a training API, a third-party detector, or a fine-tune job. Grok inference is request-response only, for scoring and coaching questions.
- IP is stored only as a daily HMAC (`CRON_SECRET` as the HMAC key — no new env var).
- Under 13: no account, no report, no lead.
- 13–17: transactional report only; `marketing_consent` forced false; do not send tips.
- Update `/privacy` with the paste-box line and a pointer to this tool. Terms already require age 13+; the email gate must enforce it, not only the signup form.

---

## 16. FAQ (ship on the page)

Use marketing FAQ 1–6, with FAQ 4 already correctly defining high / moderate / low as pattern strength. Add FAQ 6 clarifications (typed baseline; creates a free account) and this privacy answer, which the landing copy can paste as **question 7**:

**7. What happens to the draft I paste?**
Drafts aren't stored unless you are signed in and opt in. We never use drafts for training. You can check a draft with no account. If you enter your email for the full report, we keep the scores and the short quoted lines in a private link for 30 days so you can reopen it, then we delete them. We do not keep the full text unless you have an account and ask us to save it. You must be 13 or older to use the tool.

Also add, if space: **8. Do I need an account?** No, not to check a draft and see a preview. Your email unlocks the full report. The optional voice check creates a free account so we can save your writing baseline. Your first paper is free and we do not ask for a card.

Update FAQPage JSON-LD to include question 7.

---

## 17. Acceptance-criteria checklist (product)

- [ ] `/ai-checker` and `/ai-checker/rubric` render; rubric shows v1.0, the seven signals, thresholds, and a changelog.
- [ ] Paste of < 120 words or > 4,000 words is rejected with a clear message and no model call.
- [ ] A clean fixture draft returns **Your draft reads fine** / Reads like you; a stock-phrase-heavy fixture returns the high band; a mixed fixture can land in the middle. Unit tests lock this.
- [ ] Each tell quotes verbatim student text and a coaching question; no rewritten sentence appears in the UI or the model output (guard tests).
- [ ] Vocabulary signal is `needs_voice` until a voice profile exists; after the voice check, comparison signals use the baseline.
- [ ] Voice check: four questions, 150-word paste-blocked sample, free account created, `voice_profiles` written, funnel into the free first paper.
- [ ] Preview vs. full report and email gate behave as in section 5.3; 13–17 cannot opt into marketing; CAN-SPAM footer and unsubscribe work on marketing mail.
- [ ] Report design criteria in section 5.7 all pass.
- [ ] Rate limits enforced; IP hashed; drafts not in `ai_checker_runs`.
- [ ] No banned phrases ("bypass," "beat Turnitin," "undetectable," "pass AI detection," "humanize") in UI copy.
- [ ] Disclaimer visible on the landing page, in the report, in the email, and on the print view; Liang et al. (2023) cited correctly.
- [ ] Fallback still returns deterministic signals if Grok fails.

---

## 18. Sources cited

- Liang, W., Yuksekgonul, M., Mao, Y., Wu, E., & Zou, J. (2023). GPT detectors are biased against non-native English writers. *Patterns*, 4(7), 100779. https://doi.org/10.1016/j.patter.2023.100779 — seven detectors; 91 TOEFL essays; average false-positive rate **61.3%**; U.S. eighth-grade essays classified much more accurately.
- Chechitelli, A. (2023, June 14). Understanding AI writing detection: False positive rates. Turnitin. https://www.turnitin.com/blog/understanding-the-false-positive-rate-for-sentences-of-our-ai-writing-detection-capability — Turnitin reports a document-level false-positive rate under 1% (for documents with 20% or more AI writing) and a sentence-level rate around 4%, and tells instructors not to treat the indicator as a conclusion.
- Kobak, D., González-Márquez, R., Horvát, E.-Á., & Lause, J. (2025). Delving into LLM-assisted writing in biomedical publications through excess vocabulary. *Science Advances*, 11(27), eadt3813. https://doi.org/10.1126/sciadv.adt3813 — excess style words in 2024 PubMed abstracts, including *delves* (about 28×), *underscores*, and *showcasing*; the authors treat this as corpus-level evidence, not proof about a single text.
- GPTZero. Perplexity, burstiness, and statistical AI detection; and "How do I interpret burstiness or perplexity?" https://gptzero.me/news/perplexity-and-burstiness-what-is-it — original statistical layer; **as of autumn 2023 GPTZero no longer uses perplexity and burstiness**, having moved to a deep-learning classifier. Our burstiness signal is a documented length/rhythm proxy, not their retired metric.
- Additional context (do not overclaim): stylometric work finding more uniform sentence rhythm in some model outputs; professional-editing / formal-register studies showing detector scores can move with polish rather than authorship (e.g. later work on editing style as a confound). Formal and ESL writing remain known false-positive risks.

This tool claims **no accuracy rate** of its own.

---

## 19. Signals from the Angie Simmons paper review: pending; the owner will paste Grok's review to fold in.

When that review is pasted, fold any additional named tells into the existing seven signals (or, if something truly new is needed, ship it as rubric v1.1 with a changelog entry). Do not add an eighth top-level signal in v1.0 — the marketing "seven writing signals" claim must stay true.

---

## 20. Open questions

Most product decisions above are locked so Cursor can build. Remaining, none of which should block v1.0:

1. Should a voice-check re-score happen automatically on the same draft, or only after a button press? **Default if unset: a button, "Re-check with my voice baseline."**
2. PDF library (`@react-pdf/renderer` vs. a print-to-PDF link only). **Default: printable HTML report + a server-generated PDF attachment if it stays within Vercel limits; otherwise the email links to the printable report and a "Download / Print PDF" action.**
3. Whether Stage 1 should auto-offer "Use my voice check" (recommended above) needs a one-line confirm when Stage 1 is implemented.
4. After ~50 runs, who signs off on threshold retuning (target 40–60% "reads fine")? Recommended: Paper Coach + the owner, using `/admin/sop` aggregates only.

No other blockers. Build v1.0 with the defaults.
