#!/usr/bin/env node
/**
 * Create or reuse pre-confirmed RetainWrite test users via the Supabase Admin API.
 *
 * Confirmation email is skipped (email_confirm: true). Real users are untouched.
 * Locked to production project hstxsytpcpusmjlcrhfz.
 *
 * Usage (from the repo root, with env loaded from .env.local or the environment):
 *   node scripts/seed-test-users.mjs
 *   node scripts/seed-test-users.mjs --reset
 *   node scripts/seed-test-users.mjs --reset rw.test.qa1@example.com
 *   node scripts/seed-test-users.mjs --verify
 *   node scripts/seed-test-users.mjs --rotate   # new passwords for all seeded users
 *
 * Required env: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
 * SUPABASE_SERVICE_ROLE_KEY. Never prints those values or passwords.
 *
 * Passwords are written only to /workspace/secrets/rw-test-accounts.json (mode 0600),
 * never to the repo.
 */

import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ALLOWED_PROJECT_REF = "hstxsytpcpusmjlcrhfz";
const FORBIDDEN_PROJECT_REF = "upawqulgmoqkihoyymra";
const TEST_DOMAIN = "example.com";
const TEST_LOCAL_PREFIX = "rw.test.";
const DEFAULT_CREDS_PATH = "/workspace/secrets/rw-test-accounts.json";
const STORAGE_BUCKET = "assignment-files";

const ACCOUNTS = [
  { email: "rw.test.qa1@example.com", role: "e2e-desktop" },
  { email: "rw.test.qa2@example.com", role: "e2e-mobile" },
  { email: "rw.test.qa3@example.com", role: "qa-desktop" },
  { email: "rw.test.qa4@example.com", role: "qa-mobile" },
  { email: "rw.test.qa5@example.com", role: "e2e-spare-1" },
  { email: "rw.test.qa6@example.com", role: "e2e-spare-2" },
  { email: "rw.test.qa7@example.com", role: "qa-spare-1" },
  { email: "rw.test.qa8@example.com", role: "qa-spare-2" },
];

const ALLOWED_EMAILS = new Set(ACCOUNTS.map((a) => a.email));

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, "utf8");
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] == null || process.env[key] === "") {
      process.env[key] = value;
    }
  }
}

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
loadEnvFile(path.join(repoRoot, ".env.local"));
loadEnvFile(path.join(repoRoot, ".env"));

function fail(message) {
  console.error(message);
  process.exit(1);
}

function isAllowedTestEmail(email) {
  const normalized = String(email || "").trim().toLowerCase();
  if (!ALLOWED_EMAILS.has(normalized)) return false;
  const [local, domain] = normalized.split("@");
  return domain === TEST_DOMAIN && local.startsWith(TEST_LOCAL_PREFIX);
}

function strongPassword() {
  const raw = crypto.randomBytes(24).toString("base64url");
  // Guarantee mixed character classes for typical password rules.
  return `${raw}Aa9!`;
}

function parseArgs(argv) {
  const args = { reset: false, verify: false, rotate: false, resetEmails: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--reset") {
      args.reset = true;
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        args.resetEmails.push(next.toLowerCase());
        i += 1;
      }
    } else if (token === "--verify") {
      args.verify = true;
    } else if (token === "--rotate") {
      args.rotate = true;
    } else if (token === "--creds-file") {
      args.credsFile = argv[i + 1];
      i += 1;
    } else if (token.startsWith("--")) {
      fail(`Unknown flag: ${token}`);
    } else if (args.reset) {
      args.resetEmails.push(token.toLowerCase());
    } else {
      fail(`Unexpected argument: ${token}`);
    }
  }
  return args;
}

function readCreds(credsPath) {
  if (!fs.existsSync(credsPath)) return { accounts: [] };
  try {
    const parsed = JSON.parse(fs.readFileSync(credsPath, "utf8"));
    const accounts = Array.isArray(parsed?.accounts) ? parsed.accounts : [];
    return { ...parsed, accounts };
  } catch {
    fail(`Could not parse ${credsPath}`);
  }
}

