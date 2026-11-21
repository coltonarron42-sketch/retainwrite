# RetainWrite — Free AI Checker Spec (companion to `retainwrite-cursor-build-prompt.md` and `retainwrite-stage-specs.md`)

**Route:** `/ai-checker` (App Router: `app/(marketing)/ai-checker/page.tsx`). **Canonical URL:** `https://www.retainwrite.com/ai-checker`. The apex `https://retainwrite.com/ai-checker` 308-redirects to www (domain-level redirect in Vercel; www is the primary domain). Supporting routes: `https://www.retainwrite.com/ai-checker/rubric` (public, versioned rubric) and, for signed-in opt-in saves only, `https://www.retainwrite.com/ai-checker/report/[token]`.
Build phase: **Phase 11 in `retainwrite-cursor-build-prompt.md`**, run right after the Stage 1 paste-gate fix and Stage 1 rewrite.
Landing copy (Paper Coach Marketing): `/workspace/retainwrite/ai-checker-landing-copy.md` (reconciled in section 6.3; conflicts flagged there).
Rubric version at launch: **v1.0**.

**This is a standalone lead-capture and credibility landing page. It is NOT part of the six-stage coaching flow.** It has no stage gates, no `stage_progress` rows, and no paper. It never calls `assertStageUnlocked`. Its only links into the app are the account created at the email step and the **Start your free first paper** CTA. This doc is complete on its own: a developer can build the checker from this file plus the shared stack conventions (build prompt section 0).

Where this doc conflicts with the build prompt, **this doc wins** for the checker. Existing product rules still hold: coaching only, `lib/ai/guard.ts`, no detector-evasion framing, Grok via `https://api.x.ai/v1` (`openai` SDK, `GROK_API_KEY`), Zod-validated `json_schema` output. Migrations: `0003_ai_checker.sql` (existing) plus the additive `0007_ai_checker_standalone.sql` (section 12.1; 0005 and 0006 are Stage 1). Env vars: no new required names; one **optional** pair for the visible challenge is a decision for the owner (section 14).

---

## 0. Locked meanings (do not reinterpret)

**(a) Ratings are pattern strength, not authorship probability.** `high` / `moderate` / `low`, and the 0–100 **Signal strength** number, describe how strongly a writing pattern shows up in the text. They are **not** a probability that AI wrote the text, a chance of being flagged, or a verdict about cheating. Never label a number "AI likelihood," "AI %," or "chance AI wrote this."

**(b) The voice check builds a baseline.** The 1-minute voice check captures the student's own vocabulary, tone, and scholarly register (typed writing voice, not a spoken recording). That baseline is what "vocabulary vs. your own writing" and register comparisons run against.

**(c) Accounts.** Running a check needs **no account and no login**. A student can paste a draft and see a preview with no signup. Unlocking the full report asks for an email, age confirmation, and terms acceptance; that email step **creates a free RetainWrite account** (Supabase magic link, delivered through Resend) and the account comes with the **free first paper** (all six stages, no audio, no card), matching pricing. If the email already has an account, it just gets a sign-in link, and the free paper only if it's still unused. The optional voice check attaches a writing baseline to that account.

**(d) Privacy line (use this wording, or a close paraphrase, on the page, in the report, and in the FAQ):**

> Drafts aren't stored unless you are signed in and opt in. We never use drafts for training.

**Analyze in memory only.** The pasted draft (and the optional writing sample) is processed in memory to produce the report, then discarded. The server stores only **anonymous aggregate metrics** (word count, numeric signal scores, band, flags; no text, no quotes). Quoted lines live only in the student's browser and in the report email sent to them. Nothing with draft text is stored on our servers unless the student is **signed in and opts in** ("Save this report to my account"). Users must be 13+. (This replaces the earlier 30-day stored-quotes link; see section 6.3 for the FAQ 7 conflict.)

---

## 1. Purpose and positioning

**Positioning line (locked with marketing):** **Does this sound like you?**

The student pastes a draft and gets an honest, named-tell readout of seven documented writing signals, plus a coaching question for each tell. It is a free coaching tool for people searching for an "AI detector for student papers." It is **not** a ghostwriter, a rewriter, a "humanizer," or a verdict machine.

Frame, everywhere (UI, emails, SEO body copy, social):

> Does this sound like you? See which parts read generic or machine-like, and why.

Allowed in the title tag, the **H1**, an H2, and keywords, because it is the search term: "AI detector for student papers." The H1 is fixed: **"AI Detector for Student Papers: Does It Sound Like You?"** Any use of "detector" is immediately framed as: this tool rates writing patterns; it does not prove who wrote something. Never in buttons or CTAs ("Run the detector," "Detection score"). Banned in copy, UI, and SEO: "bypass," "beat Turnitin," "undetectable," "pass AI detection," "humanize," "make this undetectable."

Public-facing marketing uses the name **Retain and Write**; code, table names, and technical docs use **RetainWrite**. Both refer to retainwrite.com.

---

## 2. Non-negotiable guardrails

- **Coaching only.** The tool never rewrites, paraphrases, "humanizes," or offers alternate sentences. `lib/ai/guard.ts` applies to every model call. Each named tell comes with a coaching question (for example, "What happened to you that shows this?"), never replacement text. Add `// SOP: coaching only, never generate submission text` at every AI call site.
- **No detector-evasion framing** in copy, UI, emails, or SEO (see section 1).
- **Prominent honesty disclaimer**, visible in the **report itself** (not only on the landing page), near the summary ring and again in the footer:

  > No tool, including this one or Turnitin or GPTZero, can prove whether AI wrote something. These results are style signals, not a verdict. False positives are real, especially for ESL writers and very formal writers.

  Cite Liang et al. (2023) on the landing page, rubric page, and FAQ (section 18). Turnitin itself tells instructors to use its indicator to start a conversation, not to draw a conclusion, and reports a sentence-level false-positive rate of about 4% (Chechitelli, 2023).
- **Privacy** as in section 0(d). Under-13 users are not allowed. Ages 13–17 may receive the report but must not be added to marketing lists.
- **Abuse limits:** per-IP and per-account rate limits, plus BotID, a challenge after 3 checks, and word/character limits (section 14).
- **Do not pad results to create alarm.** If the signals are low, the report must say the draft reads fine (section 9).
- **Never force, randomize, or quota outcomes.** Every result is a deterministic function of the submitted text (plus the optional sample), the rubric version, and the model's judgments. The "about half come back clean" goal is met only by **honest calibration** on a calibration set of real student writing (section 9). The live clean rate is a **monitored metric**, never a target the code steers toward. No per-request adjustment, no random draw, no A/B test of scores.
- **The overall headline is "Signal strength," never "likelihood of AI."** The owner asked for an "overall likelihood headline"; we use Signal strength so the number stays honest. The two are not interchangeable.

---

## 3. User flow

1. Student lands on `https://www.retainwrite.com/ai-checker` (no account, no login).
2. Pastes a draft into the clean submit box: min **120** words, max **4,000** words and **30,000 characters** (whichever hits first). Live word + character counter.
3. **Optional:** opens **Add a sample of your own writing (optional)** and pastes or types 150–1,500 words (max 10,000 characters) of something they wrote themselves (an older paper, a discussion post, an email). If they are signed in with a `voice_profiles` row, that baseline is used automatically and the field says so. With no sample and no baseline, the vocabulary signal is **N/A** and its weight is renormalized away (section 8).
4. Clicks **Check my draft**. Server: BotID check, rate limits, and (if needed) the visible challenge (section 14); validates length; strips quotes/citations/references the same way Stage 6 mismatch does; computes deterministic metrics; calls Grok for the judgment signals. Skeleton loading with staged progress copy (section 5.5).
5. **Free preview:** the overall result (ring + Signal strength + headline, or **Your draft reads fine**) plus the **top 2** signals by strength, each with its quoted examples. Disclaimer visible. The other five signals show as locked cards (name only).
6. **Email gate:** "Enter your email to get your full report." Email, age band (13–17 / 18+; under 13 blocked), required terms checkbox, and an unchecked-by-default marketing checkbox (hidden for 13–17). Copy states that this creates a free account with a free first paper.
7. On submit: unlock the full report on the page **immediately**; email the full report (HTML + PDF) with a magic-link button **Start your free first paper**; create the account (section 5.3).
8. **Full report:** all seven signals (or six + vocabulary N/A), per-section breakdown, **Your draft, highlighted** view (section 5.8), quoted tells, coaching questions, disclaimer, link to the public rubric (v1.0).
9. **Bottom of the report:** **Start your free first paper** and the optional voice-check upsell.
10. Signed-in users skip the email gate (still offered **Email me a copy** and **Save this report to my account**).

