"use client";

import { useEffect, useSyncExternalStore } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Small per-user preferences for the coach chat. Saved to the user's account
 * (Supabase user_metadata) so they follow the student across devices, with a
 * localStorage copy so the setting applies instantly on reload.
 */
export type ChatPrefs = { voice: boolean; sparkOff: boolean };

const META_KEYS: Record<keyof ChatPrefs, string> = { voice: "pau_voice", sparkOff: "pau_spark_off" };
const LOCAL_KEY = "rw:chat-prefs";
const SERVER: ChatPrefs = { voice: false, sparkOff: false };

let state: ChatPrefs | null = null;
let remoteLoaded = false;
const listeners = new Set<() => void>();

function readLocal(): ChatPrefs {
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<ChatPrefs>;
      return { voice: p.voice === true, sparkOff: p.sparkOff === true };
    }
  } catch {
    /* ignore */
  }
  return { ...SERVER };
}

function snapshot(): ChatPrefs {
  if (!state) state = readLocal();
  return state;
}

function commit(next: ChatPrefs) {
  state = next;
  try {
    window.localStorage.setItem(LOCAL_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

async function loadRemote() {
  if (remoteLoaded) return;
  remoteLoaded = true;
  try {
    const supabase = createClient();
    const { data } = await supabase.auth.getUser();
    const meta = (data.user?.user_metadata ?? {}) as Record<string, unknown>;
    const cur = snapshot();
    const next = { ...cur };
    for (const k of Object.keys(META_KEYS) as (keyof ChatPrefs)[]) {
      const v = meta[META_KEYS[k]];
      if (typeof v === "boolean") next[k] = v;
    }
    if (next.voice !== cur.voice || next.sparkOff !== cur.sparkOff) commit(next);
  } catch {
    /* demo mode or offline: the local copy still works */
  }
}

export function setChatPref<K extends keyof ChatPrefs>(key: K, value: ChatPrefs[K]) {
  commit({ ...snapshot(), [key]: value });
  void (async () => {
    try {
      const supabase = createClient();
      await supabase.auth.updateUser({ data: { [META_KEYS[key]]: value } });
    } catch {
      /* keep the local copy */
    }
  })();
}

export function useChatPrefs(): ChatPrefs {
  const prefs = useSyncExternalStore(subscribe, snapshot, () => SERVER);
  useEffect(() => {
    void loadRemote();
  }, []);
  return prefs;
}
