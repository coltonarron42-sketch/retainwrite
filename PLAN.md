# RetainWrite PLAN.md
## Source of Truth — Product Requirements & Operating Rules

This file is the highest authority for all bots and for Cursor. If any other document or prompt conflicts with this file, this file wins.

## 1. Product Goal
Help students write better papers by coaching them through a structured process so they learn and retain the material. The AI never writes the paper for them.

## 2. Core Non-Negotiables
- Student owns every sentence.
- One frame / one question at a time.
- Teach-then-ask on every concept.
- Assignment upload and parsing happens before any coaching questions.
- Progress saves on every submission and on pause. Signed-in users can leave and resume.
- Logic checks give feedback or strong warnings, never hard stops.
- Visual design and copy must feel calm, clear, and student-friendly (not generic SaaS).

## 3. Pages & Primary Job of Each
- **Homepage** — Explain the six-stage coaching path and the "we never write for you" promise. Clear "Start free paper" CTA.
- **Pricing** — $0 first paper (no card), $9 single, $15 for 3, optional $1.99 audio. Emphasize no subscription.
- **Auth (Sign up / Log in)** — Simple email + password. Clear "Continue in demo" path that warns progress may be lost.
- **Papers Dashboard** — List of papers with resume point for each.
- **Stage 1 – Intake** — Upload assignment (photos, PDFs, text). System extracts prompt, format, rubric, sections. Student confirms. Then short personalization + voice sample questions.
- **Stage 2 – Stance / Research Loop** — Section-by-section: summarize what the section needs → probe what the student already knows or wants to explore → offer 3–5 research leads (one wildcard) → student confirms ideas. Logic checkpoint after each section.
- **Stage 3 – Outline** — Student builds sentence-level outline from their own confirmed ideas. Coach supplies structure only.
- **Stage 4 – Sources** — Review and select the research leads. Build references as they go.
- **Stage 5 – Drafting** — Student writes every sentence from their outline. Coach offers example transition language and light cleanup flags only.
- **Stage 6 – Revise** — Citation audit, flow, voice check, export to Word/PDF.
- **AI Checker** (`/ai-checker`) — Standalone tool. Student pastes text, gets signal-strength scores (not "AI likelihood"). Free preview + email unlock for full report.
- **Blog** — Later. Not in first build.
- **Admin** — Passcode creation for free unlimited access (testing and Angie).

## 4. Main User Journey (Happy Path)
Land → Start free paper → Sign up or demo → Upload assignment → Confirm extracted card → Answer short personalization questions → Enter Stage 2 section loop → Lock ideas → Outline → Sources → Draft sentence by sentence → Revise → Export.

## 5. Out of Scope for Now
- Full blog publishing system
- Advanced analytics
- Native mobile apps
- Multi-language
- Hard age verification beyond existing checkbox + disclosure

## 6. Bot Operating Rules (Deep Skills)

### Paper Coach
- Treat this PLAN.md and the coaching philosophy as higher authority than any individual stage spec.
- Never expand scope. If a request adds a new page or major flow not listed here, flag it instead of building.
- Own the handoff format between stages.

### Research Bot
- Only produce evidence that changes a product decision.
- Return findings in a format that can be absorbed directly into this PRD.

### Marketing Bot
- Never write copy that contradicts the coaching philosophy.
- Treat Design System and locked page copy as final unless there is clear user or conversion data.

### RetainWrite QA
- Test against this PRD and the Design System, not just "does it crash."
- Only open issues on pages that have been declared visually complete.
- Prioritize issues that break one-frame-at-a-time or student-owns-the-sentences above all others.

## 7. Build Process Going Forward
1. Freeze automated QA → Coder loops on incomplete pages.
2. You + Strategist lock Design System and core copy.
3. Coding bot builds one page or major feature at a time against this file.
4. QA is called only after a page is visually and functionally complete.

## 8. Design System — Editorial-Warm

**Direction:** Warm, minimal, scholastic. Think a quiet library or a well-kept notebook — calm, confident, never shouting. Inspired by Apple's restraint and Notion's warmth. Not dark-neon, not flat corporate, not busy.

### 8.1 Color Palette
- **Background (page):** `#FAF7F2` — warm off-white, like aged paper. Never pure white.
- **Background (cards/panels):** `#FFFFFF` — pure white, used only for elevated surfaces sitting on the warm page.
- **Text (primary):** `#1C2B2D` — deep ink, near-black with a slight green cast. High contrast, easy to read for long sessions.
- **Text (secondary):** `#5C6B6E` — muted slate for supporting labels, captions, helper text.
- **Text (tertiary/disabled):** `#9AA5A8` — light gray for placeholders and inactive states.
- **Accent (primary):** `#C4785A` — muted terracotta. Used ONLY for primary buttons, active states, and key highlights. One accent, used sparingly.
- **Accent (secondary):** `#7A9E7E` — soft sage. Used for success states, progress indicators, positive feedback moments.
- **Accent (warning):** `#D4A017` — warm amber. Used for logic-check warnings and the anonymous-user progress-loss banner.
- **Accent (error):** `#C0392B` — restrained red. Used only for true errors and the red-alert logic checkpoint.
- **Border/divider:** `#E8E2DA` — soft warm gray. 1px, low contrast.

