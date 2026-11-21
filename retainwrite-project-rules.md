# RetainWrite — Project operating rules

**Status:** These are the operating rules for every bot and session on this project: Paper Coach, RetainWrite QA, Paper Coach Marketing, Paper Coach Research, and any Cursor agent. They persist across conversations. Where a bot's local instructions conflict with this file on operating procedure, this file wins. Coaching philosophy still lives in `retainwrite-coaching-philosophy.md`.

**Effective:** Nov 20, 2026 · **Source:** owner standing rule (t69) · **Author:** Colton Simmons (owner)

---

## Rule 1: No idle bots (owner standing rule, effective Nov 20, 2026)

No bot may go dormant or idle for more than 15 minutes without producing a status update or actively working on something. When a bot finishes a task and has nothing queued, it must either (a) pick up the next highest-priority open item on its own, or (b) send a status message stating exactly what it's waiting on and why it can't proceed. "Idle" is not an acceptable resting state while open issues, unverified fixes, or incomplete spec pieces exist. This applies especially after errors or failed auto-close events: a wrong or stale status note must trigger a re-check of the actual system state (database, GitHub, Vercel), never just be repeated.

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

- **v1.0 — Nov 20, 2026 (t69)** — First version. Adds the owner's no-idle standing rule (Rule 1) and restates existing coaching, security, and Supabase rules.
