# Supabase Auth URL checklist (RetainWrite)

Do this in the **Retain write** project (`hstxsytpcpusmjlcrhfz`):

## 1. Authentication → URL Configuration

| Setting | Value |
|---|---|
| **Site URL** | `https://retainwrite.com` |
| **Redirect URLs** | Add all of: |

```
https://retainwrite.com/**
https://www.retainwrite.com/**
https://retainwrite.vercel.app/**
https://retainwrite.com/auth/confirm
https://retainwrite.com/auth/callback
https://www.retainwrite.com/auth/confirm
https://www.retainwrite.com/auth/callback
```

A wrong Site URL (especially `http://localhost:3000`) is the usual cause of Safari/Gmail “can’t connect to server” after clicking the confirm link.

## 2. Authentication → Email Templates → Confirm sign up

Replace the default confirmation link with the HTML in `docs/supabase-confirm-email-template.html` (token_hash → `/auth/confirm` on your Site URL).

Also update **Magic Link** and **Reset password** templates the same way if you use them (`type=email` or `type=recovery` as appropriate).

## 3. App routes (in this repo)

- `/auth/confirm` — `verifyOtp({ token_hash, type })` then redirect to `/app`
- `/auth/callback` — PKCE `code` exchange + token_hash fallback; failures redirect to `/login?error=…`

## 4. Env

Set `NEXT_PUBLIC_SITE_URL=https://retainwrite.com` on Vercel (production + preview).
