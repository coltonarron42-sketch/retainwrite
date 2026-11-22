"use client";

import { useEffect, useSyncExternalStore } from "react";
import { createClient } from "@/lib/supabase/client";
import { localUser, readScoped, writeScoped } from "@/lib/local/user-scope";

/**
 * Small per-user preferences for the coach chat. The account (Supabase
 * user_metadata) is the source of truth; a copy scoped to this user id in
 * localStorage only makes a reload instant. A new account starts with
 * everything off, whatever another account in this browser chose.
 */
export type ChatPrefs = { voice: boolean; sparkOff: boolean };

const META_KEYS: Record<keyof ChatPrefs, string> = { voice: "pau_voice", sparkOff: "pau_spark_off" };
const NAME = "chat-prefs";
const DEFAULTS: ChatPrefs = { voice: false, sparkOff: false };

type State = { uid: string; prefs: ChatPrefs };
let state: State | null = null;
const remoteLoaded = new Set<string>();
const listeners = new Set<() => void>();

function readLocal(): ChatPrefs {
  try {
    const raw = readScoped(NAME);
    if (raw) {
      const p = JSON.parse(raw) as Partial<ChatPrefs>;
      return { voice: p.voice === true, sparkOff: p.sparkOff === true };
    }
  } catch {
    /* ignore */
  }
  return { ...DEFAULTS };
}

function current(): State {
  const uid = localUser();
  if (!state || state.uid !== uid) {
    state = { uid, prefs: readLocal() };
    // Old browser-wide copy (pre-scoping) leaked between accounts: drop it.
    try {
      window.localStorage.removeItem("rw:chat-prefs");
    } catch {
      /* ignore */
    }
  }
  return state;
}

function snapshot(): ChatPrefs {
  return current().prefs;
}

function commit(uid: string, prefs: ChatPrefs) {
  if (localUser() !== uid) return;
  if (uid === "anon") {
    state = { uid, prefs };
    listeners.forEach((l) => l());
    return; // signed out: keep in memory only
  }
  state = { uid, prefs };
  writeScoped(NAME, JSON.stringify(prefs));
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

async function loadRemote() {
  const uid = localUser();
  if (uid === "anon" || uid === "demo" || remoteLoaded.has(uid)) return;
  remoteLoaded.add(uid);
  try {
    const supabase = createClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user || data.user.id !== uid) return;
    const meta = (data.user.user_metadata ?? {}) as Record<string, unknown>;
    // The account wins; a setting it never saved is off.
    const next: ChatPrefs = { voice: meta[META_KEYS.voice] === true, sparkOff: meta[META_KEYS.sparkOff] === true };
    const cur = current().prefs;
    if (next.voice !== cur.voice || next.sparkOff !== cur.sparkOff) commit(uid, next);
  } catch {
    remoteLoaded.delete(uid);
  }
}

export function setChatPref<K extends keyof ChatPrefs>(key: K, value: ChatPrefs[K]) {
  const { uid, prefs } = current();
  commit(uid, { ...prefs, [key]: value });
  if (uid === "anon" || uid === "demo") return;
  void (async () => {
    try {
      const supabase = createClient();
      await supabase.auth.updateUser({ data: { [META_KEYS[key]]: value } });
    } catch {
      /* keep the local copy */
    }
  })();
}

/** Forget the in-memory copy (log out). */
export function resetChatPrefs() {
  state = null;
  remoteLoaded.clear();
  listeners.forEach((l) => l());
}

export function useChatPrefs(): ChatPrefs {
  const prefs = useSyncExternalStore(subscribe, snapshot, () => DEFAULTS);
  useEffect(() => {
    void loadRemote();
  });
  return prefs;
}