If the draft is under the minimum or over the maximum, do not run the model. Show a clear error: "Paste at least 120 words." / "Paste up to 4,000 words (about 8 pages). For a longer paper, check one section at a time."

---

## 4. Page layout

### 4.1 `/ai-checker`

Use the heading structure and body copy in `/workspace/retainwrite/ai-checker-landing-copy.md`, with the copy-alignment fixes in section 6.

1. **Hero.** H1 (exact): **AI Detector for Student Papers: Does It Sound Like You?** Subhead from the landing copy, primary CTA **Check my draft** (smooth-scrolls to the paste box, or the box sits in the hero on mobile), microcopy: "Free. No account needed to check. No card required. Ratings measure writing patterns, not who wrote it — no tool can prove that."
2. **What the checker looks at.** The seven signals, each in one line, plus a link to the public rubric (v1.0).
3. **What you get back.** Named tells, coaching questions, and that many drafts come back "reads fine."
4. **What no detector can tell you.** Liang et al. (2023) + formal-writing caveat.
5. **Paste box (the clean submit box).** One large textarea, label "Paste your draft (120 to 4,000 words)", live word and character readout, a collapsed **Add a sample of your own writing (optional)** disclosure with its own textarea and helper ("Something you wrote yourself. It sharpens the vocabulary signal. Not stored."), the **Check my draft** button, and the privacy line from section 0(d) right under the button. Nothing else competes with it. On mobile the paste box is in the first viewport.
6. **Results panel.** Preview or full report (section 5). The honesty disclaimer is inside this panel.
7. **Email gate** (after preview, if locked).
8. **Voice-check upsell** and **Start your free first paper** (after the report, or after preview as secondary links).
9. **FAQ** (section 17), including the privacy answer.
10. **Footer disclaimer** (marketing section 6 wording is fine).

### 4.2 `/ai-checker/rubric`

Publish the full v1.0 table (section 7), the signal weights and the renormalization rule (section 8), the calibration method and calibration-set summary (section 9.1, including "We never adjust a single result"), a short changelog, and this note:

> This rubric is public and versioned. It will be updated as writing tools and detection methods evolve. Changes ship under a new version number and are listed below.

Link back to the checker. Do not hide thresholds.

### 4.3 `/blog` and `/blog/[slug]`

Built in Phase 12 of the build prompt, right after this checker (Phase 11). Marketing supplies posts. The checker is not blocked on the blog existing; hide any blog links until `/blog` ships.

### 4.4 `/ai-checker/report/[token]` (signed-in, opt-in saves only)

Exists only for reports a signed-in student chose to **Save this report to my account**. Requires the owner's session (RLS), token unguessable, no expiry until the student deletes it. Includes the disclaimer. Anonymous and just-unlocked reports are not stored, so they have no link: their **Print / Save as PDF** action prints the in-page report (`@media print`), and the email carries the HTML + PDF copy. No chat-bubble UI anywhere on these routes.

### 4.5 SEO metadata

- `<title>`: **AI Detector for Student Papers: Does It Sound Like You?** (55 chars). H1 is the same text.
- Meta description (from landing copy, ≤ 155 chars): "Paste your draft and get a 0–100 signal-strength score on seven writing signals, with quoted lines and coaching questions. Free to check, no account."
- Canonical: `https://www.retainwrite.com/ai-checker`. `metadataBase = new URL("https://www.retainwrite.com")`.
- Open Graph + Twitter card: same title/description, `og:url` canonical, 1200×630 image generated with `next/og` (`opengraph-image.tsx`) showing the title and a sample ring labeled "Signal strength" (never "AI %").
- JSON-LD: `FAQPage` (the shipped FAQ, section 16) and `WebApplication` (`applicationCategory: "EducationalApplication"`, `offers.price: "0"`). No `aggregateRating` (we have none).
- `robots`: index, follow for `/ai-checker` and `/ai-checker/rubric`; `noindex` for `/ai-checker/report/*`. Add both public URLs to `sitemap.ts`.
- Internal links: the page links to `/ai-checker/rubric` ("See the public rubric, v1.0") in the signals section, in the report header, and in the footer disclaimer. The rubric page links back.

### 4.6 Routing and the www canonical

www is canonical. Configure in Vercel: `www.retainwrite.com` is the primary domain; `retainwrite.com` redirects to it with **308** (preserves method and body). Do not add a second redirect in `middleware.ts` (avoid loops). All absolute URLs (canonical, OG, sitemap, email links, magic-link `redirectTo`) use `https://www.retainwrite.com`. Server-to-server webhooks must target www directly (Stripe does not follow redirects; see build prompt).

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

**Headline rules (exact):**

- Every report's overall block is titled **Signal strength** (never "likelihood of AI," "AI score," or "AI %").
- **Clean (0–39):** the big headline is **"Your draft reads fine"**. The ring shows a check icon and "Reads like you"; the number appears as secondary text ("Signal strength 18 of 100 · low"). No mid-band number is ever shown for a clean draft (the count rules cap it at 39).
- **40–69:** headline "A few spots worth a look" with the number in the ring.
- **70–100:** headline "Several patterns to fix first" with the number in the ring.

Directly under the headline, one line says what to do: clean → "Keep doing what you're doing. Nothing here needs fixing first." Otherwise → "Start with: {top Fix first or Worth a look signal}." Do not bury the headline.

There is still no "score out of 100 that you passed or failed," and no authorship verdict. The number is pattern strength. Marketing copy that said "there is no score out of 100 and no verdict" must be revised (section 6).

### 5.2 Color, icons, and labels (never color alone)

| Strength | Band | Icon | Label | Color role |
|---|---|---|---|---|
| 0–39 | low | green check | **Keep** | sage green |
| 40–69 | moderate | amber circle / eye | **Worth a look** | amber |
| 70–100 | high | coral/red flag | **Fix first** | coral |

Meet **WCAG AA**: body text and labels ≥ 4.5:1 against the page background; large numerals and icons ≥ 3:1. Use darker ink tints for text on the warm off-white; use the brighter green/amber/coral only as fills or icon accents, not as small text. Every state pairs **icon + text label + number**. Do not rely on color alone.

Each flagged item (Worth a look or Fix first) is a collapsed row that expands to (1) the quoted tell from the student's own text and (2) one coaching question. Keep items can expand too, but start collapsed and do not demand attention.

### 5.3 Email gate, account, and the free first paper

The free preview shows the overall result (ring, Signal strength, headline) plus the **top 2** signals (name, strength, icon, label, and their quoted examples). Ties break by fixed signal order. Below them, the other signals appear as locked cards (name + lock icon). Line: "The other five signals, the highlighted draft, and the section-by-section view are in your full report."

Unlock copy: **"Enter your email to get your full report."**

Form fields:

- Email (required).
- Age: "I am 13 or older" (required) and a choice of **13–17** or **18+**. Under 13: block with "You must be 13 or older to use RetainWrite." No lead, no account.
- **Terms** (required checkbox): "Create my free RetainWrite account. I agree to the Terms and Privacy Policy." (links). Helper: "Your first paper is free. No card."
- Marketing consent, **unchecked by default**: "Also send me occasional writing-coach tips. This is optional and separate from your report." Hidden for 13–17 and stored as `false`.
- Submit: **Send my full report**.