### 8.2 Typography
- **Headlines:** `Fraunces` (Google Fonts, serif, variable weight 400–700). Scholastic, literary, warm. Use for page titles, stage names, and section headers.
- **Body:** `Source Sans 3` (Google Fonts, sans-serif). Humanist, highly legible at small sizes. Use for all body text, questions, and coaching prompts.
- **Mono/code:** `JetBrains Mono` — only for technical strings, code, or raw pasted content.
- **Scale:** 16px base. Headlines: 32px (h1), 24px (h2), 20px (h3). Body: 16px. Small/caption: 13px. Line height 1.6 for body, 1.2 for headlines.
- **Max content width:** 680px for reading text. Wider layouts (dashboards, cards) may use up to 1100px with a centered column.

### 8.3 Spacing
- Base unit: 8px. All spacing is multiples of 8.
- Page padding: 48px vertical, 24px horizontal (mobile), 64px horizontal (desktop).
- Section gaps: 64px between major sections on a page.
- Card padding: 32px.
- Element gaps within a card: 16px.
- Generous margins everywhere. If it feels cramped, double the space.

### 8.4 Layout & Components
- **One frame per screen.** A single question, prompt, or content block dominates. No competing elements.
- **Ghost skeleton:** A faint, non-interactive outline of the full paper floats in the background (low opacity, ~8%) during Drafting and later stages. Clicking it opens a review overlay; it never blocks the active frame.
- **Milestone pop-up:** When a stage section completes, a brief overlay shows the growing paper outline with clickable section chips. "Ready for [next stage]?" with a Review option and a Continue option.
- **Buttons:** Primary — terracotta background (`#C4785A`), white text, 8px border radius, soft shadow (`0 2px 8px rgba(196,120,90,0.25)`), 48px min height for touch. Secondary — white background, terracotta text and 1px border, same radius. Ghost — no border, terracotta text, underline on hover.
- **Inputs:** White background, 1px warm-gray border, 8px radius, 16px padding, 48px min height. Focus ring: 2px terracotta, offset 2px.
- **Cards:** White background, 1px warm-gray border (or no border with soft shadow `0 1px 4px rgba(28,43,45,0.06)`), 12px radius.
- **Progress indicator:** Thin sage bar or simple step counter. Never a busy multi-colored stepper. Inside a paper it is a slim horizontal row (see section 9), never a sidebar list.
- **Logic-check states:** No flag = quiet sage checkmark. Light feedback = amber note. Strong pushback = amber banner with the claim restated. Red alert = terracotta banner, continue-anyway is a secondary button, never hidden.
- **Anonymous banner:** Amber background, warm amber text, appears at top of demo sessions: "Progress won't be saved. Create a free account to save and resume anytime."

### 8.5 Copy Rules
- Short sentences. Plain words. Lead with benefit before feature.
- Headlines state the outcome, not the mechanism. "Your paper, your words, every step" not "AI-powered writing assistance platform."
- One idea per sentence. No jargon. No exclamation points in body copy.
- Button text is a verb + object: "Start free paper," "Upload assignment," "Confirm section."
- Coaching prompts are warm and specific, never clinical. "What pulled you to servant leadership?" not "Please elaborate on your choice."
- Error messages name the problem and the next step. Never blame the user.

### 8.6 Motion
- Minimal. 150–200ms transitions on hover and focus only.
- No autoplay, no parallax, no decorative animation that delays content.
- Page transitions: simple fade, 200ms.
- Skeleton loaders use the warm-gray shimmer, never spinners alone.

### 8.7 Accessibility
- WCAG 2.1 AA minimum. Text contrast 4.5:1 against backgrounds.
- All interactive elements keyboard-navigable with visible focus rings.
- Respect `prefers-reduced-motion`.
- Form labels always visible, never placeholder-only.

