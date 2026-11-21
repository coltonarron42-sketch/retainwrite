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
- **Homepage** — Explain the six-stage coaching path and the “we never write for you” promise. Clear “Start free paper” CTA.
- **Pricing** — $0 first paper (no card), $9 single, $15 for 3, optional $1.99 audio. Emphasize no subscription.
- **Auth (Sign up / Log in)** — Simple email + password. Clear “Continue in demo” path that warns progress may be lost.
- **Papers Dashboard** — List of papers with resume point for each.
- **Stage 1 – Intake** — Upload assignment (photos, PDFs, text). System extracts prompt, format, rubric, sections. Student confirms. Then short personalization + voice sample questions.
- **Stage 2 – Stance / Research Loop** — Section-by-section: summarize what the section needs → probe what the student already knows or wants to explore → offer 3–5 research leads (one wildcard) → student confirms ideas. Logic checkpoint after each section.
- **Stage 3 – Outline** — Student builds sentence-level outline from their own confirmed ideas. Coach supplies structure only.
- **Stage 4 – Sources** — Review and select the research leads. Build references as they go.
- **Stage 5 – Drafting** — Student writes every sentence from their outline. Coach offers example transition language and light cleanup flags only.
- **Stage 6 – Revise** — Citation audit, flow, voice check, export to Word/PDF.
- **AI Checker** (`/ai-checker`) — Standalone tool. Student pastes text, gets signal-strength scores (not “AI likelihood”). Free preview + email unlock for full report.
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
- Test against this PRD and the Design System, not just “does it crash.”
- Only open issues on pages that have been declared visually complete.
- Prioritize issues that break one-frame-at-a-time or student-owns-the-sentences above all others.

## 7. Build Process Going Forward
1. Freeze automated QA → Coder loops on incomplete pages.
2. You + Strategist lock Design System and core copy.
3. Coding bot builds one page or major feature at a time against this file.
4. QA is called only after a page is visually and functionally complete.

---
Last updated: 2026-11-21
