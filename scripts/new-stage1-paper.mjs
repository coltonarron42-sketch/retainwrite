#!/usr/bin/env node
/**
 * Give an existing account a fresh, empty Stage 1 paper (no credits used, nothing
 * else touched). No accounts or passwords are created; no emails are sent.
 * Locked to production project hstxsytpcpusmjlcrhfz.
 *
 *   node scripts/new-stage1-paper.mjs --to <email> --title "..."
 */
import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ALLOWED_PROJECT_REF = "hstxsytpcpusmjlcrhfz";
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envFile = path.join(repoRoot, ".env.local");
if (fs.existsSync(envFile)) {
  for (const raw of fs.readFileSync(envFile, "utf8").split("\n")) {
    const line = raw.trim();
    const eq = line.indexOf("=");
    if (!line || line.startsWith("#") || eq <= 0) continue;
    const k = line.slice(0, eq).trim();
    const v = line.slice(eq + 1).trim().replace(/^(['"])(.*)\1$/, "$2");
    if (!process.env[k]) process.env[k] = v;
  }
}
const fail = (m) => { console.error(m); process.exit(1); };
const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
const to = (arg("--to") || "").toLowerCase(), title = arg("--title");
if (!to || !title) fail("usage: --to <email> --title ...");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
if (!url.includes(`${ALLOWED_PROJECT_REF}.supabase.co`)) fail(`Refusing: not project ${ALLOWED_PROJECT_REF}.`);
const db = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY || fail("missing service role"), { auth: { persistSession: false } });
const prof = await db.from("profiles").select("user_id").ilike("email", to).maybeSingle();
if (prof.error) fail(prof.error.message);
if (!prof.data) fail(`No account for ${to}. Not creating one.`);
const id = crypto.randomUUID();
const now = new Date().toISOString();
const r = await db.from("papers").insert({ id, user_id: prof.data.user_id, title, current_stage: 1, is_free_paper: false, funded_by: null, audio_unlocked: false, created_at: now, updated_at: now });
if (r.error) fail(r.error.message);
console.log(JSON.stringify({ paperId: id, url: `https://www.retainwrite.com/app/papers/${id}/stage/1` }));
