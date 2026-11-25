#!/usr/bin/env node
/**
 * Give an account a ready Stage 3 (Outline) paper by copying a known-good paper that
 * just finished Stage 2: assignment, intake answers, voice sample, style profile,
 * Stance notes and the coaching session. Stage 3 starts fresh: no outline saves. The source paper is not touched and
 * the target's other papers are not touched. No passwords, no emails sent.
 * Locked to production project hstxsytpcpusmjlcrhfz.
 *
 *   node scripts/clone-stage3-paper.mjs --from <paperId> --to <email> [--title "..."]
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
    let v = line.slice(eq + 1).trim().replace(/^(['"])(.*)\1$/, "$2");
    if (!process.env[k]) process.env[k] = v;
  }
}
const fail = (m) => { console.error(m); process.exit(1); };
const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
const from = arg("--from"), to = (arg("--to") || "").toLowerCase(), title = arg("--title");
if (!from || !to) fail("usage: --from <paperId> --to <email> [--title ...]");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
if (!url.includes(`${ALLOWED_PROJECT_REF}.supabase.co`)) fail(`Refusing: not project ${ALLOWED_PROJECT_REF}.`);
const db = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY || fail("missing service role"), { auth: { persistSession: false } });
const must = (r, what) => { if (r.error) throw new Error(`${what}: ${r.error.message}`); return r.data; };

const prof = must(await db.from("profiles").select("user_id, email").ilike("email", to).maybeSingle(), "profile");
if (!prof) fail(`No account for ${to}. Not creating one.`);
const uid = prof.user_id;
const src = must(await db.from("papers").select("*").eq("id", from).single(), "source paper");
if ((src.current_stage ?? 1) !== 3) fail("Source paper must be at Stage 3 (Stance done).");
const pid = crypto.randomUUID();
const now = new Date().toISOString();
const created = [];
try {
  const { id: _i, user_id: _u, created_at: _c, updated_at: _d, payoff_shown_at: _p, ...rest } = src;
  must(await db.from("papers").insert({ ...rest, id: pid, user_id: uid, title: title || src.title, current_stage: 3, is_free_paper: false, funded_by: null, resume: { stage: 3, screen: "outline", at: Date.now() }, created_at: now, updated_at: now }), "paper");
  created.push(pid);
  const asg = must(await db.from("assignments").select("*").eq("paper_id", from), "assignments");
  const asgMap = {};
  for (const a of asg) {
    const id = crypto.randomUUID(); asgMap[a.id] = id;
    must(await db.from("assignments").insert({ ...a, id, paper_id: pid, user_id: uid, created_at: now, updated_at: now }), "assignment");
  }
  const files = must(await db.from("assignment_files").select("*").eq("paper_id", from), "files");
  for (const f of files) {
    if (f.storage_path) continue; // pasted text only; never point at another user's storage
    must(await db.from("assignment_files").insert({ ...f, id: crypto.randomUUID(), assignment_id: asgMap[f.assignment_id] ?? null, paper_id: pid, user_id: uid, created_at: now }), "file");
  }
  const answers = must(await db.from("intake_answers").select("*").eq("paper_id", from), "intake");
  for (const a of answers) must(await db.from("intake_answers").insert({ ...a, id: crypto.randomUUID(), paper_id: pid, user_id: uid, created_at: now }), "intake answer");
  const style = must(await db.from("style_profiles").select("*").eq("paper_id", from), "style");
  for (const s of style) must(await db.from("style_profiles").insert({ ...s, paper_id: pid, user_id: uid, created_at: now }), "style profile");
  const saves = must(await db.from("paper_autosaves").select("field_key, draft_text, submitted").eq("paper_id", from), "autosaves");
  const keep = saves.filter((s) => /^(intake:|stage1:|stance:|loop_session|paper_context$)/.test(s.field_key));
  const ls = keep.find((s) => s.field_key.startsWith("loop_session"));
  if (ls && /outline/i.test(ls.draft_text ?? "") && /"outlineDone"\s*:\s*true/.test(ls.draft_text ?? "")) fail("Source already has outline progress; use a paper fresh into Stage 3.");
  if (keep.length) must(await db.from("paper_autosaves").insert(keep.map((s) => ({ ...s, paper_id: pid, user_id: uid, updated_at: now }))), "autosaves");
  const sp = must(await db.from("stage_progress").select("stage, data").eq("paper_id", from).in("stage", [1, 2]), "stage progress");
  const spData = (n) => sp.find((r) => r.stage === n)?.data ?? {};
  // A trigger seeds stage_progress on insert: upsert over it.
  must(await db.from("stage_progress").upsert([1, 2, 3, 4, 5, 6].map((stage) => ({
    paper_id: pid, user_id: uid, stage,
    status: stage <= 2 ? "complete" : stage === 3 ? "in_progress" : "locked",
    data: stage <= 2 ? spData(stage) : {},
    completed_at: stage <= 2 ? now : null,
  })), { onConflict: "paper_id,stage" }), "stage_progress");
  console.log(`created paper ${pid} for ${to} at Stage 3 (${answers.length} intake answers, ${style.length} style profile, ${keep.length} stage 1-2 saves)`);
} catch (e) {
  console.error(String(e.message || e));
  if (created.length) {
    for (const t of ["stage_progress", "paper_autosaves", "style_profiles", "intake_answers", "assignment_files", "assignments"]) await db.from(t).delete().eq("paper_id", pid);
    await db.from("papers").delete().eq("id", pid);
    console.error("rolled back");
  }
  process.exit(1);
}