On submit (`POST /api/ai-checker/unlock`, section 11):

1. Verify the sealed result (section 11) and that it's unexpired. Unlock the full report on the page right away; the student doesn't wait for email.
2. **Create the account:** server-side `supabase.auth.admin.generateLink({ type: "magiclink", email, options: { redirectTo: "https://www.retainwrite.com/app/papers/new?from=checker" } })`. This creates the auth user if it doesn't exist (the existing trigger inserts `profiles`), sets `terms_accepted_at`, and returns the magic link. Existing users get a sign-in link only. Never create a second account for the same email.
3. **Free first paper:** a new profile has `free_paper_used = false`, so the existing entitlement helper (`lib/entitlements.ts`) grants the free first paper (all stages, no audio, no card) on **Start new paper**. No credits or purchases are written here. Existing users keep whatever they have; if their free paper is used, the CTA goes to the normal paywall/pricing. 13–17 accounts still go through the guardian-consent gate (stage specs decision 17) before the first paper; say so in the email.
4. **One email** via Resend from `RetainWrite Coach <coach@send.retainwrite.com>`: subject "Your RetainWrite writing-signals report"; HTML body with the headline, all signals, quoted tells, coaching questions, the disclaimer, the public-rubric link, a PDF attachment rendered in memory, and the magic-link button **Start your free first paper**. It's transactional, so it's sent even when marketing is declined. Supabase's own confirmation email is not sent for this path (we deliver the magic link ourselves). Supabase Auth SMTP should still point at Resend for normal signups.
5. Write `ai_checker_leads` (email, user id, age band, consent, UTM). No draft text, no quotes.

Marketing emails (only if consented and 18+) include a visible unsubscribe link and the physical address **3629 Maizeland Rd, Colorado Springs, CO 80909** (CAN-SPAM; same address as the growth-ops doc).

### 5.4 Bottom CTAs

After the full report (and visible on the print view as links, not as a second sales page):

1. Upsell: **"Want even clearer results? Take this one-minute voice check."** Subcopy: "We'll build a baseline of your vocabulary, tone, and scholarly register, then re-score the comparison signals. Creates a free account. No card."
2. **"Start your free first paper"** → `/app/papers/new?from=checker` when signed in, otherwise the magic link from the report email (or `/signup` if they never unlocked). Free first paper, no audio, no card.

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
| Print / share | `@media print` on the in-page report (`/ai-checker`) and on saved `/ai-checker/report/[token]`: white background, no gate, no nav, disclaimer included. |

No chat-bubble UI, no avatars, no "the coach is typing." This is a report, not a messenger.

### 5.6 Named components

- `ReportSummaryRing` — 0–100 ring, band, plain-language summary, tooltip, footnote, disclaimer adjacent.
- `SignalCard` — name, strength, icon, Keep / Worth a look / Fix first, expandable quoted tell + coaching question.
- `SectionHeatmap` — per-section strength for each signal or an aggregate per section; expandable tells scoped to that section.
- `EmailGate` — preview-to-full unlock form.
- `UpsellPanel` — voice check + free-first-paper CTAs.
- `HighlightedDraft` — the student's own text with highlighted spans per tell (section 5.8). Client-only.
- `SubmitBox` — draft textarea, optional writing-sample disclosure, counters, privacy line, submit.
- `Disclaimer` — the honesty disclaimer with the Liang et al. (2023) citation link.

### 5.8 Highlighted examples (quotes only, never rewrites)

Every tell carries a verbatim `quote` plus `start` / `end` character offsets into the submitted text (verified in code: `text.slice(start, end) === quote`; drop the tell if not). The full report adds **Your draft, highlighted**: the student's own text, rendered from the copy still in their browser (never re-fetched from the server), with each tell's span underlined and tinted by band, paired with a small icon and a numbered marker (not color alone). Tapping a marker opens the signal name, why it fired, and the coaching question. A "Keep" filter can show what's working (for example, a paragraph with strong personal specifics gets a green "Keep" marker), so the student sees what to keep as well as what to fix.

Never show replacement text, alternate sentences, "try this" suggestions, or a rewritten version. Quotes are capped at 2 sentences / 300 characters each, max 3 per signal.

### 5.9 Voice-baseline note (Colton, Nov 20, 2026, t45; softer wording t46; hybrid threshold t51)

**What:** when the voice baseline used for the comparison signals came from text that was mostly or entirely **pasted** (not typed or spoken), show one kind, factual note at the **very bottom of the report**, below every score and the highlighted draft, above only the disclaimer/footer. It never interrupts, replaces or recolors the main score or headline. No warning icon or amber color: plain body text, with a small ℹ︎ info icon at most. It's not in the preview's top area.

