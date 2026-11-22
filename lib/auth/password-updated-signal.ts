/**
 * Same-browser nudge: the reset tab tells any open /login or /forgot-password
 * tab that the password changed. Different browsers or devices can't hear this;
 * the reset page's message covers them.
 */
export const PASSWORD_UPDATED_CHANNEL = "rw-auth";
export const PASSWORD_UPDATED_KEY = "rw-password-updated";

export type PasswordUpdatedSignal = { type: "password-updated"; email: string; at: number };

export function parsePasswordUpdatedSignal(raw: unknown): PasswordUpdatedSignal | null {
  let value = raw;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (v.type !== "password-updated" || typeof v.email !== "string" || typeof v.at !== "number") {
    return null;
  }
  return { type: "password-updated", email: v.email, at: v.at };
}

export function announcePasswordUpdated(email: string) {
  const signal: PasswordUpdatedSignal = { type: "password-updated", email, at: Date.now() };
  try {
    const channel = new BroadcastChannel(PASSWORD_UPDATED_CHANNEL);
    channel.postMessage(signal);
    channel.close();
  } catch {
    // BroadcastChannel unavailable; the storage event below still fires.
  }
  try {
    window.localStorage.setItem(PASSWORD_UPDATED_KEY, JSON.stringify(signal));
    window.localStorage.removeItem(PASSWORD_UPDATED_KEY);
  } catch {
    // Storage blocked (private mode). The on-page message still shows.
  }
}

export function onPasswordUpdated(handler: (signal: PasswordUpdatedSignal) => void): () => void {
  let channel: BroadcastChannel | null = null;
  try {
    channel = new BroadcastChannel(PASSWORD_UPDATED_CHANNEL);
    channel.onmessage = (event) => {
      const signal = parsePasswordUpdatedSignal(event.data);
      if (signal) handler(signal);
    };
  } catch {
    channel = null;
  }
  const onStorage = (event: StorageEvent) => {
    if (event.key !== PASSWORD_UPDATED_KEY || !event.newValue) return;
    const signal = parsePasswordUpdatedSignal(event.newValue);
    if (signal) handler(signal);
  };
  window.addEventListener("storage", onStorage);
  return () => {
    channel?.close();
    window.removeEventListener("storage", onStorage);
  };
}