## 9. Pau Pau Conversation Model (added Nov 22, 2026 per Colton)
Pau Pau should feel like a present coach, closer to how Grok talks than a series of separate text messages.
- **One reply per turn.** Each Pau Pau turn is ONE continuous message block (paragraphs inside it are fine; it may stream in). Never several stacked bubbles saying one thing. This includes the greeting + first question, the assignment read-back + confirmation question, an offer + its choices, and Pau Pau's reply to a choice. Reloaded history renders the same way.
- **Natural replies, no "Fix something".** After the read-back the student just replies in the same chat input ("looks good", "do you need my due date?", "it's actually 1500 words, due Dec 3"). Pau Pau classifies the reply (confirm, question, correction, extra info). Corrections update the extracted fields and Pau Pau re-confirms in one reply. Pau Pau never advances on an ambiguous reply. The student's own words are kept verbatim. Stage gates still apply.
- **Light progress, no stage sidebar inside a paper.** A slim horizontal indicator (stage markers + current stage name) replaces the six-stage list. It never pushes the input down on mobile or desktop.
- **Voice.** When Voice is on it works on mobile (unlocked by the student's tap), stays on, and reads only Pau Pau's own words, never source text or the student's words.
- **Unclear replies get a real clarifying question.** "hmm maybe" is answered with a question that re-asks and offers a way forward ("No worries. Does anything in there look off, like the length, due date or sources? Or tell me “looks good” and we'll start."). It never advances.
- **Corrections overwrite everywhere.** A corrected field replaces the old value in the whole recap (a single "1,500 words" replaces a 1,200–1,500 range). Due dates are read back with a year (the next upcoming occurrence). Read-backs are full sentences ("This is for ENG 101 with Prof. Dana Ruiz: a …"), and the citation style stays specific (MLA 9, APA 7).
- **Offers fold into the current reply.** The hesitation offer, its choices and Pau Pau's answer are a soft last paragraph inside the current question's bubble, never a second bubble.
- **Reloads are silent.** A reload never re-reads old bubbles; only a NEW Pau Pau turn (after the student taps, types or speaks on this page load) is spoken.
- **Sources and examples.** Pau Pau introduces them in her own voice, then shows clickable search links (articles, news, videos) in the same reply; never made-up articles. She never reads source content as if she were the source; voice reads only her intro. The research-leads card follows this pattern.
- **Same chat-style input in Stages 2 and 3.** Stance and Outline use the same question-at-top chat, composer (mic / send; "+" only where there is a file to add), slim progress row and call-mode voice/mute as Stage 1. One Pau Pau turn at a time: teach cards, the mirror, the probe, research leads, the lock-in and the logic check are each one Pau Pau reply with tap choices inside it. Stage 3 asks one outline section at a time; the box starts with the student's own Stance notes. The voice nudge (Stage 6) folds into her reply wherever it appears. Every gate and its exact criteria stay the same (thin notes, logic check, skipped sections block Sources, outline saved before advancing), the conversation is saved so a reload resumes it, and a typed reply is always the student's reply (classified first, never turned into a chip pick); a plain yes still stands in for the Yes choice.
- **Requests are not notes.** Everything the student types in Stages 2–3 is classified first (model, with a rule fallback): content for the paper, a request to the coach ("ask me some probing questions"), or a question to Pau Pau ("what do you mean?"). Requests and questions get her answer inside the current reply and are never saved as a note, checked by the logic check or prefilled into the outline.
- **Taps are not the student's words.** A tapped choice or lead shows as a small "Picked: …" chip, never as a student bubble. Only what the student typed or said appears as their message.
- **Relevance first.** The logic check first asks whether the claim answers the prompt and names a mismatch ("This doesn't answer the question your prompt asks: …") before any other critique. "Continue anyway" is acknowledged, and the section stays flagged in Stage 3.
- **Barge-in.** On a voice call, tapping Send or "Talk now" while Pau Pau is talking stops her and takes the student's input. Otherwise listening stays paused while she talks (echo protection).
- **Logic tiers.** Severe ("Logic alert", "Continue anyway") is only for a claim that is off-topic (the model decides relevance first on every section; word overlap is the fallback) or contradicts itself. A personal example backing an opinion is normal: at most a gentle nudge ("One example is a great start; what else shows this?").
- **Append-only history.** Pau Pau's answers to requests and questions are saved in the transcript, so they survive the next turn and a reload; after answering she gives a short follow-up instead of repeating the opening ask.
- **Quick lesson in Body only.** The lesson concept's Quick lesson appears in the Body, where the concept is applied; the Introduction and Conclusion don't carry a concept and go straight to the probe.
- **On-topic means the prompt's subject.** Specific details of the subject count as addressing the assignment (for a start-time prompt: 8:30, the bell, first period, starting later). When the relevance check says on-topic, the cruder word match never adds "doesn't yet speak to the assignment".
- **Sends are never dropped or doubled.** The box empties the moment a message is sent. A message sent while Pau Pau is still replying is queued with a visible note and goes out on its own when she's done. One send is in flight at a time, and the same answer is never appended twice.
- **Presence.** A small flat Pau Pau face (Design System ink, white eyes with a highlight, calm mouth) sits beside her bubbles, and at the top of each chat from tablet width up (one face on phones), with an occasional glance and blink (CSS only, none under reduced motion). While her voice plays, soft thin wavy lines (centered, about 60% of the bubble) pulse along the bubble being read, tied to the speech start/end events, and fade when she stops; nothing shows when voice is off. The lines are absolutely placed, so the input never moves.
- Coaching only: Pau Pau never writes the paper. Extraction must keep working.

---
Last updated: 2026-11-22

## Future: Pau Pau Bot (do not start until Stage 3 is solid and coaching rules are locked)

Build a standalone Pau Pau Grok Bot that delivers the same RetainWrite coaching workflow in conversational form for people already using Grok. It will be sold, advertised and backlinked from retainwrite.com. Same core rules: the student owns every sentence and stages gate progress. Added Nov 21, 2026 per Colton.