**Wording (t46 soft style; t51 adds short and low variants; t47's `VOICE_NOTE_ANSWERS_ALL` is retired):**

| Key (`lib/copy/voiceNotes.ts`) | When | Exact text |
|---|---|---|
| `VOICE_NOTE_ANSWERS` (t46, kept) | Answers; lighter read, paste cause (`enough` or `thin` tier with `pastedShare > 0.60`) | “Your voice answers were mostly pasted in, which is totally fine. Typed or spoken answers help us understand your voice better, so treat the voice comparison as a lighter read.” |
| `VOICE_NOTE_ANSWERS_SHORT` (t51, new) | Answers; lighter read, short cause (`thin` tier, `pastedShare ≤ 0.60`) | “We only had a little of your typed or spoken voice to go on, which is totally fine. More typed or spoken answers help us understand your voice better, so treat the voice comparison as a lighter read.” |
| `VOICE_NOTE_ANSWERS_LOW` (t51; replaces t47's `VOICE_NOTE_ANSWERS_ALL`) | Answers; `low` tier | “Most of your voice came in pasted, or there wasn't much of it, which is totally fine. We couldn't reliably read your voice from it, so treat the voice comparison with lower confidence.” |
| `VOICE_NOTE_SAMPLE` (t46, kept) | Public writing sample; lighter read, paste cause | “Your writing sample was pasted in, which is totally fine. A typed or spoken sample helps us understand your voice better, so treat the voice comparison as a lighter read.” |
| `VOICE_NOTE_SAMPLE_SHORT` (t51, new) | Public writing sample; lighter read, short cause | “Your writing sample was on the short side, which is totally fine. A longer typed or spoken sample helps us understand your voice better, so treat the voice comparison as a lighter read.” |
| `VOICE_NOTE_SAMPLE_LOW` (t51, new) | Public writing sample; `low` tier | “Most of your sample came in pasted, or it was short, which is totally fine. We couldn't reliably read your voice from it, so treat the voice comparison with lower confidence.” |

Colton's t45 wording (“Voice was not reliably determined…”) stays retired. The notes never say “unreliable,” “less confidence,” “pasted instead of,” or anything that implies wrongdoing. **Colton-approved exception (t47 → t51):** the two `…_LOW` notes say “couldn't reliably read” and “lower confidence”, as he asked for the low-voice case; they're the only notes allowed to.

**Which baseline it looks at (scoped by surface):**

| Surface | Baseline whose paste share is checked |
|---|---|
| Standalone `/ai-checker` with the optional writing sample | The writing-sample box (`sampleInputMeta` sent with the request; nothing stored) |
| Standalone `/ai-checker`, signed in, no sample, using `voice_profiles` | The profile's answers: pasted share = `1 − voice_profiles.typed_word_share`; `naturalWords` = `voice_profiles.natural_words` (t51) |
| Any in-app voice check, and the Stage 6 voice comparison | The paper's counted answers (t51): Stage 1 voice answers plus Stage 2–4 conversational answers (`papers.natural_voice_words`, `papers.voice_pasted_share`; stage specs 2B.10) |

**Threshold:** ~~`pastedShare > 0.60` alone (t45); ≥ 0.95 all-pasted (t47)~~ superseded by the hybrid rule below (t51).

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

**Public writing sample (same logic on the sample):** `naturalWords` = the sample's typed + spoken words (from `sampleInputMeta`), `pastedShare` over the sample. The sample's 150-word minimum means a fully typed 150–199-word sample lands in `thin` and gets `VOICE_NOTE_SAMPLE_SHORT`; a fully pasted sample of any length lands in `low` (`VOICE_NOTE_SAMPLE_LOW`).

**Typed vs. spoken vs. pasted:** `typedChars` includes keyboard input, autocorrect/predictive text, OS dictation (it arrives as `insertText` / `insertReplacementText`) and any in-app speech-to-text (`spokenChars`, added to typed). Only `insertFromPaste`, `insertFromPasteAsQuotation` and `insertFromDrop` count as pasted. Missing meta (no JS, older rows) counts as typed, so it never triggers the note.

**No baseline → no note.** If there is no sample and no profile, the vocabulary signal stays `needs_voice` / **N/A** exactly as today (section 7, weight renormalized) and this note is not shown. The note only appears when a baseline exists and is mostly pasted.

**Combined with backend weighting:** the same paste ratio drives the typed-weighted baseline (`w = 1 − 0.8 × paste_ratio`; Stage 1 spec 8.1a). With a sample, weighting is per paste event span: pasted spans get weight 0.2 and typed spans 1.0. If typed + spoken words in the baseline are under 150, comparison signals use the short-sample downgrade (no strong levels). The scores are honest about lower confidence, and the note says so in words.

**Where it appears:** the on-page full report (bottom), the emailed HTML report and PDF (bottom, before the disclaimer), and the saved `/report/[token]` view. In the locked preview it appears only once the full report is unlocked, since the comparison signals aren't in the preview. Never in a modal, toast or banner.

**Response field:** `voiceBaseline: { source: "sample" | "voice_profile" | "none", pastedShare: number | null, typedWords: number | null, lowConfidence: boolean, note: string | null }`, where `note` is one of the six strings above for its source, or null. **t51 adds** `naturalWords: number | null` and `tier: "plenty" | "enough" | "thin" | "low" | null`.

**Aggregate (no text):** `ai_checker_runs.baseline_pasted_bucket text` (`none | 0-20 | 20-60 | 60-90 | 90-100`), added in 0007's alter block (if 0007 is already applied, ship it in the next free migration). Event `checker_voice_paste_note_shown { surface, bucket }`.

### 5.7 Report acceptance criteria

- [ ] Every score is labeled "Signal strength," never "AI likelihood" or similar.
- [ ] Tooltip and footnote explain the number in the wording above.
- [ ] 0–39 / 40–69 / 70–100 map to Keep / Worth a look / Fix first, each with icon + label + color.
- [ ] Color is not the only indicator; contrast meets WCAG AA.
- [ ] A calibrated-low draft shows "Your draft reads fine" or "Reads like you," not a padded mid score.
- [ ] Preview shows only the overall ring and top 2 signals until the email gate is completed (or the user is already signed in).
- [ ] Full report emails from `coach@send.retainwrite.com` (HTML + PDF + magic link); signed-in students can save it to `/ai-checker/report/[token]` by opting in.
- [ ] Marketing checkbox defaults unchecked, is separate from delivery, and is not offered to 13–17.
- [ ] Unsubscribe works on marketing mail.
- [ ] Disclaimer is visible in the on-page report, the emailed copy, and the printable view.
- [ ] Reduced-motion is respected; layout works at 320px width; report is keyboard-navigable.
- [ ] The overall block is titled "Signal strength"; a clean draft's headline is "Your draft reads fine" with no mid-band number.
- [ ] Highlighted spans match verbatim quotes and carry icon + marker, not color alone.
- [ ] (t45/t46, rule revised t51) The voice-baseline note (5.9) shows the exact soft text for its source and tier at the very bottom of the full report, email and PDF only when the hybrid rule calls for one (natural words + paste share); never above or inside the score area, never in a modal.
- [ ] Each band states what to do: Keep = keep it; Worth a look / Fix first = the coaching question.

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
4. **Account behavior is unstated.** Add: the checker needs no account; the email step creates a free account with the free first paper (updated Nov 20, 2026; previously the voice check created it).
5. **Privacy is unstated.** Add the privacy FAQ in section 17 (question 7) and the one-line privacy notice by the paste box.
6. **Brand name.** Copy says "Retain and Write"; the app and technical docs say "RetainWrite." Acceptable if marketing is standardizing the spaced name in public copy. Keep the domain retainwrite.com either way.
7. **"Detector" in the title, an H2, and keywords** is allowed for search intent, as the copy already frames the tool as not a verdict. Do not expand that wording into body CTAs ("Run the detector," "Detection score").

Assumptions in the landing copy that this spec **confirms:** (a) high / moderate / low = pattern strength, not authorship; (b) the voice check is a baseline of the student's own writing voice; (c) "reads fine" is a normal, desirable result.

---

### 6.3 Reconciliation with the landing copy (Nov 20, 2026) — conflicts to resolve

The landing copy is DRAFT v2 and marked PENDING COLTON CONFIRMATION for privacy (FAQ 7 and the paste-box line). This spec now differs in these places. **Marketing should patch after Colton decides; do not publish the conflicting lines.**

| # | Landing copy says | This spec now says | Status |
|---|---|---|---|
| 1 | H1 "Does this sound like you?" (heading structure: "Does this sound like you? An AI checker for student papers") | H1 = **"AI Detector for Student Papers: Does It Sound Like You?"** (matches the title tag the copy already uses) | Patch the H1; keep "Does this sound like you?" as the subhead lead or an H2. |
| 2 | **FAQ 7:** "If you enter your email for the full report, we keep the scores and the short quoted lines in a private link for 30 days…" | Analyze in memory only; the server stores only anonymous aggregate metrics; quotes are not stored; the email carries the full copy; saved reports exist only for signed-in opt-in | **CONFLICT, pending Colton.** Proposed FAQ 7 in section 16. |
| 3 | FAQ 6 / voice-check line: "The voice check creates a free account" | The **email step** creates the free account (with the free first paper); the voice check attaches a baseline to it | Patch FAQ 6 and the voice-check line ("Saves to your free account"). |
| 4 | "What you get back": email unlocks "all seven signals, a section-by-section view and a copy in your inbox" | Same, plus the highlighted draft; vocabulary may show N/A without a sample | Minor add. |
| 5 | Voice baseline only via the voice check | An **optional writing sample** field on the submit box also powers the vocabulary signal (not stored) | Add one line near the paste box. |
| 6 | Overall labels "Reads like you / A few generic spots / Several machine-like patterns" | Kept as ring labels; headlines are "Your draft reads fine" / "A few spots worth a look" / "Several patterns to fix first", under the title "Signal strength" | Compatible; align wording. |
| 7 | Paste-box privacy line ("Drafts aren't stored unless you are signed in and opt in. We never use drafts for training.") | Same wording | No conflict (still pending Colton's sign-off). |
| 8 | "No account needed to check" | Same | No conflict. |

## 7. Rubric v1.0 — seven writing signals

Starting thresholds, in the same spirit as the Stage 6 mismatch table in `retainwrite-stage-specs.md` section 7: published, unit-tested, and **set on a calibration set of real student writing** before launch (section 9). The thresholds below are the pre-calibration starting points; calibration may move them, and any move ships as a new rubric version with a public changelog. Every signal is scored **0–100 for strength** (how strongly the pattern shows up).

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

#### 3. Vocabulary vs. your own writing (deterministic, **needs a writing sample — optional**)

- **Definition:** Whether the draft's vocabulary and complexity match the student's own sample. Marketing: "Do the words match how you usually write?"
- **Measured:** Reuse `lib/style/metrics.ts` and the mismatch table in the stage specs (section 7): unseen content words (≥ 8 letters, not in the allow-list) at **> 12%** (tell) and **> 20%** (strong); sentence-length jump **+60% / +100%**; reading grade **+4.0 / +6.0**; formality **+0.35 / +0.50**. Allow-list: sample vocabulary, plus any assignment text the student pasted (none, on this standalone tool, unless they later start a paper). Direction: only upward jumps. If the sample is under 200 words, a "strong" sentence-length jump is treated as a tell, same as mismatch.
- **Baseline source, in order:** (1) the optional writing sample on the submit box (≥ 150 words; processed in memory, not stored); (2) the signed-in student's `voice_profiles` row. If both exist, the sample wins for this run, **except (t45, revised t51)** when the profile has the better voice-note tier under the hybrid rule (no note beats a lighter note, which beats the stronger note); then the profile is used. On a tie, the sample wins. Comparison metrics are typed-weighted the same way as Stage 1 (spec 8.1a), and the bottom note in 5.9 follows the hybrid rule for the baseline actually used.
- **Without a sample or baseline:** status = `needs_voice`, shown as **N/A**. **Do not score, do not treat as high, do not invent a comparison**, and remove its weight from the overall (renormalize, section 8). Card copy: "N/A — add a sample of your own writing to score this one." 
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

   **Weights (rubric v1.0, public on the rubric page):**

   | Signal | Weight |
   |---|---|
   | 1. Sentence-length variance | 12 |
   | 2. Burstiness | 12 |
   | 3. Vocabulary vs. your own writing | 16 |
   | 4. Tone consistency | 14 |
   | 5. Topic sentences | 14 |
   | 6. Personal specifics | 16 |
   | 7. Stock phrases | 16 |

   **Renormalization:** `weightedMean = Σ(wᵢ · sᵢ) / Σ wᵢ` over **scored** signals only. With no writing sample, vocabulary's 16 drops out and the other six are divided by 84 (not 100). Same for any `insufficient` signal. Unit-test that an N/A signal never lowers or raises the overall by its absence alone.
4. Band the 0–100 number: 0–39 Keep / low, 40–69 Worth a look / moderate, 70–100 Fix first / high.
5. **Overall strength** starts as the **renormalized weighted mean** of available signal scores, then is **constrained by the count rules in section 9** so the label and the number never disagree, and so a clean draft cannot be nudged into a mid band.

Per-section "section strength" is the mean of the signals available in that section (stock phrases, topic sentences, personal specifics, local length variance, local tone). Same 0–100 label and colors.

---

## 9. "Reads fine" calibration (do not pad)

The tool must often return **"Your draft reads fine"** / **Reads like you** when the patterns are weak. This is a success state.

**Count rules (decisive):**

- **Reads like you (0–39):** zero signals at Fix first, and at most **one** signal at Worth a look. Overall number = `min(39, weightedMean)`.
- **A few generic spots (40–69):** exactly one Fix first, **or** two or three Worth a look and zero Fix first. Overall number = `clamp(max(weightedMean, 40), 40, 69)`.
- **Several machine-like patterns (70–100):** two or more Fix first, **or** one Fix first plus two or more Worth a look, **or** four or more Worth a look. Overall number = `clamp(max(weightedMean, 70), 70, 100)`.

**Anti-padding rules:**

- If all available signals are Keep, the overall band **must** be Reads like you. It is a bug if such a draft lands in a higher band.
- Never raise a score to "give the user something to work on." Never add filler tells.
- A single stock-list hit, one slightly even paragraph, or one weak topic sentence is not enough for a mid or high overall band.
- When most signals are `insufficient` (short but legal 120-word paste), cap overall at 39 and say we did not have enough text to be confident, not that the draft is fine or not fine.
- ESL and steadily formal writing: do not treat a limited vocabulary or a consistently formal register as stock phrases or as a tone "shift." The honesty disclaimer stays visible.

Unit-test these rules with fixture drafts: a clean varied human-like fixture, a mildly generic fixture, and a stock-phrase-heavy fixture.

### 9.1 Honest calibration toward "about half come back clean"

The owner wants roughly half of submissions to come back **Your draft reads fine**. We get there **only by honest calibration**, never by forcing, randomizing, or steering results. State this on the rubric page: "We tune thresholds on real student writing so typical human drafts read fine. We never adjust a single result."

1. **Calibration set (before launch, stored as metrics only):** at least **300** real student drafts written without AI help, spanning high school, undergrad, and grad; including **≥ 60 ESL** writers and **≥ 60 steadily formal** papers (lab reports, literature reviews). Sources: drafts written before late 2022 (pre-ChatGPT) from consenting students or the owner's own archive, or openly licensed student-essay corpora, used under their license. Plus a smaller **contrast set** (≥ 100) of clearly AI-generated or heavily AI-assisted texts on similar prompts, labeled as such. Keep only per-signal numeric metrics in `checker_calibration_samples` (section 12.1); no text in the database. Text lives only in an offline, access-controlled calibration folder outside the app.
2. **Set thresholds** so that **typical human drafts land in Keep**: each signal's Keep upper bound is at or above the human set's **80th percentile** for that metric, and the overall "reads fine" rate on the human set is **≥ 80%**, with **≥ 75%** in the ESL and formal subsets (protecting against the known false-positive groups). Check that the contrast set lands mostly outside Keep; report that number on the rubric page as a description of the calibration set, never as an accuracy claim.
3. **Expected live clean rate:** real submissions mix untouched human drafts, edited drafts, and AI-assisted drafts, so the live share of "reads fine" is expected around **40–60%**. That's a forecast from calibration, not a quota.
4. **Monitored metric — clean rate:** `clean_rate = runs with overall band low / scored runs` (exclude `partial` and mostly-`insufficient` runs), daily and 7-day rolling, split by with/without sample. Shown on `/admin/sop` and the `ai_checker_daily_stats` view (section 12.1). If the 7-day rate leaves **30–70%** for two consecutive weeks, open a **review**: re-run the calibration set, inspect signal-level drift, and, if thresholds change, ship rubric **v1.x** with a public changelog. Never change thresholds to hit a number on live traffic alone, and never per request.
5. **Forbidden (code-review and test enforced):** random number use anywhere in scoring; any input to scoring other than the text, the optional sample/baseline, the rubric version, and the model's judgments; reading `clean_rate` from scoring code; per-user or per-time-of-day adjustments; A/B tests that change scores. A determinism test runs the same fixture twice (with model judgments mocked) and expects identical output.

---

## 10. Voice check

Copy: **"Want even clearer results? Take this one-minute voice check."**

It is a short **typed** conversational intake (four questions) that builds a baseline of vocabulary, tone, and scholarly register. It reuses the shared voice-sample helpers: `MIN_VOICE_SAMPLE_WORDS = 150`, **paste allowed** (Colton, Nov 20, 2026, t44: no paste blocks anywhere; the old "we need your own typing here" note is removed; the passive `usePasteMeta()` records a paste ratio, Stage 1 spec 8.1a), and the same `StyleMetrics` computation (including any additive fields Stage 1 adds — variance, scholarly register, tone markers — which this checker may store but does not have to surface). The four questions and the 150-word floor are **unchanged**; do not raise them to Stage 1's 200-word paper-intake minimum (lowered from 250 by Colton, Nov 20, 2026). Completing it attaches to the account created at the email step (or, if the student skipped the email step, creates the free account the same way) and writes `voice_profiles` (one table, shared with Stage 1; do not fork). That profile sharpens signals 3 and 4 (and the register sub-measure). After scoring, offer to re-run the comparison signals on the current draft. It is also the funnel into the free first paper: "Your first paper is free. No card."

**The four questions:**

1. "Write about 150–300 words, no editing, about anything you care about, the way you'd text a friend who asked." (The checker's standalone sample; required; ≥ 150 words; paste allowed, paste ratio recorded quietly. This is not the Stage 1 paper-intake sample, which is embedded in assignment-grounded answers and has a 200-word floor.)
2. "In three or four sentences, explain a topic you know well to a classmate." (Scholarly vs. casual register.)
3. "What's a word or phrase you rely on when you write, or one teachers often mark?" (Vocabulary awareness; short answer is fine.)
4. "When you write for school, do you sound casual, in-between, or formal — and is that on purpose?" (Tone / register; short answer.)

Show a friendly readout, same spirit as Stage 1: "Your natural voice: ~X words per sentence, grade-level Y, Z tone. Your go-to words: …"

If a `voice_profiles` row younger than 180 days already exists when the student later starts a paper, Stage 1 offers "Keep this baseline" or "Refresh it with this paper" (see `retainwrite-stage1-intake-spec.md` section 8.3). Coaching questions still happen either way. Confirmed: auto-offer this; do not skip the prompt.

---

## 11. API route and JSON schema

`POST /api/ai-checker/analyze` (route handler, `runtime = 'nodejs'`, Zod-validated body). No new env vars. Use the existing Grok client (`baseURL: "https://api.x.ai/v1"`, `GROK_API_KEY`).

`MODEL_FAST` (`grok-4.3`, `reasoning_effort: "none"`) for short classification (tone-shift quotes, light labeling). `MODEL_STRONG` (`grok-4.7`, `reasoning_effort: "low"`) for topic-sentence and personal-specifics judgments. Timeouts: 8 s fast, 30 s strong, same as the stage specs. On timeout or error, log `ai_fallback` and return deterministic signals plus `partial: true`; never block with a blank page. Guard every model output: reject rewrites, alternate sentences, or "try this:" completions; retry once; then fall back.

Structured output: `response_format: { type: "json_schema", json_schema: { name: "ai_checker_judgment", strict: true, schema } }`, then Zod. If the schema is rejected (HTTP 400), retry with `json_object` + Zod.

**Request (Zod):** `{ text: string (≤ 30,000 chars, 120–4,000 words), sample?: string (≤ 10,000 chars, 150–1,500 words), sampleInputMeta?: { pastedChars: number, typedChars: number, spokenChars: number, pasteEvents: number } (t45; clamped server-side to the sample length), useVoiceProfile?: boolean, challengeToken?: string, utm?: { source?, medium?, campaign?, content?, term? } }`. The route runs `checkBotId()` (Vercel BotID) and the rate limiter before reading the body.

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
    tells: [{ quote: string, start: number, end: number, note: string, sectionId?: string }],  // quote === text.slice(start, end)
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
  // When locked, `signals` contains ONLY the top 2 (others are { id, locked: true }) and `sections` is empty.
  sealed?: string,             // locked only: AES-256-GCM sealed full result, 2-hour expiry; opaque to the client
  runId: string,               // ai_checker_runs id (aggregate row)
  partial: boolean,
  weightsUsed: Record<string, number>, // after renormalization
  voiceBaseline: { source: "sample" | "voice_profile" | "none", pastedShare: number | null, typedWords: number | null, naturalWords: number | null, tier: "plenty" | "enough" | "thin" | "low" | null, lowConfidence: boolean, note: string | null }, // t45, section 5.9; naturalWords + tier t51
  disclaimer: string
}
```

Quotes must be verbatim substrings of the submitted text (enforce in code, same spirit as Stage 2 slot filling). Coaching questions are selected from a small fixed bank per signal, optionally filled with a verbatim slot; the model must not invent a rewrite.

**Sealed result (no server-side storage of quotes):** when the result is locked, the server returns the preview plus `sealed`, the full result encrypted with AES-256-GCM under a key derived via HKDF-SHA256 from `CRON_SECRET` with info `"ai-checker-seal-v1"` (no new env var; a dedicated key is an optional later improvement). Payload includes `runId` and `exp` (2 hours). The client can't read it; the server never stores it.

`POST /api/ai-checker/unlock` — `{ sealed, email, ageBand, termsAccepted: true, marketingConsent, utm? }`. BotID + rate limit. Opens the seal (reject if tampered/expired: "This preview expired — check your draft again"), creates or finds the account via `generateLink` (section 5.3), writes `ai_checker_leads`, sends the one report email (HTML + in-memory PDF + magic link), and returns the full result. **Does not store the result or quotes.**

`POST /api/ai-checker/save` — signed-in only, explicit opt-in. `{ result, includeDraft: boolean, draftText? }`. Writes `ai_checker_reports` (owner-scoped, no expiry until deleted) and, if `includeDraft`, `ai_checker_saved_runs`. Returns the `/ai-checker/report/[token]` URL. `DELETE` on the same route removes both.

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

create table ai_checker_reports (         -- as of 0007: signed-in opt-in saves only (see 12.1); originally a 30-day TTL store
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

Retention cron (add `/api/cron/checker-retention`, still authed with `CRON_SECRET`): delete any `ai_checker_reports` rows without a `user_id` (legacy from before 0007), purge `ip_hash` values older than 30 days, and never keep opted-out draft text after the user deletes it. Anonymous `ai_checker_runs` rows (counts and numeric scores only) may be kept for tuning.

### 12.1 Migration `supabase/migrations/0007_ai_checker_standalone.sql` (additive, after 0006)

```sql
-- 0007_ai_checker_standalone.sql
-- Reports are stored only for signed-in, opt-in saves.
alter table ai_checker_reports
  alter column expires_at drop not null,
  add column if not exists saved_opt_in boolean not null default false;
-- New rows must belong to a user and be opt-in (legacy rows are purged by the retention cron).
alter table ai_checker_reports
  add constraint ai_checker_reports_owner_optin
  check (user_id is not null and saved_opt_in) not valid;

alter table ai_checker_runs
  add column if not exists had_sample boolean not null default false,
  add column if not exists used_voice_profile boolean not null default false,
  add column if not exists weights_used jsonb not null default '{}',
  add column if not exists signal_status jsonb not null default '{}',  -- id -> scored | needs_voice | insufficient
  add column if not exists challenge_shown boolean not null default false,
  add column if not exists baseline_pasted_bucket text,                -- t45: none | 0-20 | 20-60 | 60-90 | 90-100 (no text)
  add column if not exists unlocked boolean not null default false;    -- set by /unlock via runId

alter table ai_checker_leads
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists account_created boolean not null default false,
  add column if not exists run_id uuid references ai_checker_runs;

-- Calibration metrics only (no text). Service role only.
create table if not exists checker_calibration_samples (
  id uuid primary key default gen_random_uuid(),
  rubric_version text not null references rubric_versions(version),
  set_name text not null,            -- human | human_esl | human_formal | contrast_ai
  level text,                        -- high_school | undergrad | grad
  word_count int not null,
  signal_scores jsonb not null,
  overall_strength int not null,
  overall_band text not null,
  created_at timestamptz not null default now()
);
alter table checker_calibration_samples enable row level security;  -- no policies: service role only

create or replace view ai_checker_daily_stats as
select date_trunc('day', created_at) as day,
       rubric_version,
       count(*) filter (where not partial) as scored_runs,
       count(*) filter (where not partial and overall_band = 'low') as clean_runs,
       round(100.0 * count(*) filter (where not partial and overall_band = 'low')
             / nullif(count(*) filter (where not partial), 0), 1) as clean_rate_pct,
       count(*) filter (where had_sample) as runs_with_sample,
       count(*) filter (where unlocked) as unlocks
from ai_checker_runs
group by 1, 2;
```

`ai_checker_runs.ip_hash` remains a daily HMAC (key from `CRON_SECRET`), used only for rate limits and purged after 30 days. The view is read by `/admin/sop` with the service role only.

---

## 13. Analytics events

Log to `session_events` (or a checker-specific event name in `detail`) without storing draft text:

`checker_viewed`, `checker_submitted`, `checker_sample_added`, `checker_voice_paste_note_shown` (`{ surface, bucket }`, t45), `checker_sample_skipped`, `checker_validation_error` (`{ reason: too_short | too_long | too_many_chars }`), `checker_challenge_shown`, `checker_challenge_passed`, `checker_bot_blocked`, `checker_preview_shown`, `checker_reads_fine`, `checker_band` (`{ band }`), `checker_highlight_opened`, `checker_signal_expanded` (`{ signalId }`), `checker_rubric_link_clicked`, `report_saved_opt_in`, `report_deleted`, `checker_magic_link_sent`, `free_paper_started_from_checker`, `checker_partial`, `email_gate_submitted`, `report_unlocked`, `report_emailed`, `marketing_consent_yes`, `marketing_consent_no`, `unsubscribe`, `voice_check_started`, `voice_check_completed`, `account_created_from_checker`, `cta_free_paper_clicked`, `rubric_viewed`, `report_printed`, `rate_limited`, `ai_fallback`.

---

Event `detail` holds ids, enums, counts, and numeric scores only; never draft text, sample text, quotes, or email addresses. Attribution: the `utm_*` values and `from=checker` flow through to `account_created_from_checker` and `free_paper_started_from_checker`, so the funnel (view → submit → preview → unlock → account → free paper started) is measurable on `/admin/sop`. Clean rate (section 9.1) is on the same dashboard.

## 14. Rate limits, abuse protection, and size limits

- **Words / characters:** draft min **120** words, max **4,000** words and **30,000 characters**; optional sample 150–1,500 words, max **10,000 characters**. Enforce on the client (counter, disabled button) and on the server (Zod) before any model call. Request body cap 64 KB.
- **Bot check (no login, no keys):** Vercel **BotID** (`botid` package): `initBotId({ protect: [{ path: "/api/ai-checker/analyze", method: "POST" }, { path: "/api/ai-checker/unlock", method: "POST" }] })` in `instrumentation-client.ts`, `checkBotId()` first thing in both routes; bots get 403 and `checker_bot_blocked`. No new env vars.
- **Visible challenge after N checks:** after **3** analyzes from the same `ip_hash` in 24 hours, the next request must include a Cloudflare **Turnstile** token (verified server-side) before the model runs. This needs two optional env vars (`NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`) — **a decision for the owner**. If they are not set, the fallback is: after 3 anonymous checks in 24 hours, ask for the email step (or sign-in) to keep checking, which uses no new keys.
- **Edge rate limit:** a Vercel Firewall rate-limit rule on `POST /api/ai-checker/*` (e.g. 20 requests / minute / IP) as a backstop, configured in the dashboard.
- **Anonymous, per `ip_hash`:** 5 analyzes / hour, 15 / day.
- **Unlocked or signed-in:** 10 / hour, 30 / day.
- **Voice-check completions:** 3 / user / day.
- **Report emails:** 1 per unlock, cap 10 / email / day.
- Over limit: HTTP 429, plain message "That's the limit for now — try again in an hour," no model call.

Enforce on the server with the runs table. Fail closed if the table write fails.

---

## 15. Privacy and age (implementation)

- **Analyze in memory only.** The draft and optional sample exist only in the request's memory and in the student's browser. Never write them to logs, error trackers, analytics, or the database. Scrub request bodies from error reporting (e.g. Sentry `beforeSend`) and never `console.log` them.
- **Store only anonymous aggregate metrics:** `ai_checker_runs` (word count, numeric scores, band, flags, daily IP HMAC purged after 30 days). No text, no quotes.
- **Quotes** live in the browser and in the report email the student asked for. The email is delivered through Resend, which keeps its own delivery logs under its retention; say "we email you a copy" rather than "nothing is kept anywhere."
- **Saved reports and drafts** exist only when the student is signed in and taps **Save this report to my account** (and, separately, "include my draft"). Deletable anytime from the report page and account settings.
- **Never** send drafts or reports to a training API, a third-party detector, or a fine-tune job. Grok inference is request-response only, for scoring and coaching questions.
- Under 13: no account, no report unlock, no lead. 13–17: transactional report and account only; `marketing_consent` forced false; guardian gate before the first paper.
- Update `/privacy` with the paste-box line and a pointer to this tool. The email gate enforces 13+ and records `terms_accepted_at`.

---

## 16. FAQ (ship on the page)

Use marketing FAQ 1–6, with FAQ 4 already correctly defining high / moderate / low as pattern strength. Patch FAQ 6 (typed baseline; the email step creates the free account) and use this privacy answer as **question 7** once Colton signs off:

**7. What happens to the draft I paste?** (**proposed replacement — pending Colton**; conflicts with the current landing-copy FAQ 7, see section 6.3)
Drafts aren't stored unless you are signed in and opt in. We never use drafts for training. We analyze your draft in memory to build your report, then discard it. We keep only anonymous numbers, like word count and signal scores, to keep the tool honest and fair. If you enter your email, we email you a copy of your full report; we don't keep the quoted lines on our servers. If you have an account, you can choose to save a report (and, separately, your draft) and delete it anytime. You must be 13 or older to use the tool.

**6. (patch) Do I need an account?** You don't need an account or a card to check a draft. Your email unlocks the full report and creates a free account that includes your first paper free, no card, no audio. The optional one-minute voice check is typed, not recorded, and saves a baseline of your own writing to that account.

(The optional question 8 is dropped; its content is now in the FAQ 6 patch above.)

Update FAQPage JSON-LD to match the shipped questions exactly (including 6 and 7 once Colton signs off).

---

## 17. Acceptance-criteria checklist (product)

- [ ] `/ai-checker` and `/ai-checker/rubric` render; rubric shows v1.0, the seven signals, thresholds, and a changelog.
- [ ] Paste of < 120 words or > 4,000 words is rejected with a clear message and no model call.
- [ ] A clean fixture draft returns **Your draft reads fine** / Reads like you; a stock-phrase-heavy fixture returns the high band; a mixed fixture can land in the middle. Unit tests lock this.
- [ ] Each tell quotes verbatim student text and a coaching question; no rewritten sentence appears in the UI or the model output (guard tests).
- [ ] (t45/t46) Paste note tests: the retired t45 sentence and the words “not reliably” / “less confidence” appear nowhere in app copy (CI grep); a fully pasted writing sample (pastedShare 1.0) → `VOICE_NOTE_SAMPLE` appears at the bottom of the full report, email and PDF, and the headline/ring are unchanged; a typed sample → no note; exactly 0.60 → no note, 0.61 → note; a dictated sample (`insertText` / `spokenChars`) → counts as typed, no note; no sample and no profile → vocabulary N/A, **no note**; signed-in, no sample, profile with `typed_word_share` 0.2 → note; a mostly pasted sample plus a reliable profile → the profile is used, no note; `sampleInputMeta` larger than the sample is clamped; the preview never shows the note. (t47) Signed-in, no sample, profile `typed_word_share` 0.03 → `VOICE_NOTE_ANSWERS_ALL` (exact text); 0.06 → `VOICE_NOTE_ANSWERS`; a fully pasted public sample still → `VOICE_NOTE_SAMPLE`; the retired-wording grep still passes (the all-pasted string contains neither “not reliably” nor “less confidence”). **(t51, supersedes the t45–t47 threshold cases above)** Sample: 150 typed words → `VOICE_NOTE_SAMPLE_SHORT`; 650 typed → none; 650 fully pasted → `VOICE_NOTE_SAMPLE_LOW`; 300 words at 0.70 pasted (90 natural) → `VOICE_NOTE_SAMPLE`; 500 words at 0.50 (250 natural) → none; dictated words count as natural. Profile: `natural_words` 1,260 at 0.70 pasted (the 58-page case) → none; 143 at 0.45 → `VOICE_NOTE_ANSWERS_SHORT`; 74 → `VOICE_NOTE_ANSWERS_LOW`. A sample in `low` plus a profile in `plenty` → the profile is used, no note. `VOICE_NOTE_ANSWERS_ALL` appears nowhere in app code.
- [ ] Vocabulary signal is `needs_voice` (shown N/A, weight renormalized) until a writing sample is pasted or a voice profile exists; after the voice check, comparison signals use the baseline.
- [ ] Voice check: four questions, 150-word sample (paste allowed, paste ratio recorded), free account created, `voice_profiles` written, funnel into the free first paper.
- [ ] Preview vs. full report and email gate behave as in section 5.3; 13–17 cannot opt into marketing; CAN-SPAM footer and unsubscribe work on marketing mail.
- [ ] Report design criteria in section 5.7 all pass.
- [ ] Rate limits enforced; IP hashed; drafts not in `ai_checker_runs`.
- [ ] No banned phrases ("bypass," "beat Turnitin," "undetectable," "pass AI detection," "humanize") in UI copy.
- [ ] Disclaimer visible on the landing page, in the report, in the email, and on the print view; Liang et al. (2023) cited correctly.
- [ ] Fallback still returns deterministic signals if Grok fails.
- [ ] `https://www.retainwrite.com/ai-checker` renders with H1 and title "AI Detector for Student Papers: Does It Sound Like You?"; `https://retainwrite.com/ai-checker` returns **308** to the www URL; canonical, OG, and sitemap use www.
- [ ] No login is needed to run a check; the page has no stage rail and creates no `stage_progress` rows.
- [ ] Optional writing sample: without it, vocabulary shows N/A and `weightsUsed` sums to the six remaining weights; with it, vocabulary is scored; the sample is never stored.
- [ ] The email step creates exactly one account per email via magic link, records terms acceptance, and the new account can start the free first paper (no audio, no card); an existing account is not duplicated; under-13 is blocked.
- [ ] After a check, `ai_checker_runs` holds numbers only, and no table, log line, or analytics event contains draft text, sample text, or quotes (test with a canary string in the draft).
- [ ] The sealed preview can't be read or altered by the client; an expired or tampered seal is rejected.
- [ ] Calibration: the human calibration set reads fine at ≥ 80% (ESL and formal subsets ≥ 75%); the result is recorded in `checker_calibration_samples` and summarized on the rubric page. Clean rate appears on `/admin/sop`.
- [ ] Determinism: identical input (model mocked) gives identical output; scoring code contains no randomness and does not read live clean-rate data.
- [ ] Abuse: BotID blocks a flagged bot request (dev bypass `BAD-BOT`); the 4th check in 24 h from one IP requires the challenge (or the email step if Turnstile keys are unset); over-limit returns 429 with no model call; > 30,000 characters is rejected client- and server-side.
- [ ] Performance budgets in section 21 pass in Lighthouse CI (mobile).

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
3. Whether Stage 1 should auto-offer "Use my voice check": **resolved.** Stage 1 auto-offers "Keep this baseline" or "Refresh it with this paper" when a `voice_profiles` row is younger than 180 days (`retainwrite-stage1-intake-spec.md` §8.3).
4. Who signs off on threshold changes after a clean-rate review (section 9.1)? Recommended: Paper Coach + the owner, using the calibration set and `/admin/sop` aggregates only. Changes ship as a new rubric version.
5. **(owner decision)** FAQ 7: adopt the in-memory-only wording (section 16) or keep the 30-day stored-quotes link. Default in this spec: in-memory only.
6. **(owner decision)** Turnstile keys for the visible challenge (two new optional env vars) vs. the no-keys fallback (email step after 3 checks/day). Default: fallback until keys are added.
7. **Optional writing sample — paste allowed (decided by Colton, Nov 20, 2026, t44; no paste blocks anywhere).** Consequence to know: an older paper will usually be pasted, so many sample runs will show the 5.9 note. **Resolved t46:** the note uses Colton-approved soft wording (“…which is totally fine…”).
8. **(owner decision)** Source for the calibration set (owner archive of pre-2023 drafts with consent, an openly licensed corpus, or both).

No other blockers. Build v1.0 with the defaults.

---

## 21. Performance and mobile

- **Targets (p75, mobile, field data via Vercel Speed Insights):** **LCP ≤ 2.0 s**, CLS ≤ 0.05, INP ≤ 200 ms. Lighthouse CI (mobile, simulated 4G) on `/ai-checker`: performance ≥ 90, accessibility ≥ 95, SEO 100.
- The landing page is a static Server Component (SSG; no per-request data), served from the edge cache. The LCP element is the H1 text, not an image. Fonts via `next/font` (Newsreader + Source Sans 3, subset latin, `display: swap`, preloaded). No hero image above the fold.
- Initial route JS ≤ 120 KB gzipped. The report components (ring, cards, highlighted draft, PDF trigger) load with `next/dynamic` after the first submit. No third-party scripts beyond BotID (and Turnstile only when the challenge is shown).
- Mobile-first: the paste box is in the first viewport at 375×667; tap targets ≥ 44 px; works at 320 px; the textarea grows with content; the submit button stays visible (sticky footer) while typing on mobile.
- `/api/ai-checker/analyze`: deterministic signals respond first; Grok calls run in parallel with the 8 s / 30 s budgets; p95 end-to-end ≤ 12 s, with staged skeleton copy. `maxDuration` 60 s.

## Changelog

- **Nov 20, 2026 (t51)** — Per Colton: 5.9 now uses a hybrid threshold (natural typed/spoken words plus paste share; tiers 600 / 200 / 80, [PROVISIONAL]) on every surface, including the public writing sample. New `…_SHORT` and `…_LOW` strings; `VOICE_NOTE_ANSWERS_ALL` and `VOICE_ALL_PASTED_SHARE` retired. Profile-vs-sample choice is now by tier. The response gains `naturalWords` and `tier`. Tests updated.
- **Nov 20, 2026 (t47)** — Per Colton's Stage 2 brainstorm (voice capture): added the all-pasted variant `VOICE_NOTE_ANSWERS_ALL` for voice-answer baselines with pasted share ≥ 0.95 (`VOICE_ALL_PASTED_SHARE`), in the same soft style, stating lower confidence. `VOICE_NOTE_SAMPLE`, the > 0.60 threshold, placement and the no-baseline rule are unchanged. Tests added.
- **Nov 20, 2026 (t46)** — Softened the 5.9 voice-baseline note per Colton. One consistent kind style: `VOICE_NOTE_SAMPLE` for the public checker's writing sample and `VOICE_NOTE_ANSWERS` for voice answers (profile, in-app checks, Stage 6). t45's “Voice was not reliably determined…” sentence is retired. Placement, the > 60% threshold, the no-baseline behavior and the weighting are unchanged. No icon alarm; tests and a retired-wording grep added.
- **Nov 20, 2026 (t45)** — Added the voice-baseline paste note (section 5.9): one factual line at the very bottom of the full report, email and PDF when the baseline actually used is more than 60% pasted. It's scoped per surface (standalone sample, voice profile, Stage 1 answers for in-app and Stage 6 checks). Dictation and speech count as typed, missing data counts as typed, and with no baseline the N/A behavior is kept with no note. It's combined with typed-weighted baseline metrics, and a mostly pasted sample now falls back to a reliable voice profile. Added `sampleInputMeta`, the `voiceBaseline` response field, `baseline_pasted_bucket`, an event and tests. Also per Colton t44: the voice check and sample box allow paste (open question 7 resolved), and the stale "250-word" Stage 1 reference is fixed to 200.
- **Nov 20, 2026 (t40)** — One cross-reference updated: Stage 1's paper-intake voice minimum is now 200 words (Colton). The checker's own 150-word voice check is unchanged.
- **Nov 20, 2026** — Made the checker a complete standalone spec for a lead-capture and credibility landing page at `/ai-checker` (canonical `https://www.retainwrite.com/ai-checker`; apex 308s to www), built as Phase 11 right after the Stage 1 rewrite. H1/title set to "AI Detector for Student Papers: Does It Sound Like You?". Added the optional writing sample with N/A + weight renormalization, public signal weights, the "Signal strength" title and "Your draft reads fine" headline rules, highlighted examples with verified offsets (quotes only), and email-step account creation via magic link that grants the free first paper. Privacy is now analyze-in-memory with anonymous aggregate metrics only (sealed preview, no stored quotes; saved reports only for signed-in opt-in), which conflicts with landing-copy FAQ 7 (pending Colton). Calibration now uses a real-student calibration set with clean rate as a monitored metric, never forced or randomized. Added BotID, the challenge after 3 checks, character limits, SEO metadata, performance targets (LCP ≤ 2.0 s), new analytics events, acceptance tests, and migration `0007_ai_checker_standalone.sql`.
