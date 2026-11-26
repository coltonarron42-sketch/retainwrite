#!/usr/bin/env node
/**
 * PC-32 ghost exposure check (QA 4:57 PM). Calls every client-facing paper / autosave / coach read
 * endpoint (and the paper pages) for ONE paper that has a stored ghost, as the paper's owner, and
 * fails if any body carries a server:* key, the sealed ghost blob (rwg1:), or a ghost row name.
 * Also checks that writing a server:* key through autosave is refused.
 *
 *   BASE=https://<preview host> STATE=/path/storage-state.json PAPER=<paper uuid> \
 *   [SHARE_FILE=/path/file-with-share-url] node scripts/qa/ghost-exposure-check.mjs
 *
 * STATE is a Playwright storage state (its cookies sign you in). SHARE_FILE (optional) holds a
 * Vercel share link for a protected preview; it is read, never printed. Ghost TEXT (not just keys)
 * is proven by tests/unit/pc32-ghost-exposure.test.ts with a real sealed ghost (plaintext known).
 * // SOP: coaching only, never generate submission text
 */
import fs from "node:fs";

const { BASE, STATE, PAPER, SHARE_FILE } = process.env;
if (!BASE || !STATE || !PAPER) {
  console.error("Need BASE, STATE and PAPER.");
  process.exit(2);
}
const host = new URL(BASE).hostname;
const jar = new Map(
  JSON.parse(fs.readFileSync(STATE, "utf8"))
    .cookies.filter((c) => host.endsWith(c.domain.replace(/^\./, "")))
    .map((c) => [c.name, c.value]),
);
const cookie = () => [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
const keep = (res) => {
  for (const sc of res.headers.getSetCookie?.() ?? []) {
    const [kv] = sc.split(";");
    const i = kv.indexOf("=");
    jar.set(kv.slice(0, i), kv.slice(i + 1));
  }
};
if (SHARE_FILE) {
  let url = fs.readFileSync(SHARE_FILE, "utf8").trim();
  for (let i = 0; i < 5 && url; i++) {
    const r = await fetch(url, { redirect: "manual", headers: { cookie: cookie() } });
    keep(r);
    url = r.headers.get("location") ? new URL(r.headers.get("location"), url).toString() : "";
  }
}

const P = `/api/papers/${PAPER}`;
const json = (body) => ({ method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } });
const CALLS = [
  ["GET", `${P}/autosave`],
  ["GET", `${P}/intake/answers`],
  ["GET", `${P}/skeleton`],
  ["GET", `${P}/assignment/parse-status`],
  ["POST", `${P}/intake/brief`, { action: "context" }],
  ["POST", `${P}/coach/answer`, { mode: "answer", message: "What are the main leadership styles?", stage: 2, section: "Introduction" }],
  ["POST", `${P}/coach/fit`, { pair: { style: "servant", leader: "Sam Walton" }, source: "entry" }],
  ["POST", `${P}/stance/intent`, { message: "servant leadership with Sam Walton", ask: "What's your idea for this section?", section: "Introduction" }],
  ["PAGE", `/app/papers/${PAPER}`],
  ["PAGE", `/app/papers/${PAPER}/stage/1`],
  ["PAGE", `/app/papers/${PAPER}/stage/2`],
  ["PAGE", `/app/papers/${PAPER}/stage/3`],
];
const BAD = /server:|rwg1:|ghost_script|ghost_pending|fit_checks/;
let fail = 0;
for (const [m, path, body] of CALLS) {
  const init = m === "POST" ? json(body) : { method: "GET" };
  const res = await fetch(`${BASE}${path}`, { ...init, headers: { ...(init.headers ?? {}), cookie: cookie() }, redirect: "follow" });
  keep(res);
  const text = await res.text();
  const hit = text.match(BAD)?.[0] ?? null;
  if (hit || res.status >= 500 || res.status === 401) fail++;
  console.log(`${hit ? "FAIL" : res.status >= 500 || res.status === 401 ? "ERR " : "ok  "} ${m.padEnd(4)} ${path.replace(PAPER, ":paper")} → ${res.status}, ${text.length} bytes${hit ? `, found "${hit}"` : ""}`);
}
const w = await fetch(`${BASE}${P}/autosave`, { ...json({ fieldKey: "server:ghost_script", text: "x" }), headers: { "Content-Type": "application/json", cookie: cookie() } });
console.log(`${w.status === 400 ? "ok  " : "FAIL"} POST ${P.replace(PAPER, ":paper")}/autosave server:ghost_script → ${w.status} (must be 400)`);
if (w.status !== 400) fail++;
console.log(fail ? `\n${fail} problem(s)` : "\nAll clean: no server:* key, sealed ghost or ghost row name in any body; server key writes refused.");
process.exit(fail ? 1 : 0);