function writeCreds(credsPath, payload) {
  fs.mkdirSync(path.dirname(credsPath), { recursive: true, mode: 0o700 });
  fs.writeFileSync(credsPath, `${JSON.stringify(payload, null, 2)}\n`, { mode: 0o600 });
  fs.chmodSync(credsPath, 0o600);
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) fail(`Missing ${name}. Put it in .env.local or the environment.`);
  return value;
}

function createAdminClient() {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  if (!url.includes(ALLOWED_PROJECT_REF)) {
    fail(`Refusing to run: NEXT_PUBLIC_SUPABASE_URL is not project ${ALLOWED_PROJECT_REF}.`);
  }
  if (url.includes(FORBIDDEN_PROJECT_REF)) {
    fail("Refusing to run: NEXT_PUBLIC_SUPABASE_URL points at the forbidden project.");
  }
  const serviceRole = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function createAnonClient() {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anon = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  return createClient(url, anon, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function findUserByEmail(admin, email) {
  if (typeof admin.auth.admin.getUserByEmail === "function") {
    const { data, error } = await admin.auth.admin.getUserByEmail(email);
    if (!error && data?.user) return data.user;
    if (error && !/not found|unable to find|user not found/i.test(error.message)) {
      throw new Error(`getUserByEmail(${email}): ${error.message}`);
    }
  }
  let page = 1;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`listUsers: ${error.message}`);
    const users = data?.users ?? [];
    const match = users.find((user) => user.email?.toLowerCase() === email);
    if (match) return match;
    if (users.length < 200) return null;
    page += 1;
    if (page > 20) throw new Error("listUsers exceeded the safety page limit.");
  }
}

async function ensureUser(admin, { email, role, password, rotate }) {
  const existing = await findUserByEmail(admin, email);
  if (!existing) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { rw_test_role: role, rw_test_account: true },
    });
    if (error) throw new Error(`createUser(${email}): ${error.message}`);
    return { user: data.user, created: true, password };
  }

  const patch = {
    email_confirm: true,
    user_metadata: {
      ...(existing.user_metadata ?? {}),
      rw_test_role: role,
      rw_test_account: true,
    },
  };
  if (rotate) patch.password = password;
  const { error } = await admin.auth.admin.updateUserById(existing.id, patch);
  if (error) throw new Error(`updateUserById(${email}): ${error.message}`);
  return { user: { ...existing }, created: false, password };
}

async function ensureProfileReady(admin, userId, email) {
  const { error } = await admin.from("profiles").upsert(
    {
      user_id: userId,
      email,
      terms_accepted_at: new Date().toISOString(),
      guardian_status: "not_required",
      free_paper_used: false,
    },
    { onConflict: "user_id" },
  );
  if (error) throw new Error(`profiles upsert(${email}): ${error.message}`);
}

async function deleteStorageForUser(admin, userId) {
  const { data: files, error } = await admin.storage.from(STORAGE_BUCKET).list(userId, {
    limit: 1000,
  });
  if (error && !/not found|The resource was not found/i.test(error.message)) {
    console.error(`storage list warning for ${userId}: ${error.message}`);
    return 0;
  }
  const names = (files ?? []).map((file) => `${userId}/${file.name}`);
  if (names.length === 0) return 0;
  const { error: removeError } = await admin.storage.from(STORAGE_BUCKET).remove(names);
  if (removeError) {
    console.error(`storage remove warning: ${removeError.message}`);
    return 0;
  }
  return names.length;
}

