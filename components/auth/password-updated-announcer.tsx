"use client";

import { useEffect } from "react";
import { announcePasswordUpdated } from "@/lib/auth/password-updated-signal";

/** Tells any /login or /forgot-password tab in this browser that the reset finished. */
export function PasswordUpdatedAnnouncer({ email }: { email: string }) {
  useEffect(() => {
    if (email) announcePasswordUpdated(email);
  }, [email]);
  return null;
}
