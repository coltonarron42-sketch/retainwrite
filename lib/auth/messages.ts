/** Map Supabase Auth errors into short, user-facing copy. */
export function formatAuthError(message: string): string {
  const lower = message.toLowerCase();

  if (
    lower.includes("email not confirmed") ||
    lower.includes("confirm your email") ||
    lower.includes("email_not_confirmed")
  ) {
    return "Confirm your email before signing in. Check your inbox for the verification link.";
  }

  if (lower.includes("invalid login credentials")) {
    return "Incorrect email or password. Use Forgot password to set a new one.";
  }

  if (lower.includes("user already registered")) {
    return "An account with that email already exists. Try logging in.";
  }

  if (lower.includes("rate limit") || lower.includes("security purposes")) {
    return "Too many emails requested. Wait a minute and try again.";
  }

  if (lower.includes("should be different from the old password")) {
    return "Pick a password different from your old one.";
  }

  if (lower.includes("password should be at least")) {
    return "Password must be at least 6 characters.";
  }

  if (lower.includes("signup is disabled")) {
    return "New signups are disabled for this project. Continue in demo mode instead.";
  }

  return message || "Something went wrong. Try again or continue in demo mode.";
}
