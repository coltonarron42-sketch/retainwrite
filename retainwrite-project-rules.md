# RetainWrite — Project operating rules

**Status:** These are the operating rules for every bot and session on this project: Paper Coach, RetainWrite QA, Paper Coach Marketing, Paper Coach Research, and any Cursor agent. They persist across conversations. Where a bot's local instructions conflict with this file on operating procedure, this file wins. Coaching philosophy still lives in `retainwrite-coaching-philosophy.md`.

**Effective:** Nov 20, 2026 · **Source:** owner standing rules (t69, t70) · **Author:** Colton Simmons (owner)

---

## Rule 1: No idle bots (owner standing rule, effective Nov 20, 2026)

No bot may go dormant or idle for more than 15 minutes without producing a status update or actively working on something. When a bot finishes a task and has nothing queued, it must either (a) pick up the next highest-priority open item on its own, or (b) send a status message stating exactly what it's waiting on and why it can't proceed. "Idle" is not an acceptable resting state while open issues, unverified fixes, or incomplete spec pieces exist. This applies especially after errors or failed auto-close events: a wrong or stale status note must trigger a re-check of the actual system state (database, GitHub, Vercel), never just be repeated.

Rule 2's "go dormant when the owner is unreachable" clause and Rule 3's Marketing/Research exception override this rule.

---

## Rule 2: Autonomy first (owner standing rule, effective Nov 20, 2026)

When a task requires logging into an external service (Supabase, Resend, Vercel, GitHub, Porkbun), use the browser to attempt it yourself before asking the owner. Search for workarounds, try alternate paths, and use existing credentials or connected tools (for example, try "Sign in with GitHub" first). Only surface to the owner when self-serve options are exhausted and it truly requires his hands. If the owner is unreachable (sleeping, no phone), go dormant to save credits rather than blocking.

Autonomy never covers a breach of the hard limits in Existing rules (security, coaching only, no secrets).

---

## Rule 3: Marketing and Research (owner standing rule, effective Nov 20, 2026)

If Marketing or Research has no active assignment, let them go idle (this is the exception to Rule 1). Do not ping the owner for routine clarifications; resolve them using this rules file, the coaching philosophy, and prior conversation context. The owner's priority is an operating site through Stage 3, not perfection. Bypass him as a roadblock at every turn.

---

## Existing rules

These rules were already in force. They are restated here so they stay visible to every bot and session.

- **Coaching only.** Never generate submission text. The student writes every sentence.
- **No detector-evasion framing.** Do not frame the product, coaching, or any feature as a way to evade AI detectors.
- **No secrets in code, commits, logs, or chat.** Secrets belong only in Vercel environment variables. Never print or echo `GROK_API_KEY` or any other secret.
- **Supabase project scope.** Only touch the Supabase project **Retain write** (ref `hstxsytpcpusmjlcrhfz`). Never touch **coltonarron42-sketch's Project** (ref `upawqulgmoqkihoyymra`).
- **Private schema.** The database schema `private` must never be exposed via the API.

---

## Changelog

- **v1.1 — Nov 20, 2026 (t70)** — Adds Rule 2 (autonomy first) and Rule 3 (Marketing and Research may idle). Clarifies that Rule 2's unreachable-owner dormancy and Rule 3's exception override Rule 1. Autonomy never covers the Existing rules hard limits.
- **v1.0 — Nov 20, 2026 (t69)** — First version. Adds the owner's no-idle standing rule (Rule 1) and restates existing coaching, security, and Supabase rules.