async function resetUser(admin, email) {
  if (!isAllowedTestEmail(email)) {
    fail(`Refusing to reset ${email}: not in the seeded test allowlist.`);
  }
  const user = await findUserByEmail(admin, email);
  if (!user) {
    console.log(`reset skipped: ${email} does not exist yet`);
    return { email, papers: 0, files: 0 };
  }

  const { data: papers, error: paperSelectError } = await admin
    .from("papers")
    .select("id")
    .eq("user_id", user.id);
  if (paperSelectError) throw new Error(`list papers(${email}): ${paperSelectError.message}`);
  const paperIds = (papers ?? []).map((row) => row.id);

  if (paperIds.length > 0) {
    const { error: purchaseError } = await admin
      .from("purchases")
      .update({ paper_id: null })
      .eq("user_id", user.id)
      .in("paper_id", paperIds);
    if (purchaseError) throw new Error(`clear purchases(${email}): ${purchaseError.message}`);

    const { error: deleteError } = await admin.from("papers").delete().eq("user_id", user.id);
    if (deleteError) throw new Error(`delete papers(${email}): ${deleteError.message}`);
  }

  const files = await deleteStorageForUser(admin, user.id);

  const { error: profileError } = await admin
    .from("profiles")
    .update({ free_paper_used: false, terms_accepted_at: new Date().toISOString() })
    .eq("user_id", user.id);
  if (profileError) throw new Error(`reset profile(${email}): ${profileError.message}`);

  return { email, papers: paperIds.length, files };
}

async function verifyLogin(email, password) {
  const anon = createAnonClient();
  const { data, error } = await anon.auth.signInWithPassword({ email, password });
  if (error) return { email, ok: false, reason: error.message };
  const confirmed = Boolean(data.user?.email_confirmed_at || data.session);
  await anon.auth.signOut({ scope: "local" });
  return { email, ok: confirmed, reason: confirmed ? "signed in" : "no session" };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const credsPath = args.credsFile || process.env.RW_TEST_ACCOUNTS_FILE || DEFAULT_CREDS_PATH;
  const admin = createAdminClient();
  const existingFile = readCreds(credsPath);
  const existingByEmail = new Map(
    (existingFile.accounts ?? []).map((account) => [account.email, account]),
  );

  const seeded = [];
  for (const account of ACCOUNTS) {
    const previous = existingByEmail.get(account.email);
    const password =
      !args.rotate && previous?.password ? previous.password : strongPassword();
    const result = await ensureUser(admin, {
      email: account.email,
      role: account.role,
      password,
      rotate: args.rotate || !previous?.password,
    });
    await ensureProfileReady(admin, result.user.id, account.email);
    seeded.push({
      email: account.email,
      role: account.role,
      user_id: result.user.id,
      password,
      created: result.created,
      confirmed: true,
    });
    console.log(
      `${result.created ? "created" : "updated"} ${account.email} (${account.role})`,
    );
  }

  writeCreds(credsPath, {
    project_ref: ALLOWED_PROJECT_REF,
    domain: TEST_DOMAIN,
    updated_at: new Date().toISOString(),
    accounts: seeded.map(({ email, role, user_id, password, confirmed }) => ({
      email,
      role,
      user_id,
      password,
      confirmed,
    })),
  });
  console.log(`Wrote ${seeded.length} accounts to ${credsPath}`);

  const shouldReset = args.reset || args.resetEmails.length > 0;
  if (shouldReset) {
    const targets = args.resetEmails.length > 0 ? args.resetEmails : seeded.map((a) => a.email);
    for (const email of targets) {
      const result = await resetUser(admin, email);
      console.log(`reset ${result.email}: ${result.papers} papers, ${result.files} files`);
    }
  }

  if (args.verify || !args.reset || args.resetEmails.length === 0) {
    // Always verify after seed unless the caller only asked for a reset of existing users
    // and also passed --verify=false implicitly... Default: verify after seed.
    const verifyTargets = seeded;
    let failed = 0;
    for (const account of verifyTargets) {
      const result = await verifyLogin(account.email, account.password);
      if (result.ok) {
        console.log(`login ok ${result.email}`);
      } else {
        failed += 1;
        console.error(`login FAILED ${result.email}: ${result.reason}`);
      }
    }
    if (failed > 0) fail(`${failed} test account(s) failed password login.`);
  }
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
