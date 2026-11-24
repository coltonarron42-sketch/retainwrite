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
- **Pau Pau, the character (locked by Colton, Nov 22 2:43 PM).** The official Pau Pau is a soft light-brown/beige blob head with pink cat-eye glasses floating on it, simple dark eyes that fill the frames, and a tiny smile, on a cream background; clean flat style, one inline SVG used everywhere she appears (chat header, her turns). She blinks and glances occasionally (the eyes move inside the frames) and is completely still under reduced motion.
- **Presence.** Her face sits beside her turns, and at the top of each chat from tablet width up (one face on phones). While her voice actually plays, soft thin wavy lines (centered, about 60% of her turn) pulse around the turn being read, tied to real playback start/end events, and fade out over about 0.4s when she stops; nothing shows when voice is off or when no sound is playing. The lines are absolutely placed, so the input never moves.
- **Chat layout.** Pau Pau's turns read as plain text beside her avatar, with no card border, shadow or box; the student's turns are a light right-aligned text block with a thin rule. The single-reply rule, chips, slim progress row and the 390px layout (no input jump) stay. On phones the composer is pinned to the bottom (fixed, safe-area inset, a matching spacer under the thread) and its status row has a fixed height, so replies, speech and status changes never move it; transient notes (mic blocked, queued) float above it as a toast.
- **Her voice.** Pau Pau's words are read by server text to speech (xAI /v1/tts, same xAI key; PAU_TTS_VOICE picks the voice) through one <audio> element unlocked on the first tap, with the browser's Web Speech as the fallback. "Pau Pau is talking", the waves and the mic pause follow real playback; if audio can't start, "Tap to hear Pau Pau" appears. Her voice is younger and casual (Colton, Nov 22 4:00 PM): the default is set in lib/voice/tts-config.ts from xAI voices described as down-to-earth, easygoing or playful (castor, sirius, iris; ara before); iris is the default (friendly, upbeat, naturally charming, and in her register), at speed 1.05; the route can audition only those candidates. The TTS response names the voice that spoke (x-pau-voice). At 5:00 PM iris stays the default: it is the only candidate in a young female register with an upbeat, charming description; a slightly quicker speed is the one lever for comic timing.
- **Coming back (Colton, Nov 22 3:46 PM).** On a reload or a return, every chat (Stages 1–3) restores its history silently, scrolled to the bottom; nothing already shown is regenerated or read again (a per-paper marker, saved per user). If the conversation already has turns, she adds exactly one short, varied welcome-back line, speaks only that line when Voice is on, and waits for the student. A reload within 2 minutes of the last welcome adds none. The cooldown is per paper and stage. Her speech queue can only hold turns that arrive after a real student action on this visit (a reply, a choice, a step button) plus the welcome-back line (Colton 5:03 PM): restored history is never enqueued, whatever wakes the audio (mount, a late restore, another device's history, the Voice switch, Unmute, an unlock or "Tap to hear" tap). Read aloud on a turn plays only that turn, when tapped. After any mount or restore there is a hard hold (QA 5:44 PM): only the welcome line may be queued until it finishes playing or the student acts: a sent message, or a tap on a choice, chip or step button (QA 6:18 PM), so her reply to a choice is never dropped (about 8 seconds when no welcome is coming); toggles, unlock taps, Mute and blank clicks never end it. A tap on the dashboard never arms the reopened chat. Turns are idempotent: a stage or section intro already in the saved history (by section id) is never said again, chats render nothing until the restore completes, and a section's notes prefill the box once (a remount keeps what is in the box).
- **Personality (locked, Nov 22).** Really cool, positive and upbeat, sarcastic with a hint of funny. At most one light, kind quip per reply (many have none); she teases the situation (homework, deadlines, rubrics), never the student, and skips jokes on sensitive topics. Always helpful and on mission; coaching only, she never writes the paper. Every Pau Pau-voiced model prompt shares this personality block, and the static copy follows it. Stage 2 deals quips from one per-paper pool, never repeating a line across sections; the first section opens with a first-section line ("Let's start with your introduction."), later ones hand off ("On to your body."). The one-quip limit is checked after generation for model replies too. Since 4:00 PM she sounds like a down-to-earth stand-up comic who's great at writing: younger, relaxed, conversational, never stiff or polished. Contractions, short sentences, plain words, no customer-service phrases; lib/coach/tone.ts checks the template copy. Since 5:00 PM (Colton) her style is a confident, quick comic: blunt but warm, a little self-deprecating, dry, conversational and a little cheeky (style only; she never imitates, quotes or names a real comedian). Her favorite target is herself ("I'd write it for you, but I'm legally a cartoon. You've got this."). Always clean and school-safe (students may be minors): nothing crude, sexual or edgy, never at the student's expense, no jokes on sensitive topics, at most one quip per reply, coaching only.
- **No repeated stock lines (QA Nov 22 4:42 PM).** Every line she says once per section (the probe ask, the leads intro, the confirm, the logic-check opener, the pass line, the moderate-flag title, the "your call" line) comes from its own per-paper pool of 8, dealt in order, so nothing repeats verbatim within a paper; the read-back carries one quip at most.
- **Student quotes are untouched.** A quote of the student's words keeps their own punctuation and is never given or moved a template '?'; Pau Pau's question follows the quote ("You wrote “…” What makes you think that?"). Quotes are whole sentences, or trimmed with an ellipsis, never cut at a comma. Nothing is added inside the quote marks (no '.' the student didn't type). One framing rule: the first lead title opens with "You wrote “…”", later mentions say "your point".
- **Search terms read like research queries.** Each section's library search is a natural 2–6 word query from the model (fast model, low effort, strict JSON) built from the topic and that section's focus; the keyword builder is the fallback and never ends on filler ("about", "part", "best", "teen"). All sections' queries come from ONE request as soon as Stage 2 loads, cached per paper, so the leads show their final terms with no visible swap; the keyword builder stays as the fallback.
- **Stage navigation: past stages viewable, future stages soft-gated, data gates hard (Colton, Nov 23 3:13 PM).** A student can always open any finished stage (progress row, back link or URL) and see its saved work, read-only, with a "Back to Stage N" button; viewing never rewinds `current_stage` or the progress rows and never re-runs a finished stage's gates (intake complete is a no-op once a paper is past Stage 1). Opening a later stage never redirects or says "Stage locked": it shows a friendly message ("We need a bit more info from an earlier stage before we can start building here."; Stage 3: "In this stage we really start putting the whole project together. Get your Stage 2 info in and we can help make something incredible.") plus a look at the stage, with inputs and Pau Pau inactive and nothing written. Every gated stage (2–6) opens with Pau Pau's scripted turn: a 1–2 sentence overview of what happens there, then what we still need (naming the missing stage); on a Grok Voice call the same words are spoken once per visit as a scripted line (speak-only, no notes), never when voice is off or muted (lib/stages/soft-gate.ts). The data gates stay hard on the server: the progress route moves one stage at a time and 409s otherwise (Stance → Outline needs every section confirmed or skipped), autosave never writes the stage, and only the explicit student confirm actions advance a paper (lib/stages/gate-guard.ts).
- **Stage 1 on Grok Voice (Colton, Nov 23 8:11 PM).** For allowlisted students (PAU_REALTIME_ALLOWLIST), Stage 1 Intake runs on the same realtime relay as Stage 2 (lib/voice/realtime): barge-in, mute, the scripted welcome and gate lines, echo guards and the essay guard. Only while the paper is in Stage 1 (?stage=1 and current_stage 1; a finished Stage 1 is read-only and has no call). Her tools are get_flow_state and submit_answer ("move on"); the model never writes anything. The student's spoken words go to the app as their verbatim transcript, routed by screen: on a question or the story angle they join the answer box word for word (bare move-on words like "that's it" don't), and submit_answer sends exactly that box through the same Stage 1 saves, classifiers and gates as typing (the 25-word early take, the 15-word own angle, the empty-answer rule). **The voice sample is always the student's own verbatim transcript, never paraphrased or written by the model.** On the read-back, spoken replies go through the same reply path as typed ones (correction, question, extra info), and a spoken confirm uses the same strict yes check as typing (isQuickConfirm; "yes but…" is not a yes); on the checklist, a strict yes starts Stage 2 only when nothing blocks it. Nothing advances without the student's input, and the adaptive coaching (dig deeper once if thin, otherwise move on) stays. Uploads and pasted assignment text stay file/text input; voice is for the conversation. When the app shows a new step after a tap, typing, or her short ack on the read-back, she voices the app's turn (queued until her current reply ends). Coaching-only, persona lock, at most one quip per reply, never the cartoon joke. Typed Stage 1 replies keep the Stage 2 fast path (fast model, effort none, quick-confirm rules first). To keep it as quick as Stage 2, she says a few words reacting to their answer in the same reply that calls submit_answer, then asks the next question once the app has moved.
- **Stage 3 on Grok Voice (Colton, Nov 23 9:17 PM).** Stage 3 Outline runs on the same relay, only while the paper is in Stage 3 (?stage=3 and current_stage 3). Same tools (get_flow_state, submit_answer with no text) and the same rules: coaching-only (she never words an outline line, topic sentence or reordering for them), persona lock, at most one quip, never the cartoon joke. Each spoken point lands in the outline box word for word as its own line (the untouched Stance-notes prefill gives way to their spoken outline; "Keep my notes" still uses the notes). submit_answer sends the box through the same path as typing: the intent check (requests and questions to Pau Pau are answered, never saved), then the same outline save and thin-section gate. Saying exactly the on-screen choice ("keep my notes", or "skip for now" when there are no notes) is the same as tapping it; requests, jailbreaks and bare move-on words never join the box. On the last step a strict yes (isQuickConfirm) is the same as tapping Continue to sources; nothing else advances. The old text-to-speech stays silent on a call in Stages 1–3.
- Coaching only: Pau Pau never writes the paper. Extraction must keep working.

---
Last updated: 2026-11-23

## Future: Pau Pau Bot (do not start until Stage 3 is solid and coaching rules are locked)

Build a standalone Pau Pau Grok Bot that delivers the same RetainWrite coaching workflow in conversational form for people already using Grok. It will be sold, advertised and backlinked from retainwrite.com. Same core rules: the student owns every sentence and stages gate progress. Added Nov 21, 2026 per Colton.
