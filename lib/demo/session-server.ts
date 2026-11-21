import { cookies } from "next/headers";
import { mutateCookie } from "@/lib/supabase/server-cookies";
import {
  createDemoSession,
  DEMO_SESSION_COOKIE,
  DEMO_SESSION_MAX_AGE_SECONDS,
  parseDemoSession,
  serializeDemoSession,
  type DemoSession,
} from "@/lib/demo/session";

export async function getDemoSession(): Promise<DemoSession | null> {
  const cookieStore = await cookies();
  return parseDemoSession(cookieStore.get(DEMO_SESSION_COOKIE)?.value);
}

export async function setDemoSession(input?: {
  email?: string;
  displayName?: string;
}): Promise<DemoSession> {
  const session = createDemoSession(input);
  const cookieStore = await cookies();
  cookieStore.set(DEMO_SESSION_COOKIE, serializeDemoSession(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DEMO_SESSION_MAX_AGE_SECONDS,
  });
  return session;
}

export async function clearDemoSession(): Promise<void> {
  const cookieStore = await cookies();
  mutateCookie(() => {
    cookieStore.delete(DEMO_SESSION_COOKIE);
  });
}
