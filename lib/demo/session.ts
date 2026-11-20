export const DEMO_SESSION_COOKIE = "rw_demo_session";

export const DEMO_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

export type DemoSession = {
  email: string;
  displayName: string;
  createdAt: string;
};

export function createDemoSession(input?: {
  email?: string;
  displayName?: string;
}): DemoSession {
  const email = (input?.email ?? "demo@retainwrite.com").trim().toLowerCase();
  const fromLocalPart =
    email.includes("@") && email !== "demo@retainwrite.com"
      ? email.split("@")[0]
      : "";
  const displayName =
    input?.displayName?.trim() || fromLocalPart || "Demo Student";

  return {
    email: email || "demo@retainwrite.com",
    displayName,
    createdAt: new Date().toISOString(),
  };
}

export function serializeDemoSession(session: DemoSession): string {
  return JSON.stringify(session);
}

export function parseDemoSession(raw: string | undefined | null): DemoSession | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<DemoSession>;
    if (!parsed || typeof parsed.email !== "string") return null;
    return {
      email: parsed.email,
      displayName:
        typeof parsed.displayName === "string" && parsed.displayName
          ? parsed.displayName
          : "Demo Student",
      createdAt:
        typeof parsed.createdAt === "string" && parsed.createdAt
          ? parsed.createdAt
          : new Date(0).toISOString(),
    };
  } catch {
    return null;
  }
}
