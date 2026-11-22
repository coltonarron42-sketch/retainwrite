"use client";

/**
 * Voice call (PLAN.md 9): with Voice on, the chat works like a Teams/Skype
 * call. Pau Pau speaks her own words; the student's mic listens between her
 * turns (paused while she talks, so she doesn't hear herself), and a reply
 * sends itself after a short silence. Only one chat box listens at a time:
 * the newest one on screen.
 */

let owner = 0;
let nextId = 1;
const listeners = new Set<() => void>();

export function claimCall(): number {
  const id = nextId++;
  owner = id;
  listeners.forEach((l) => l());
  return id;
}

export function releaseCall(id: number) {
  if (owner !== id) return;
  owner = 0;
  listeners.forEach((l) => l());
}

export function callOwner(): number {
  return owner;
}

export function subscribeCall(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** Silence before a heard reply sends itself. Longer while words are still "in progress". */
export const SILENCE_SEND_MS = 1600;
export const SILENCE_INTERIM_MS = 2800;

/** How long to wait before restarting after the browser ends a listening session. */
export function restartDelayMs(recentRestarts: number): number {
  return Math.min(4000, 250 * 2 ** Math.max(0, recentRestarts - 1));
}

export type CallStatus = "off" | "listening" | "paused" | "muted" | "unsupported" | "blocked" | "error";

export function callStatusText(status: CallStatus): string | null {
  switch (status) {
    case "listening":
      return "Listening… just talk, and I'll send it when you pause.";
    case "paused":
      // Short: at 390px it must fit beside 'Talk now' in two lines like 'Listening…'.
      return "Pau Pau is talking. Your mic is paused.";
    case "muted":
      return "Your mic is muted. Type, or unmute to talk.";
    case "unsupported":
      return "Voice replies aren't available in this browser. You'll still hear Pau Pau; type your reply.";
    case "blocked":
      return "The microphone is blocked. Allow it in your browser settings, or type your reply.";
    case "error":
      return "Voice replies stopped working here. Type your reply, or tap Unmute to try again.";
    default:
      return null;
  }
}
